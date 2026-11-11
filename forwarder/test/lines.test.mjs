// node forwarder/test/lines.test.mjs
import assert from 'node:assert/strict';
import { decodePacket } from '../../web/js/decoder.js';
import { heartbeatLine, packetToLines, parseBridgeFrame } from '../lines.mjs';

// Echtes Paket vom Grill (Mitschnitt 2026-11-06), Fühler 1 gesteckt (13 °C), Rest nicht vorhanden
const hex = 'a3 3a 12 34 ab cd 00 28 00 28 00 32 00 28 01 1e 96 00 96 00 96 00 02 72 00 00 0d 01 04 05 ff 08 c3';
const bytes = Uint8Array.from(hex.split(' ').map((h) => parseInt(h, 16)));
const packet = decodePacket(bytes);
const ts = 1762430000000;

const lines = packetToLines(packet, { ts, extraDims: { forwarder: 'pi' } });
assert.deepEqual(lines, [
  `g32.zone.temperature,device="1234abcd",forwarder="pi",zone="1" gauge,4 ${ts}`,
  `g32.zone.temperature,device="1234abcd",forwarder="pi",zone="2" gauge,4 ${ts}`,
  `g32.zone.temperature,device="1234abcd",forwarder="pi",zone="3" gauge,5 ${ts}`,
  `g32.zone.temperature,device="1234abcd",forwarder="pi",zone="4" gauge,4 ${ts}`,
  `g32.probe.temperature,device="1234abcd",forwarder="pi",probe="1" gauge,13 ${ts}`,
  `g32.gas.raw,device="1234abcd",forwarder="pi" gauge,626 ${ts}`,
  `g32.gas.percent,device="1234abcd",forwarder="pi" gauge,8 ${ts}`,
  `g32.hood.open,device="1234abcd",forwarder="pi" gauge,0 ${ts}`,
  `g32.light.on,device="1234abcd",forwarder="pi" gauge,0 ${ts}`,
]);

// Nachkommastelle, Kalibrierung, Escaping
bytes[6] = 21; bytes[7] = 5; // 210,5 °C
const cal = packetToLines(decodePacket(bytes), { ts, profile: { empty: 126, full: 1126 }, extraDims: { grill: 'Ter"rasse' } });
assert.ok(cal[0].startsWith('g32.zone.temperature,device="1234abcd",grill="Ter\\"rasse",zone="1" gauge,210.5 '));
assert.ok(cal.includes(`g32.gas.calibrated_percent,device="1234abcd",grill="Ter\\"rasse" gauge,50 ${ts}`));
assert.ok(cal.includes(`g32.gas.remaining_grams,device="1234abcd",grill="Ter\\"rasse" gauge,500 ${ts}`));

assert.equal(heartbeatLine(false, { ts }), `g32.bridge.connected gauge,0 ${ts}`);
assert.equal(packetToLines(null).length, 0);

const frame = parseBridgeFrame(Uint8Array.from([0x10, 0, ...new TextEncoder().encode('Grill verbunden')]));
assert.deepEqual(frame, { type: 'status', text: 'Grill verbunden' });
assert.equal(parseBridgeFrame(Uint8Array.from([0x01, 0, 1, 2])).bytes.length, 2);

console.log('lines.test.mjs: ok');
