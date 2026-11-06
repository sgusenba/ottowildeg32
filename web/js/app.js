import { WebBluetoothTransport } from './transport/webbluetooth.js';
import { decodePacket, toHex } from './decoder.js';
import { G32 } from './g32.js';
import { RANGES, validateTarget, clampTarget, targetState } from './targets.js';
import { calibratedGas, validateProfile, profileFromTare } from './gas.js';
import { load, save } from './store.js';

const $ = (id) => document.getElementById(id);
const STALE_MS = 10000;
const ALARM_EVERY_MS = 5000;

const state = load();
let transport = null;
let lastPacketAt = 0;
let lastData = null;
let audioCtx = null;
let lastAlarmAt = 0;
let msgTimer = null;
const prevStates = new Map();

const persist = () => save(state);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function showMsg(text) {
  const m = $('msg');
  m.textContent = text;
  m.hidden = false;
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => (m.hidden = true), 4000);
}

// ---------- Zonen / Fühler ----------
const STATE_TEXT = {
  idle: () => '',
  heating: (t, target) => `heizt · noch ${Math.max(0, Math.round(target - t))} °C`,
  reached: () => 'Ziel erreicht',
  over: () => 'zu heiß',
};

function buildCards(containerId, kind, label) {
  const range = RANGES[kind];
  const cards = [];
  for (let i = 0; i < 4; i++) {
    const key = `${kind}${i}`;
    const card = el('div', 'card');
    const name = el('div', 'muted', `${label} ${i + 1}`);
    const value = el('div', 'big', '–');
    const status = el('div', 'state', '');
    const bar = el('div', 'bar small');
    const fill = el('div', 'bar-fill');
    bar.append(fill);

    const row = el('div', 'target-row');
    const minus = el('button', 'step secondary', '−');
    const plus = el('button', 'step secondary', '+');
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(range.min);
    input.max = String(range.max);
    input.step = String(range.step);
    input.inputMode = 'numeric';
    input.placeholder = 'Ziel';
    input.setAttribute('aria-label', `Ziel ${label} ${i + 1}`);
    row.append(minus, input, el('span', 'muted', '°C'), plus);

    const c = { key, kind, card, value, status, fill, input };
    input.addEventListener('change', () => setTarget(c, input.value));
    minus.addEventListener('click', () => nudge(c, -range.step));
    plus.addEventListener('click', () => nudge(c, +range.step));

    card.append(name, value, status, bar, row);
    $(containerId).append(card);
    syncInput(c);
    cards.push(c);
  }
  return cards;
}

function syncInput(c) {
  c.input.value = state.targets[c.key] ?? '';
}

function setTarget(c, raw) {
  if (raw === '' || raw == null) {
    delete state.targets[c.key];
  } else {
    try {
      state.targets[c.key] = validateTarget(c.kind, Number(raw));
    } catch (e) {
      showMsg(e.message);
    }
  }
  persist();
  syncInput(c);
  render();
}

function nudge(c, delta) {
  const cur = state.targets[c.key];
  if (cur === undefined) {
    const measured = lastData ? (c.kind === 'zone' ? lastData.zones : lastData.probes)[Number(c.key.slice(-1))] : null;
    const base = measured != null ? Math.round(measured / RANGES[c.kind].step) * RANGES[c.kind].step : RANGES[c.kind].min;
    setTarget(c, clampTarget(c.kind, base));
  } else {
    setTarget(c, clampTarget(c.kind, cur + delta));
  }
}

const zoneCards = buildCards('zones', 'zone', 'Zone');
const probeCards = buildCards('probes', 'probe', 'Fühler');

// ---------- Gas ----------
$('gasLimit').value = state.gas.lowPercent;
$('gasLimit').addEventListener('change', () => {
  const v = parseFloat($('gasLimit').value);
  if (Number.isFinite(v) && v >= 0 && v <= 100) state.gas.lowPercent = v;
  else $('gasLimit').value = state.gas.lowPercent;
  persist();
  render();
});

