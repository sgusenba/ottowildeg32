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

console.log('decoder: alle Tests ok');
