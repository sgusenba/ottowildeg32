// Anzeige-Helfer und Schwellen (wie im Web-Dashboard: web/js/targets.js, Gas-Warnung 10 %)

export const GAS_WARN_PERCENT = 10;

export type Num = number | null | undefined;

export const fmtTemp = (v: Num) => (v == null ? "–" : `${Math.round(v)} °C`);
export const fmtPercent = (v: Num) => (v == null ? "–" : `${Math.round(v)} %`);
export const fmtKg = (grams: Num) =>
  grams == null ? "–" : `${(grams / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} kg`;

/** DQL liefert Zahlen je nach Typ als number oder string. */
export const toNum = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export type Connection = "connected" | "no-grill" | "no-forwarder";

export function connectionState(connected: number | null): Connection {
  if (connected == null) return "no-forwarder";
  return connected >= 1 ? "connected" : "no-grill";
}
