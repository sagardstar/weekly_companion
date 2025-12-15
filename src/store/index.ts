import { useStore } from "zustand";
import { createAppStore } from "./store";

export const appStore = createAppStore();

export const useAppStore = <T>(selector: (state: ReturnType<typeof appStore.getState>) => T) =>
  useStore(appStore, selector);

export type UseAppStore = typeof useAppStore;
