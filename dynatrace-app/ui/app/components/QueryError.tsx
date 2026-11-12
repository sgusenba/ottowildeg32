import React from "react";
import { MessageContainer } from "@dynatrace/strato-components/content";

export const QueryError = ({ error }: { error?: { message: string } | null }) =>
  error ? (
    <MessageContainer variant="critical">
      <MessageContainer.Title>Abfrage fehlgeschlagen</MessageContainer.Title>
      <MessageContainer.Description>{error.message}</MessageContainer.Description>
    </MessageContainer>
  ) : null;
