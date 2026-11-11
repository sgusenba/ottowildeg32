// DQL-Abfragen auf die Metriken des Forwarders (forwarder/lines.mjs, METRICS).
// Ein Grill pro Umgebung angenommen; mehrere Grills unterscheiden sich über die Dimension `device`.

/** Zeitraum für "live": was älter ist, gilt als nicht mehr aktuell. */
const LIVE = "from: now()-3m";

/** Letzter Nicht-Null-Wert einer Zeitreihe. */
const last = (field: string) => `arrayLast(arrayRemoveNulls(${field}))`;

export const liveZones = `timeseries t = avg(g32.zone.temperature), by:{zone}, ${LIVE}
| fieldsAdd value = ${last("t")}
| fields zone, value
| sort zone asc`;

export const liveProbes = `timeseries t = avg(g32.probe.temperature), by:{probe}, ${LIVE}
| fieldsAdd value = ${last("t")}
| fields probe, value
| sort probe asc`;

export const liveStatus = `timeseries {
  connected = max(g32.bridge.connected),
  hood = max(g32.hood.open),
  light = max(g32.light.on),
  gasPercent = avg(g32.gas.percent),
  gasRaw = avg(g32.gas.raw)
}, ${LIVE}, nonempty: true
| fieldsAdd connected = ${last("connected")}, hood = ${last("hood")}, light = ${last("light")},
    gasPercent = ${last("gasPercent")}, gasRaw = ${last("gasRaw")}
| fields connected, hood, light, gasPercent, gasRaw`;

// Nur vorhanden, wenn der Forwarder ein Flaschenprofil hat (GAS_EMPTY/GAS_FULL)
export const liveGasCalibrated = `timeseries {
  percent = avg(g32.gas.calibrated_percent),
  remaining = avg(g32.gas.remaining_grams)
}, ${LIVE}, nonempty: true
| fieldsAdd percent = ${last("percent")}, remaining = ${last("remaining")}
| fields percent, remaining`;

// Verlauf: Zeitraum kommt aus dem TimeframeSelector (defaultTimeframeStart/End)
export const historyZones = `timeseries Temperatur = avg(g32.zone.temperature), by:{zone}
| fieldsAdd zone = concat("Zone ", zone)`;

export const historyProbes = `timeseries Temperatur = avg(g32.probe.temperature), by:{probe}
| fieldsAdd probe = concat("Fühler ", probe)`;

export const historyGas = `timeseries {
  \`Grill-Anzeige %\` = avg(g32.gas.percent),
  \`Kalibriert %\` = avg(g32.gas.calibrated_percent)
}, nonempty: true`;

export const historyHood = `timeseries {
  \`Haube offen\` = max(g32.hood.open),
  \`Licht an\` = max(g32.light.on),
  \`Grill verbunden\` = max(g32.bridge.connected)
}, nonempty: true`;
