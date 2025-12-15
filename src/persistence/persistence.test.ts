import { describe, expect, it, vi } from "vitest";
import { PersistedState } from "../types/schema";
import { createLocalAdapter } from "./persistence";

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

const state: PersistedState = {
  settings: null,
  habits: [],
  logs: [],
  reflections: [],
  schemaVersion: 1,
};

describe("createLocalAdapter", () => {
  it("saves and loads state", async () => {
    const storage = createMemoryStorage();
    const adapter = createLocalAdapter(storage);

    await adapter.save(state);
    const loaded = await adapter.load();

    expect(loaded).toEqual(state);
  });

  it("returns null on parse failure", async () => {
    const storage = createMemoryStorage();
    storage.setItem("weekly-companion:v1", "{bad json");
    const adapter = createLocalAdapter(storage);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const loaded = await adapter.load();
    errorSpy.mockRestore();
    expect(loaded).toBeNull();
  });

  it("clears stored state", async () => {
    const storage = createMemoryStorage();
    const adapter = createLocalAdapter(storage);
    await adapter.save(state);

    await adapter.clear();
    expect(storage.getItem("weekly-companion:v1")).toBeNull();
  });
});
