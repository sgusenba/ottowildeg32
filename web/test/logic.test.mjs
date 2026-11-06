// Ausführen: node web/test/logic.test.mjs
import assert from 'node:assert/strict';
import { validateTarget, targetState, clampTarget } from '../js/targets.js';
import { calibratedGas, validateProfile, profileFromTare } from '../js/gas.js';

// --- Ziele ---
assert.equal(validateTarget('zone', 200), 200);
assert.equal(validateTarget('probe', 63), 63);
assert.throws(() => validateTarget('zone', 30), /außerhalb/);
assert.throws(() => validateTarget('zone', 203), /Schrittweite/);
assert.throws(() => validateTarget('probe', 130), /außerhalb/);
assert.throws(() => validateTarget('zone', NaN));
assert.equal(clampTarget('zone', 20), 50);
assert.equal(clampTarget('zone', 999), 400);

assert.equal(targetState(null, 200, 'zone'), 'idle');
assert.equal(targetState(150, undefined, 'zone'), 'idle');
assert.equal(targetState(150, 200, 'zone'), 'heating');
assert.equal(targetState(200, 200, 'zone'), 'reached');
assert.equal(targetState(198, 200, 'zone', 'reached'), 'reached');  // Hysterese
assert.equal(targetState(196, 200, 'zone', 'reached'), 'heating');  // unter Ziel-3
assert.equal(targetState(198, 200, 'zone', 'heating'), 'heating');  // noch nie erreicht
assert.equal(targetState(221, 200, 'zone'), 'over');
assert.equal(targetState(220, 200, 'zone'), 'reached');
assert.equal(targetState(69, 63, 'probe'), 'over');

// --- Gas ---
const prof = { name: '11 kg', empty: 0, full: 11000 };
assert.deepEqual(calibratedGas(5500, prof), { percent: 50, remainingGrams: 5500 });
assert.deepEqual(calibratedGas(-20, prof), { percent: 0, remainingGrams: 0 });
assert.deepEqual(calibratedGas(20000, prof), { percent: 100, remainingGrams: 11000 });
assert.equal(calibratedGas(5000, null), null);
assert.equal(calibratedGas(null, prof), null);

// Brutto-Variante: leere Flasche 10,5 kg, voll 21,5 kg
const gross = { name: 'brutto', ...profileFromTare(10500, 11000) };
assert.deepEqual(gross.empty, 10500);
assert.deepEqual(gross.full, 21500);
assert.equal(calibratedGas(16000, gross).percent, 50);

assert.deepEqual(validateProfile({ name: ' A ', empty: 0, full: 11000 }), { name: 'A', empty: 0, full: 11000 });
assert.throws(() => validateProfile({ name: '', empty: 0, full: 11000 }), /Name/);
assert.throws(() => validateProfile({ name: 'x', empty: 5, full: 5 }), /größer/);
assert.throws(() => validateProfile({ name: 'x', empty: NaN, full: 5 }), /angeben/);
assert.throws(() => validateProfile({ name: 'x', empty: 0, full: 100 }), /500 g/);

console.log('logic: alle Tests ok');