const activeProfile = () => state.gas.profiles.find((p) => p.id === state.gas.active) || null;

function renderProfiles() {
  const sel = $('profileSelect');
  sel.textContent = '';
  const none = el('option', null, '– neues Profil –');
  none.value = '';
  sel.append(none);
  for (const p of state.gas.profiles) {
    const o = el('option', null, p.name);
    o.value = p.id;
    sel.append(o);
  }
  sel.value = state.gas.active || '';
  const p = activeProfile();
  $('profileName').value = p ? p.name : '';
  $('gasEmpty').value = p ? p.empty : '';
  $('gasFull').value = p ? p.full : '';
}

$('profileSelect').addEventListener('change', () => {
  state.gas.active = $('profileSelect').value || null;
  persist();
  renderProfiles();
  render();
});

function learn(inputId) {
  if (!lastData) return showMsg('Keine Daten vom Grill – erst verbinden.');
  $(inputId).value = lastData.gas.rawGrams;
}
$('learnEmpty').addEventListener('click', () => learn('gasEmpty'));
$('learnFull').addEventListener('click', () => learn('gasFull'));

$('fromTare').addEventListener('click', () => {
  const tare = parseFloat($('gasTare').value);
  const cap = parseFloat($('gasCapacity').value);
  if (!Number.isFinite(tare) || !Number.isFinite(cap)) return showMsg('Tara und Füllmenge angeben.');
  const p = profileFromTare(tare, cap);
  $('gasEmpty').value = p.empty;
  $('gasFull').value = p.full;
});

$('profileSave').addEventListener('click', () => {
  try {
    const v = validateProfile({
      name: $('profileName').value,
      empty: parseFloat($('gasEmpty').value),
      full: parseFloat($('gasFull').value),
    });
    // gleicher Name -> überschreiben, sonst neues Profil
    const existing = state.gas.profiles.find((p) => p.name === v.name);
    if (existing) Object.assign(existing, v);
    else {
      const id = `p${Date.now().toString(36)}`;
      state.gas.profiles.push({ id, ...v });
      state.gas.active = id;
    }
    if (existing) state.gas.active = existing.id;
    persist();
    renderProfiles();
    render();
    showMsg(`Profil „${v.name}“ gespeichert.`);
  } catch (e) {
    showMsg(e.message);
  }
});

$('profileDelete').addEventListener('click', () => {
  const p = activeProfile();
  if (!p) return showMsg('Kein Profil ausgewählt.');
  state.gas.profiles = state.gas.profiles.filter((x) => x.id !== p.id);
  state.gas.active = null;
  persist();
  renderProfiles();
  render();
});

renderProfiles();

// ---------- Rendering ----------
const fmtTemp = (t) => (t == null ? '–' : `${Math.round(t)} °C`);

function renderGroup(cards, values, alarms, notices) {
  let newlyReached = false;
  cards.forEach((c, i) => {
    const t = values ? values[i] : null;
    const target = state.targets[c.key];
    const prev = prevStates.get(c.key) || 'idle';
    const s = targetState(t, target, c.kind, prev);
    prevStates.set(c.key, s);

    const label = c.card.firstChild.textContent;
    c.value.textContent = fmtTemp(t);
    c.status.textContent = STATE_TEXT[s](t, target);
    c.card.classList.toggle('inactive', t == null);
    c.card.classList.toggle('reached', s === 'reached');
    c.card.classList.toggle('over', s === 'over');
    c.fill.style.width = `${t != null && target ? Math.min(100, Math.max(0, (t / target) * 100)) : 0}%`;

    if (s === 'reached' && prev !== 'reached') newlyReached = true;
    if (s === 'reached') notices.push(`${label}: Ziel ${target} °C erreicht`);
    if (s === 'over') alarms.push(`${label} zu heiß: ${Math.round(t)} °C (Ziel ${target} °C)`);
  });
  return newlyReached;
}

