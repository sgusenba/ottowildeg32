// Zieltemperaturen werden in der App gespeichert und überwacht (nicht am Grill).

export const RANGES = {
  zone: { min: 50, max: 400, step: 5, overshoot: 20 }, // °C, vorläufig – nach Test am Grill anpassen
  probe: { min: 30, max: 120, step: 1, overshoot: 5 },
};
export const HYSTERESIS = 3; // °C: "erreicht" bleibt, bis die Temperatur so weit unter das Ziel fällt

export function clampTarget(kind, value) {
  const r = RANGES[kind];
  return Math.min(r.max, Math.max(r.min, value));
}

export function validateTarget(kind, celsius) {
  const r = RANGES[kind];
  if (!r) throw new Error(`Unbekannte Art: ${kind}`);
  if (!Number.isFinite(celsius)) throw new Error('Ungültiger Zielwert');
  if (celsius < r.min || celsius > r.max) throw new Error(`Ziel außerhalb ${r.min}–${r.max} °C`);
  const q = celsius / r.step;
  if (Math.abs(q - Math.round(q)) > 1e-9) throw new Error(`Schrittweite ${r.step} °C`);
  return celsius;
}

// Zustand einer Zone/eines Fühlers: 'idle' | 'heating' | 'reached' | 'over'
export function targetState(current, target, kind, prev = 'idle') {
  if (current == null || !Number.isFinite(target)) return 'idle';
  const r = RANGES[kind];
  if (current > target + r.overshoot) return 'over';
  if (current >= target) return 'reached';
  if (prev === 'reached' && current >= target - HYSTERESIS) return 'reached';
  return 'heating';
}
