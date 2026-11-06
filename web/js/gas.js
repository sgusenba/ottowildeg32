// Gasflasche anlernen in der App: Zwei-Punkt-Kalibrierung auf dem Rohwert des GasBuddy (Bytes 22–23).
// Profil = { id, name, empty, full } mit Rohwerten in g. Unabhängig davon, ob der Grill brutto oder netto meldet.

export function profileFromTare(tare, capacity) {
  return { empty: tare, full: tare + capacity };
}

export function validateProfile({ name, empty, full }) {
  if (!name || !name.trim()) throw new Error('Name fehlt');
  if (![empty, full].every(Number.isFinite)) throw new Error('Leer- und Voll-Wert angeben');
  if (!(full > empty)) throw new Error('Voll muss größer als Leer sein');
  if (full - empty < 500) throw new Error('Füllmenge unter 500 g – Werte prüfen');
  return { name: name.trim(), empty, full };
}

// Rohwert -> { percent (0..100, ganzzahlig), remainingGrams } oder null ohne Profil
export function calibratedGas(raw, profile) {
  if (raw == null || !profile || !(profile.full > profile.empty)) return null;
  const span = profile.full - profile.empty;
  const remaining = Math.min(span, Math.max(0, raw - profile.empty));
  return { percent: Math.round((remaining / span) * 100), remainingGrams: remaining };
}