function render() {
  const stale = !lastData || Date.now() - lastPacketAt > STALE_MS;
  const d = stale ? null : lastData;
  const alarms = [];
  const notices = [];

  const reachedZ = renderGroup(zoneCards, d?.zones, alarms, notices);
  const reachedP = renderGroup(probeCards, d?.probes, alarms, notices);

  // Gas: kalibriertes Profil bevorzugt, sonst Wert vom Grill
  const profile = activeProfile();
  const cal = d && profile ? calibratedGas(d.gas.rawGrams, profile) : null;
  const pct = cal ? cal.percent : (d?.gas.percent ?? null);
  $('gasPercent').textContent = pct == null ? '–' : `${pct} %`;
  $('gasGrams').textContent = cal
    ? `${(cal.remainingGrams / 1000).toFixed(1)} kg Rest`
    : d ? `${d.gas.grams} g` : '–';
  $('gasSource').textContent = cal ? `Profil: ${profile.name}` : 'Wert vom Grill (kein Profil)';
  $('gasRaw').textContent = d ? `${d.gas.rawGrams} g` : '–';
  $('gasBar').style.width = `${pct == null ? 0 : pct}%`;
  const gasLow = pct != null && pct <= state.gas.lowPercent;
  $('gas').classList.toggle('over', gasLow);
  if (gasLow) alarms.push(`Gas niedrig: ${pct} %`);

  $('hood').textContent = `Haube: ${d ? (d.hoodOpen ? 'offen' : 'zu') : '–'}`;
  $('light').textContent = `Licht: ${d ? (d.lightOn ? 'an' : 'aus') : '–'}`;

  $('alarm').hidden = alarms.length === 0;
  $('alarm').textContent = alarms.join(' · ');
  $('notice').hidden = notices.length === 0;
  $('notice').textContent = notices.join(' · ');

  if (reachedZ || reachedP) beep([660, 880], 0.15);
  if (alarms.length) alarmBeep();
}

// ---------- Ton ----------
function beep(freqs, dur) {
  if ($('mute').checked || !audioCtx) return;
  freqs.forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = f;
    gain.gain.value = 0.2;
    osc.connect(gain).connect(audioCtx.destination);
    const t0 = audioCtx.currentTime + i * (dur + 0.05);
    osc.start(t0);
    osc.stop(t0 + dur);
  });
}

function alarmBeep() {
  const now = Date.now();
  if (now - lastAlarmAt < ALARM_EVERY_MS) return;
  lastAlarmAt = now;
  beep([880, 880, 880], 0.2);
}

// ---------- Verbindung ----------
$('connect').addEventListener('click', async () => {
  try {
    // AudioContext muss in einer Nutzeraktion entstehen
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    transport = new WebBluetoothTransport({ acceptAll: false });
    transport.addEventListener('status', (e) => ($('status').textContent = e.detail));
    transport.addEventListener('error', (e) => ($('status').textContent = `Fehler: ${e.detail.message}`));
    transport.addEventListener('disconnected', () => {
      $('connect').disabled = false;
      $('disconnect').disabled = true;
    });
    transport.addEventListener('packet', (e) => {
      if (e.detail.uuid !== G32.DATA_CHAR) return;
      const d = decodePacket(e.detail.bytes);
      if (!d) return;
      lastData = d;
      lastPacketAt = Date.now();
      $('raw').textContent = toHex(e.detail.bytes);
      render();
    });

    await transport.connect();
    await transport.startData(G32.DATA_CHAR, { pollMs: 2000 });
    $('connect').disabled = true;
    $('disconnect').disabled = false;
  } catch (err) {
    $('status').textContent = `Fehler: ${err.message}`;
  }
});

$('disconnect').addEventListener('click', async () => {
  await transport?.disconnect();
});

setInterval(render, 2000); // Stale-Erkennung und Alarm-Wiederholung

if (!WebBluetoothTransport.supported()) {
  $('status').textContent = 'Web Bluetooth nicht verfügbar – Chrome/Edge auf localhost nutzen';
  $('connect').disabled = true;
}
render();
