import { PersistedState } from "../types/schema";
import { STORAGE_KEY } from "./schema";
import { createLocalStorageProvider, StorageLike } from "./storage";

export interface PersistenceAdapter<T> {
  load(): Promise<T | null>;
  save(state: T): Promise<void>;
  clear(): Promise<void>;
}

export function createLocalAdapter(
  storage: StorageLike = createLocalStorageProvider(),
): PersistenceAdapter<PersistedState> {
  return {
    async load() {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as PersistedState;
      } catch (error) {
        console.error("Failed to parse persisted state", error);
        return null;
      }
    },
    async save(state) {
      const value = JSON.stringify(state);
      storage.setItem(STORAGE_KEY, value);
    },
    async clear() {
      storage.removeItem(STORAGE_KEY);
    },
  };
}
