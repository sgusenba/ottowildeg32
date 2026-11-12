import React from "react";
import { Flex, Grid } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { Chip, ProgressBar } from "@dynatrace/strato-components/content";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { Tile, type Tone } from "../components/Tile";
import { QueryError } from "../components/QueryError";
import { liveGasCalibrated, liveProbes, liveStatus, liveZones } from "../queries";
import { GAS_WARN_PERCENT, connectionState, fmtKg, fmtPercent, fmtTemp, toNum } from "../format";

const REFRESH_MS = 15_000; // Forwarder sendet alle 10 s
const live = { refetchInterval: REFRESH_MS };

/** Werte je Index 1..4 aus Records wie { zone: "2", value: 180 }. */
function byIndex(records: Array<Record<string, unknown> | null> | undefined, key: string) {
  const out: Array<number | null> = [null, null, null, null];
  for (const r of records ?? []) {
    const i = Number(r?.[key]) - 1;
    if (i >= 0 && i < 4) out[i] = toNum(r?.value);
  }
  return out;
}

const connectionChip = {
  connected: { color: "success", text: "Grill verbunden" },
  "no-grill": { color: "warning", text: "Forwarder läuft, keine Daten vom Grill" },
  "no-forwarder": { color: "critical", text: "Keine Daten vom Forwarder (letzte 3 min)" },
} as const;

export const Live = () => {
  const zones = useDql(liveZones, live);
  const probes = useDql(liveProbes, live);
  const status = useDql(liveStatus, live);
  const gasCal = useDql(liveGasCalibrated, live);

  const zoneValues = byIndex(zones.data?.records, "zone");
  const probeValues = byIndex(probes.data?.records, "probe");
  const s = status.data?.records?.[0] ?? {};
  const conn = connectionState(toNum(s?.connected));
  const hood = toNum(s?.hood);
  const light = toNum(s?.light);
  const cal = gasCal.data?.records?.[0] ?? {};
  const calPercent = toNum(cal?.percent);
  const gasPercent = calPercent ?? toNum(s?.gasPercent);
  const gasTone: Tone = gasPercent == null ? "neutral" : gasPercent <= GAS_WARN_PERCENT ? "critical" : "success";
  const chip = connectionChip[conn];

  return (
    <Flex flexDirection="column" gap={24} padding={24}>
      <Flex alignItems="center" gap={8} flexWrap="wrap">
        <Chip color={chip.color}>{chip.text}</Chip>
        {hood != null && <Chip color={hood ? "warning" : "neutral"}>{hood ? "Haube offen" : "Haube zu"}</Chip>}
        {light != null && <Chip color={light ? "primary" : "neutral"}>{light ? "Licht an" : "Licht aus"}</Chip>}
      </Flex>

      {[zones.error, probes.error, status.error, gasCal.error].map((e, i) => (
        <QueryError key={i} error={e} />
      ))}

      <Flex flexDirection="column" gap={8}>
        <Heading level={4}>Gas</Heading>
        <Grid gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap={12}>
          <Tile
            label={calPercent != null ? "Füllstand (kalibriert)" : "Füllstand (Grill)"}
            value={fmtPercent(gasPercent)}
            tone={gasTone}
            hint={gasPercent != null && gasPercent <= GAS_WARN_PERCENT ? "Flasche bald leer" : undefined}
          />
          {calPercent != null && <Tile label="Restgas" value={fmtKg(toNum(cal?.remaining))} />}
        </Grid>
        {gasPercent != null && <ProgressBar value={gasPercent} min={0} max={100} color={gasTone === "critical" ? "critical" : "success"} />}
      </Flex>

      <Flex flexDirection="column" gap={8}>
        <Heading level={4}>Zonen</Heading>
        <Grid gridTemplateColumns="repeat(auto-fit, minmax(140px, 1fr))" gap={12}>
          {zoneValues.map((v, i) => (
            <Tile key={i} label={`Zone ${i + 1}`} value={fmtTemp(v)} muted={v == null} />
          ))}
        </Grid>
      </Flex>

      <Flex flexDirection="column" gap={8}>
        <Heading level={4}>Fühler</Heading>
        <Grid gridTemplateColumns="repeat(auto-fit, minmax(140px, 1fr))" gap={12}>
          {probeValues.map((v, i) => (
            <Tile key={i} label={`Fühler ${i + 1}`} value={v == null ? "nicht gesteckt" : fmtTemp(v)} muted={v == null} />
          ))}
        </Grid>
      </Flex>

      <Paragraph>
        Aktualisiert alle {REFRESH_MS / 1000} s. Zielwerte und Alarme bleiben im Web-Dashboard am Grill, diese App zeigt nur
        die Messwerte, die der G32-Forwarder an Dynatrace sendet.
      </Paragraph>
    </Flex>
  );
};
