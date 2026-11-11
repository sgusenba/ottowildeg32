// G32 -> Dynatrace: liest die ESP32-Bridge (oder tools/mock-bridge.mjs) per WebSocket und schickt die
// dekodierten Werte an die Dynatrace Metrics API v2. Node 22+ (eingebauter WebSocket, fetch), keine Abhängigkeiten.
//
//   DT_URL=https://abc12345.live.dynatrace.com DT_TOKEN=dt0c01.... node forwarder/dynatrace-forwarder.mjs
//   node forwarder/dynatrace-forwarder.mjs --dry-run        # Zeilen nur ausgeben
//
// Konfiguration (Umgebungsvariablen), siehe forwarder/README.md.

import os from 'node:os';
import { decodePacket } from '../web/js/decoder.js';
import { heartbeatLine, packetToLines, parseBridgeFrame } from './lines.mjs';

const env = process.env;
const DRY_RUN = process.argv.includes('--dry-run') || env.DRY_RUN === '1';
const BRIDGE_URL = env.BRIDGE_URL || 'ws://g32.local:81/';
const BRIDGE_TOKEN = env.BRIDGE_TOKEN || '';
const INGEST_URL = env.DT_INGEST_URL || (env.DT_URL ? `${env.DT_URL.replace(/\/+$/, '')}/api/v2/metrics/ingest` : '');
const DT_TOKEN = env.DT_TOKEN || '';
const INTERVAL_MS = Math.max(5, Number(env.INTERVAL_S || 10)) * 1000;
const STALE_MS = 15000; // so lange ohne Paket gilt der Grill als getrennt (wie die Bridge)
const MAX_BUFFER = 5000; // Zeilen, die bei Ausfall von Dynatrace gepuffert werden
const GRILL_NAME = env.GRILL_NAME || '';
const PROFILE = env.GAS_EMPTY && env.GAS_FULL ? { empty: Number(env.GAS_EMPTY), full: Number(env.GAS_FULL) } : null;
const extraDims = { forwarder: env.FORWARDER_NAME || os.hostname(), ...(GRILL_NAME ? { grill: GRILL_NAME } : {}) };

if (!DRY_RUN && !INGEST_URL) {
  console.error('DT_URL (oder DT_INGEST_URL) fehlt. Für einen Test ohne Dynatrace: --dry-run');
  process.exit(1);
}
if (PROFILE && !(PROFILE.full - PROFILE.empty >= 500)) {
  console.error('GAS_EMPTY/GAS_FULL ungültig (Voll muss mindestens 500 über Leer liegen)');
  process.exit(1);
}

const log = (...a) => console.log(new Date().toISOString(), ...a);

let latest = null; // { packet, at }
let deviceId = null;
let buffer = [];

// ---------- Bridge ----------
let backoff = 1000;
function connectBridge() {
  const sep = BRIDGE_URL.includes('?') ? '&' : '?';
  const url = BRIDGE_TOKEN ? `${BRIDGE_URL}${sep}token=${encodeURIComponent(BRIDGE_TOKEN)}` : BRIDGE_URL;
  log(`Verbinde mit Bridge ${BRIDGE_URL}`);
  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  ws.onopen = () => {
    backoff = 1000;
    log('Bridge verbunden');
  };
  ws.onmessage = (ev) => {
    if (typeof ev.data === 'string') return;
    const frame = parseBridgeFrame(ev.data);
    if (frame?.type === 'status') log(`Bridge: ${frame.text}`);
    if (frame?.type === 'packet') {
      const packet = decodePacket(frame.bytes);
      if (packet) {
        latest = { packet, at: Date.now() };
        deviceId = packet.deviceId;
      }
    }
  };
  ws.onclose = () => {
    log(`Bridge getrennt, neuer Versuch in ${backoff / 1000} s`);
    setTimeout(connectBridge, backoff);
    backoff = Math.min(backoff * 2, 30000);
  };
  ws.onerror = () => {}; // onclose folgt
}

// ---------- Dynatrace ----------
async function send(lines) {
  if (DRY_RUN) {
    for (const l of lines) console.log(l);
    return true;
  }
  const headers = { 'Content-Type': 'text/plain; charset=utf-8' };
  if (DT_TOKEN) headers.Authorization = `Api-Token ${DT_TOKEN}`;
  try {
    const res = await fetch(INGEST_URL, { method: 'POST', headers, body: lines.join('\n'), signal: AbortSignal.timeout(10000) });
    const text = await res.text();
    if (res.status === 202 || res.ok) {
      // 202 kann trotzdem einzelne ungültige Zeilen melden
      if (/"linesInvalid":\s*[1-9]/.test(text)) log(`Dynatrace: ungültige Zeilen ${text}`);
      return true;
    }
    log(`Dynatrace HTTP ${res.status}: ${text.slice(0, 300)}`);
    // 400 = Zeilen kaputt, erneutes Senden hilft nicht; 401/403 = Token, hilft auch nicht -> verwerfen
    return res.status === 400 || res.status === 401 || res.status === 403;
  } catch (e) {
    log(`Dynatrace nicht erreichbar: ${e.message}`);
    return false;
  }
}

let sending = false;
async function tick() {
  if (sending) return;
  const now = Date.now();
  const fresh = latest && now - latest.at < STALE_MS;
  const lines = fresh ? packetToLines(latest.packet, { ts: now, profile: PROFILE, extraDims }) : [];
  lines.push(heartbeatLine(fresh, { ts: now, deviceId, extraDims }));
  buffer.push(...lines);
  if (buffer.length > MAX_BUFFER) buffer = buffer.slice(-MAX_BUFFER);
  sending = true;
  const batch = buffer.slice(0, 1000); // Dynatrace-Limit liegt deutlich höher, 1000 Zeilen sind sicher
  if (await send(batch)) buffer = buffer.slice(batch.length);
  sending = false;
}

log(DRY_RUN ? 'Trockenlauf: Zeilen werden nur ausgegeben' : `Sende an ${INGEST_URL} alle ${INTERVAL_MS / 1000} s`);
connectBridge();
setInterval(tick, INTERVAL_MS);
