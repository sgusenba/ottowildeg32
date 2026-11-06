// Decoder: Rohbytes vom Grill -> Werte. Wird in Meilenstein 1 implementiert,
// sobald das Byte-Layout in docs/PROTOCOL.md belegt ist.

export function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
}

export function decodePacket(/* uuid, bytes */) {
  // Rückgabe-Form (Ziel):
  // { burners: [{ actual, target }], probes: [{ actual, target }], gas: { levelPercent }, battery: ... }
  return null;
}

// Sollwert-Prüfung, bevor irgendetwas geschrieben wird. Grenzen nach Analyse anpassen!
export const LIMITS = { min: 50, max: 400, step: 5 }; // °C, vorläufig

export function validateTarget(celsius) {
  if (!Number.isFinite(celsius)) throw new Error('Ungültiger Sollwert');
  if (celsius < LIMITS.min || celsius > LIMITS.max) {
    throw new Error(`Sollwert außerhalb ${LIMITS.min}–${LIMITS.max} °C`);
  }
  if (celsius % LIMITS.step !== 0) throw new Error(`Schrittweite ${LIMITS.step} °C`);
  return celsius;
}
