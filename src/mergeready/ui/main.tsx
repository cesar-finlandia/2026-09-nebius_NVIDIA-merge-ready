// SPDX-License-Identifier: Apache-2.0
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./mergeready.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setTheme } from "src/platform/ui";
import { App } from "./App.js";
import { applyTheme, initialTheme } from "./theme.js";

applyTheme(initialTheme());
setTheme("operator");

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
