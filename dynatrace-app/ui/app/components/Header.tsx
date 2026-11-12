import React from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@dynatrace/strato-components/layouts";

export const Header = () => (
  <AppHeader>
    <AppHeader.Navigation>
      <AppHeader.Logo as={Link} to="/" appName="G32 Grill" />
      <AppHeader.NavigationItem as={Link} to="/">
        Live
      </AppHeader.NavigationItem>
      <AppHeader.NavigationItem as={Link} to="/verlauf">
        Verlauf
      </AppHeader.NavigationItem>
    </AppHeader.Navigation>
  </AppHeader>
);
