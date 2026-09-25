import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppWithProviders } from "./App";
import "./index.css";
import { appStore } from "./store";
import { connectOfflineSync, supabaseGateway } from "./offline/sync";
import { supabase } from "./lib/supabase";

const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error("Root container missing in index.html");
}

try {
  // Do not let React effects mutate a snapshot before the lifetime editor lock
  // has been granted. connectOfflineSync flips this to active for the owner.
  appStore.setState({ editorMode: "readOnly" });
  const disconnect = connectOfflineSync(
    appStore,
    window.localStorage,
    supabase ? supabaseGateway(supabase) : null,
  );
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

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(console.error);
  });
}
