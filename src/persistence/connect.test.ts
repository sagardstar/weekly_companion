import { createAppStore } from "../store/store";
import { connectLocalPersistence } from "./connect";
import { STORAGE_KEY } from "./schema";

function memory() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
    clear: () => items.clear(),
  };
}

it("restores habits, check-ins, and reflections into a fresh store", () => {
  const storage = memory();
  const first = createAppStore();
  const stop = connectLocalPersistence(first, storage);
  first.getState().ensureSettings("guest");
  const habit = first.getState().addHabit({ name: "Read", user_id: "guest" });
  first.getState().addLog({ habit_id: habit.id, user_id: "guest", amount: 1 });
  first
    .getState()
    .addReflection({
      user_id: "guest",
      week_start_date: "2026-09-14",
      answers: [{ prompt: "What went well?", answer: "Reading" }],
    });
  stop();
  const second = createAppStore();
  const stopSecond = connectLocalPersistence(second, storage);
  expect(second.getState().habits).toEqual(first.getState().habits);
  expect(second.getState().logs).toEqual(first.getState().logs);
  expect(second.getState().reflections).toEqual(first.getState().reflections);
  expect(second.getState().settings).toEqual(first.getState().settings);
  stopSecond();
});

it("preserves invalid saved data and surfaces a recovery message", () => {
  const storage = memory();
  storage.setItem(
    STORAGE_KEY,
    '{"schemaVersion":1,"habits":[null],"logs":[],"reflections":[]}',
  );
  const before = storage.getItem(STORAGE_KEY);
  const store = createAppStore();
  connectLocalPersistence(store, storage);
  store.getState().ensureSettings("guest");
  expect(storage.getItem(STORAGE_KEY)).toBe(before);
  expect(store.getState().localSaveError).toContain("kept untouched");
});

it("warns about failed writes and recovers on a later successful save", () => {
  const storage = memory();
  const save = vi.spyOn(storage, "setItem").mockImplementationOnce(() => {
    throw new Error("Quota exceeded");
  });
  const store = createAppStore();
  const stop = connectLocalPersistence(store, storage);
  store.getState().ensureSettings("guest");
  expect(store.getState().localSaveError).toContain("couldn’t be saved");
  store.getState().addHabit({ name: "Walk", user_id: "guest" });
  expect(save).toHaveBeenCalledTimes(2);
  expect(store.getState().localSaveError).toBeNull();
  stop();
});
