import React, { useState } from "react";
import { Flex, Surface } from "@dynatrace/strato-components/layouts";
import { Heading } from "@dynatrace/strato-components/typography";
import { TimeframeSelector } from "@dynatrace/strato-components/filters";
import { TimeseriesChart, convertToTimeseries } from "@dynatrace/strato-components/charts";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { QueryError } from "../components/QueryError";
import { historyGas, historyHood, historyProbes, historyZones } from "../queries";

interface ChartProps {
  title: string;
  query: string;
  from: string;
  to: string;
  variant?: "line" | "area" | "bar";
  unit?: string;
}

const Chart = ({ title, query, from, to, variant = "line", unit }: ChartProps) => {
  const { data, error, isLoading } = useDql({ query, defaultTimeframeStart: from, defaultTimeframeEnd: to });
  return (
    <Surface>
      <Flex flexDirection="column" gap={8} padding={16}>
        <Heading level={4}>{title}</Heading>
        <QueryError error={error} />
        {isLoading && !data && <ProgressCircle />}
        {data?.records && (
          <TimeseriesChart data={convertToTimeseries(data.records, data.types)} variant={variant} gapPolicy="gap" height={240}>
            {unit && <TimeseriesChart.YAxis label={unit} />}
          </TimeseriesChart>
        )}
      </Flex>
    </Surface>
  );
};

export const History = () => {
  const [timeframe, setTimeframe] = useState({ from: "now()-6h", to: "now()" });

  return (
    <Flex flexDirection="column" gap={16} padding={24}>
      <Flex justifyContent="flex-end">
        <TimeframeSelector
          value={timeframe}
          onChange={(tf) => tf && setTimeframe({ from: tf.from.value, to: tf.to.value })}
        />
      </Flex>
      <Chart title="Zonen" query={historyZones} unit="°C" {...timeframe} />
      <Chart title="Fühler" query={historyProbes} unit="°C" {...timeframe} />
      <Chart title="Gas" query={historyGas} unit="%" {...timeframe} />
      <Chart title="Haube, Licht, Verbindung" query={historyHood} variant="area" {...timeframe} />
    </Flex>
  );
};
