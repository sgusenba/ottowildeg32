import React from "react";
import { PageLayout } from "@dynatrace/strato-components/layouts";
import { Route, Routes } from "react-router-dom";
import { Header } from "./components/Header";
import { Live } from "./pages/Live";
import { History } from "./pages/History";

export const App = () => (
  <PageLayout>
    <PageLayout.Header>
      <Header />
    </PageLayout.Header>
    <PageLayout.Content>
      <Routes>
        <Route path="/" element={<Live />} />
        <Route path="/verlauf" element={<History />} />
      </Routes>
    </PageLayout.Content>
  </PageLayout>
);
