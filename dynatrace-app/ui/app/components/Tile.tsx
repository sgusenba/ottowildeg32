import React from "react";
import { Surface, Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Text } from "@dynatrace/strato-components/typography";
import Colors from "@dynatrace/strato-design-tokens/colors";

export type Tone = "neutral" | "success" | "warning" | "critical";

const toneColor: Record<Tone, string> = {
  neutral: Colors.Text.Neutral.Default,
  success: Colors.Text.Success.Default,
  warning: Colors.Text.Warning.Default,
  critical: Colors.Text.Critical.Default,
};

interface TileProps {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  muted?: boolean;
}

/** Kachel für einen Live-Wert (Zone, Fühler, Gas). */
export const Tile = ({ label, value, hint, tone = "neutral", muted = false }: TileProps) => (
  <Surface style={{ opacity: muted ? 0.55 : 1 }}>
    <Flex flexDirection="column" gap={4} padding={16}>
      <Text textStyle="small">{label}</Text>
      <Heading level={2} style={{ color: toneColor[tone], fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Heading>
      {hint && <Text textStyle="small">{hint}</Text>}
    </Flex>
  </Surface>
);
