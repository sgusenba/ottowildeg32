// Dekodiertes G32-Paket -> Dynatrace Metric-Ingest-Zeilen (Line Protocol, Metrics API v2).
// Metrik-Schlüssel sind der Vertrag mit der Dynatrace-App (dynatrace-app/ui/app/queries.ts).
//
//   g32.zone.temperature      °C   Dimensionen device, zone (1..4)    nur wenn Zone vorhanden
//   g32.probe.temperature     °C   Dimensionen device, probe (1..4)   nur wenn Fühler gesteckt
//   g32.gas.raw               Rohwert Bytes 22–23 (ungekürzt)
//   g32.gas.percent           %    vom Grill gemeldet (Byte 31), nur wenn ≤ 100
//   g32.gas.calibrated_percent %   Zwei-Punkt-Kalibrierung, nur mit Flaschenprofil
//   g32.gas.remaining_grams   g    dito
//   g32.hood.open             0/1
//   g32.light.on              0/1
//   g32.bridge.connected      0/1  Heartbeat des Forwarders (frische Daten vom Grill ja/nein)

import { calibratedGas } from '../web/js/gas.js';

export const METRICS = {
  zone: 'g32.zone.temperature',
  probe: 'g32.probe.temperature',
  gasRaw: 'g32.gas.raw',
  gasPercent: 'g32.gas.percent',
  gasCalPercent: 'g32.gas.calibrated_percent',
  gasRemaining: 'g32.gas.remaining_grams',
  hood: 'g32.hood.open',
  light: 'g32.light.on',
  connected: 'g32.bridge.connected',
};

// Dimensionswerte immer quoten; " und \ escapen (Line-Protocol-Regel).
function dims(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}="${String(v).replace(/[\\"]/g, (c) => `\\${c}`)}"`)
    .join(',');
}

function line(key, dimObj, value, ts) {
  const d = dims(dimObj);
  const v = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${key}${d ? `,${d}` : ''} gauge,${v} ${ts}`;
}

// packet = Ergebnis von decodePacket(); profile = { empty, full } oder null; extraDims z. B. { grill: "Terrasse" }
export function packetToLines(packet, { ts = Date.now(), profile = null, extraDims = {} } = {}) {
  if (!packet) return [];
  const base = { device: packet.deviceId, ...extraDims };
  const out = [];
  packet.zones.forEach((t, i) => {
    if (t != null) out.push(line(METRICS.zone, { ...base, zone: i + 1 }, t, ts));
  });
  packet.probes.forEach((t, i) => {
    if (t != null) out.push(line(METRICS.probe, { ...base, probe: i + 1 }, t, ts));
  });
  out.push(line(METRICS.gasRaw, base, packet.gas.rawGrams, ts));
  if (packet.gas.percent != null) out.push(line(METRICS.gasPercent, base, packet.gas.percent, ts));
  const cal = calibratedGas(packet.gas.rawGrams, profile);
  if (cal) {
    out.push(line(METRICS.gasCalPercent, base, cal.percent, ts));
    out.push(line(METRICS.gasRemaining, base, cal.remainingGrams, ts));
  }
  out.push(line(METRICS.hood, base, packet.hoodOpen ? 1 : 0, ts));
  out.push(line(METRICS.light, base, packet.lightOn ? 1 : 0, ts));
  return out;
}

export function heartbeatLine(connected, { ts = Date.now(), deviceId = null, extraDims = {} } = {}) {
  return line(METRICS.connected, { device: deviceId, ...extraDims }, connected ? 1 : 0, ts);
}

// Frames der Bridge: [type:1][index:1][payload...]; 0x01 = Daten, 0x10 = Status-Text
export function parseBridgeFrame(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (b.length < 2) return null;
  if (b[0] === 0x01) return { type: 'packet', bytes: b.slice(2) };
  if (b[0] === 0x10) return { type: 'status', text: new TextDecoder().decode(b.slice(2)) };
  return null;
}
