import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppWithProviders } from "./App";
import "./index.css";

const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error("Root container missing in index.html");
}

createRoot(rootEl).render(
  <StrictMode>
    <AppWithProviders />
  </StrictMode>,
);
