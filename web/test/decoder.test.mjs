// Ausführen: node web/test/decoder.test.mjs
import assert from 'node:assert/strict';
import { decodePacket } from '../js/decoder.js';

const p = new Uint8Array(32);
p.set([18, 5], 6);    // Zone 1: 180.5 °C
p.set([20, 0], 8);    // Zone 2: 200 °C
p.set([15, 3], 10);   // Zone 3: 150.3 °C
p.set([150, 0], 12);  // Zone 4: nicht vorhanden
p.set([6, 2], 14);    // Fühler 1: 60.2 °C
p.set([150, 0], 16);
p.set([150, 0], 18);
p.set([150, 0], 20);
p.set([0x13, 0x88], 22); // 5000 g
p[24] = 1;               // Haube offen
p[25] = 0;               // Licht aus
p[31] = 45;              // 45 %

const d = decodePacket(p);
assert.deepEqual(d.zones, [180.5, 200, 150.3, null]);
assert.deepEqual(d.probes, [60.2, null, null, null]);
assert.equal(d.gas.grams, 5000);
assert.equal(d.gas.rawGrams, 5000);
assert.equal(d.gas.percent, 45);
assert.equal(d.hoodOpen, true);
assert.equal(d.lightOn, false);

p.set([0x30, 0x00], 22); // 12288 g -> auf 11000 begrenzt
p[31] = 200;             // >100 -> unbekannt
const d2 = decodePacket(p);
assert.equal(d2.gas.grams, 11000);
assert.equal(d2.gas.rawGrams, 12288);
assert.equal(d2.gas.percent, null);

assert.equal(decodePacket(new Uint8Array(10)), null);
assert.equal(decodePacket(null), null);

// --- Echte Pakete aus dem Mitschnitt vom Grill (Geräte-ID auf 00 00 00 00 gesetzt) ---
const real = (hex) => Uint8Array.from(hex.split(' '), (h) => parseInt(h, 16));
const idle = 'a3 3a 00 00 00 00 00 28 00 28 00 32 00 28 96 00 96 00 96 00 96 00 02 71 00 00 0d 01 04 05 ff 08 c3';

const r1 = decodePacket(real(idle));
assert.deepEqual(r1.zones, [4, 4, 5, 4]);          // Außentemperatur ca. 4–5 °C
assert.deepEqual(r1.probes, [null, null, null, null]);
assert.equal(r1.gas.rawGrams, 625);
assert.equal(r1.gas.percent, 8);
assert.equal(r1.hoodOpen, false);
assert.equal(r1.lightOn, false);
assert.equal(r1.length, 33);
assert.equal(r1.unknown.tail, 0xc3);
assert.equal(r1.deviceId, '00000000');

// Haube offen + Licht an
const r2 = decodePacket(real(idle.replace('02 71 00 00', '02 71 01 01')));
assert.equal(r2.hoodOpen, true);
assert.equal(r2.lightOn, true);

// nur Licht an
const r3 = decodePacket(real(idle.replace('02 71 00 00', '02 74 00 01')));
assert.equal(r3.hoodOpen, false);
assert.equal(r3.lightOn, true);
assert.equal(r3.gas.rawGrams, 628);

// Fühler 2 steckt: 02 14 = 22,0 °C; Fühler 3: 01 3c = 16,0 °C
const r4 = decodePacket(real(idle.replace('96 00 96 00 96 00 96 00 02', '96 00 02 14 96 00 96 00 02')));
assert.deepEqual(r4.probes, [null, 22, null, null]);
const r5 = decodePacket(real(idle.replace('96 00 96 00 96 00 96 00 02', '96 00 96 00 01 3c 96 00 02')));
assert.deepEqual(r5.probes, [null, null, 16, null]);

// 32-Byte-Variante (erstes Read ohne Schlussbyte) wird ebenfalls dekodiert
const r6 = decodePacket(real(idle).slice(0, 32));
assert.equal(r6.unknown.tail, null);
assert.deepEqual(r6.zones, [4, 4, 5, 4]);

console.log('decoder: alle Tests ok');
