// Decoder: Rohbytes der Daten-Characteristic -> Werte.
// Byte-Layout (Quellen in docs/PROTOCOL.md):
//   [6..13]   Zonen 1–4, je 2 Byte (hi, lo): °C = hi*10 + lo/10 ; 1500 = "nicht vorhanden"
//   [14..21]  Fühler 1–4, gleiche Kodierung
//   [22..23]  GasBuddy Gewicht in g (uint16, big endian)
//   [24]      Haube offen (≠0)
//   [25]      Licht an (≠0)
//   [26..29]  unbekannt
//   [30]      unbekannt (Status?)
//   [31]      GasBuddy Füllstand in % (>100 = unbekannt)
//   [0..5]    unbekannt (Header)

import { G32 } from './g32.js';

export function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
}

function temp(bytes, i) {
  const value = bytes[i] * 10 + bytes[i + 1] / 10;
  return value === 1500 ? null : value;
}

export function decodePacket(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < G32.MIN_PACKET) return null;
  const gramsRaw = (bytes[22] << 8) | bytes[23];
  const percent = bytes[31];
  return {
    zones: [6, 8, 10, 12].map((i) => temp(bytes, i)),
    probes: [14, 16, 18, 20].map((i) => temp(bytes, i)),
    gas: {
      rawGrams: gramsRaw, // ungekürzt, Basis für die Kalibrierung in der App
      grams: Math.min(gramsRaw, G32.GAS_MAX_G), // Anzeige-Wert wie in der Original-App
      percent: percent > 100 ? null : percent, // vom Grill gemeldet
    },
    hoodOpen: bytes[24] !== 0,
    lightOn: bytes[25] !== 0,
    unknown: { header: bytes.slice(0, 6), b26_29: bytes.slice(26, 30), b30: bytes[30] },
    length: bytes.length,
  };
}
