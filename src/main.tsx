import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppWithProviders } from "./App";
import "./index.css";
import { appStore } from "./store";
import { connectLocalPersistence } from "./persistence/connect";

const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error("Root container missing in index.html");
}

try {
  const disconnect = connectLocalPersistence(appStore, window.localStorage);
  if (import.meta.hot) import.meta.hot.dispose(disconnect);
} catch {
  appStore.setState({
    localSaveError:
      "Local saving isn’t available in this browser. Export your data before closing this page.",
  });
}

createRoot(rootEl).render(
  <StrictMode>
    <AppWithProviders />
  </StrictMode>,
);
