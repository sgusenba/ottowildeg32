import { WebBluetoothTransport } from './transport/webbluetooth.js';
import { decodePacket, toHex } from './decoder.js';
import { G32 } from './g32.js';

const $ = (id) => document.getElementById(id);
const STORE_KEY = 'g32-limits';
const STALE_MS = 10000;
const BEEP_EVERY_MS = 5000;

let transport = null;
let lastPacketAt = 0;
let lastData = null;
let audioCtx = null;
let lastBeepAt = 0;

// ---------- lokale Alarmgrenzen ----------
function loadLimits() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}
function saveLimits() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(limits));
  } catch { /* Speicher evtl. blockiert – dann nur für diese Sitzung */ }
}
const limits = loadLimits();
limits.gas ??= 20; // Standard-Warnschwelle Gas in %

// ---------- UI aufbauen ----------
function buildCards(containerId, prefix, label) {
  const el = $(containerId);
  const cards = [];
  for (let i = 0; i < 4; i++) {
    const key = `${prefix}${i}`;
    const card = document.createElement('div');
    card.className = 'card';

    const name = document.createElement('div');
    name.className = 'muted';
    name.textContent = `${label} ${i + 1}`;

    const value = document.createElement('div');
    value.className = 'big';
    value.textContent = '–';

    const lim = document.createElement('label');
    lim.className = 'limit';
    lim.append('Limit ');
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '500';
    input.step = '5';
    input.inputMode = 'numeric';
    input.value = limits[key] ?? '';
    input.addEventListener('change', () => {
      const v = parseFloat(input.value);
      if (Number.isFinite(v)) limits[key] = v;
      else delete limits[key];
      saveLimits();
      render();
    });
    lim.append(input, ' °C');

    card.append(name, value, lim);
    el.append(card);
    cards.push({ key, card, value });
  }
  return cards;
}

const zoneCards = buildCards('zones', 'z', 'Zone');
const probeCards = buildCards('probes', 'p', 'Fühler');

$('gasLimit').value = limits.gas ?? 20;
$('gasLimit').addEventListener('change', () => {
  const v = parseFloat($('gasLimit').value);
  if (Number.isFinite(v)) limits.gas = v;
  else delete limits.gas;
  saveLimits();
  render();
});

// ---------- Rendering ----------
function fmtTemp(t) {
  return t == null ? '–' : `${Math.round(t)} °C`;
}

function updateCards(cards, values, alarms) {
  cards.forEach((c, i) => {
    const t = values ? values[i] : null;
    c.value.textContent = fmtTemp(t);
    const limit = limits[c.key];
    const over = t != null && Number.isFinite(limit) && t > limit;
    c.card.classList.toggle('over', over);
    c.card.classList.toggle('inactive', t == null);
    if (over) alarms.push(`${c.card.firstChild.textContent} ${Math.round(t)} °C > ${limit} °C`);
  });
}

function render() {
  const stale = !lastData || Date.now() - lastPacketAt > STALE_MS;
  const d = stale ? null : lastData;
  const alarms = [];

  updateCards(zoneCards, d?.zones, alarms);
  updateCards(probeCards, d?.probes, alarms);

  const pct = d?.gas.percent;
  $('gasPercent').textContent = pct == null ? '–' : `${pct} %`;
  $('gasGrams').textContent = d ? `${d.gas.grams} g` : '–';
  $('gasBar').style.width = `${pct == null ? 0 : pct}%`;
  const gasLow = pct != null && Number.isFinite(limits.gas) && pct <= limits.gas;
  $('gas').classList.toggle('over', gasLow);
  if (gasLow) alarms.push(`Gas niedrig: ${pct} %`);

  $('hood').textContent = `Haube: ${d ? (d.hoodOpen ? 'offen' : 'zu') : '–'}`;
  $('light').textContent = `Licht: ${d ? (d.lightOn ? 'an' : 'aus') : '–'}`;

  const alarmEl = $('alarm');
  alarmEl.hidden = alarms.length === 0;
  alarmEl.textContent = alarms.join(' · ');
  if (alarms.length) beep();
}

// ---------- Ton ----------
function beep() {
  if ($('mute').checked || !audioCtx) return;
  const now = Date.now();
  if (now - lastBeepAt < BEEP_EVERY_MS) return;
  lastBeepAt = now;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.frequency.value = 880;
  gain.gain.value = 0.2;
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.4);
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
