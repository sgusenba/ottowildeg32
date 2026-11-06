// Konstanten des G32 Connected (BLE). Quellen: siehe docs/PROTOCOL.md
export const G32 = {
  NAME_PREFIX: 'OWG-G32C',
  SERVICE: 'dc0f41ea-b6ae-46a8-a19e-1a3bf4342bcb',
  DATA_CHAR: 'dc0f41e2-b6ae-46a8-a19e-1a3bf4342bcb',
  MIN_PACKET: 32, // Bytes; Felder siehe decoder.js
  GAS_MAX_G: 11000,
};
