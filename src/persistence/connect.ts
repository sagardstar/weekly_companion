import type { AppStore } from "../store/store";
import { parseImportedState, serializeState } from "./export";
import { STORAGE_KEY } from "./schema";
import type { StorageLike } from "./storage";

/** Restore before the first render so default settings cannot overwrite saved data. */
export function connectLocalPersistence(
  store: AppStore,
  storage: StorageLike,
): () => void {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const { state } = parseImportedState(raw);
      if (!state) {
        store.setState({
          localSaveError:
            "Your saved data couldn’t be opened. It has been kept untouched. Export any new work before closing this page.",
        });
        return () => {};
      }
      store.getState().replaceState(state);
    }
  } catch {
    store.setState({
      localSaveError:
        "This browser isn’t allowing local storage. Export your data before closing this page to keep your progress.",
    });
    return () => {};
  }
  return store.subscribe((state, previous) => {
    if (
      state.settings === previous.settings &&
      state.habits === previous.habits &&
      state.logs === previous.logs &&
      state.reflections === previous.reflections
    )
      return;
    try {
      storage.setItem(
        STORAGE_KEY,
        serializeState({
          settings: state.settings,
          habits: state.habits,
          logs: state.logs,
          reflections: state.reflections,
          schemaVersion: 1,
        }),
      );
      if (state.localSaveError) store.setState({ localSaveError: null });
    } catch {
      store.setState({
        localSaveError:
          "Your latest changes couldn’t be saved on this device. Export your data before closing this page.",
      });
    }
  });
}
