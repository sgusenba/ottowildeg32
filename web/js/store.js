// Lokale Speicherung im Browser (localStorage). Fällt still auf "nur diese Sitzung" zurück,
// wenn der Speicher blockiert ist (private Fenster usw.).

const KEY = 'g32-state-v1';

export function defaults() {
  return { targets: {}, gas: { profiles: [], active: null, lowPercent: 20 } };
}

export function load() {
  const d = defaults();
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') {
      return {
        targets: { ...d.targets, ...(s.targets || {}) },
        gas: { ...d.gas, ...(s.gas || {}) },
      };
    }
  } catch { /* leer oder kaputt -> Defaults */ }
  return d;
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* ignorieren */ }
}
