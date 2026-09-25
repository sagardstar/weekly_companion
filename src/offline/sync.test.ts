import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { createAppStore } from "../store/store";
import {
  connectOfflineSync,
  OFFLINE_KEY,
  supabaseGateway,
  type Gateway,
  type Write,
} from "./sync";
import type { Habit } from "../types/schema";
import { STORAGE_KEY } from "../persistence/schema";
import { holdEditorLock } from "./editorLock";
const account = (id = "alice") => ({ id }) as User;
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const clientFor = (fetcher: typeof fetch) =>
  createClient("https://example.supabase.co", "test-anon-key", {
    global: { fetch: fetcher },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
const stops: (() => void)[] = [];
const memory = () => {
  const values = new Map<string, string>();
  return {
    clear: () => values.clear(),
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  };
};
let isOnline = true;
beforeEach(() => {
  vi.useFakeTimers();
  isOnline = true;
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => isOnline);
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: (_name: string, _options: unknown, callback: (lock: object | null) => Promise<void>) =>
        callback({}),
    },
  });
});
afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function setup(storage = memory(), gateway?: Gateway) {
  const remote = new Map<string, Habit>();
  const api = gateway ?? {
    owner: vi.fn(async () => "alice"),
    push: vi.fn(async (_owner: string, w: Write) => {
      if (w.table !== "habits") return;
      if (w.operation === "delete") remote.delete(w.id);
      else remote.set(w.id, { ...remote.get(w.id), ...w.patch } as Habit);
    }),
    pull: vi.fn(async () => ({ habits: [...remote.values()], logs: [] })),
  };
  const store = createAppStore();
  const stop = connectOfflineSync(store, storage, api);
  stops.push(stop);
  return { store, storage, api, stop };
}
it("restores offline edits and deletions across restarts, then uploads them", async () => {
  const first = setup();
  first.store.getState().setUser(account());
  const habit = first.store.getState().addHabit({ name: "Read", user_id: "alice" });
  await first.store.getState().syncFromCloud();
  isOnline = false;
  first.store.getState().deleteHabit(habit.id);
  const added = first.store.getState().addHabit({ name: "Walk", user_id: "alice" });
  first.stop();
  const second = setup(first.storage, first.api);
  expect(second.store.getState().habits.map((h) => h.id)).toEqual([added.id]);
  expect(second.store.getState().pendingCount).toBe(2);
  await second.store.getState().syncFromCloud();
  expect(second.store.getState().pendingCount).toBe(2);
  isOnline = true;
  await second.store.getState().syncFromCloud();
  expect(second.store.getState().pendingCount).toBe(0);
  expect(second.store.getState().habits.map((h) => h.name)).toEqual(["Walk"]);
});
it("keeps failures queued and retries while online", async () => {
  const test = setup();
  test.store.getState().setUser(account());
  test.store.getState().addHabit({ name: "Keep me", user_id: "alice" });
  vi.mocked(test.api.push).mockRejectedValueOnce(new Error("Network failed"));
  await test.store.getState().syncFromCloud();
  expect(test.store.getState().syncStatus).toBe("error");
  expect(test.store.getState().pendingCount).toBe(1);
  await test.store.getState().syncFromCloud();
  expect(test.store.getState().pendingCount).toBe(0);
});
it("does not acknowledge a newer edit when an older upload completes", async () => {
  const test = setup();
  test.store.getState().setUser(account());
  const h = test.store.getState().addHabit({ name: "First", user_id: "alice" });
  let finish!: () => void;
  vi.mocked(test.api.push).mockImplementationOnce(
    () =>
      new Promise<void>((r) => {
        finish = r;
      }),
  );
  const syncing = test.store.getState().syncFromCloud();
  await Promise.resolve();
  await Promise.resolve();
  test.store.getState().updateHabit({ ...h, name: "Latest" });
  finish();
  await syncing;
  expect(test.store.getState().habits[0].name).toBe("Latest");
  expect(test.store.getState().pendingCount).toBe(1);
  await test.store.getState().syncFromCloud();
  expect(test.store.getState().pendingCount).toBe(0);
});
it("coalesces same-field edits with the earliest server value as its conflict base", async () => {
  const test = setup();
  test.store.getState().setUser(account());
  const habit = test.store.getState().addHabit({ name: "Original", user_id: "alice" });
  await test.store.getState().syncFromCloud();
  isOnline = false;
  test.store.getState().updateHabit({ ...habit, name: "First local draft" });
  test.store.getState().updateHabit({ ...habit, name: "Latest local draft" });
  isOnline = true;
  await test.store.getState().syncFromCloud();
  const calls = vi.mocked(test.api.push).mock.calls;
  const pushed = calls[calls.length - 1]?.[1];
  expect(pushed).toMatchObject({
    operation: "update",
    patch: { name: "Latest local draft" },
    base: { name: "Original" },
  });
});
it("keeps a legacy base-less edit blocked when a newer edit coalesces", async () => {
  const first = setup();
  first.store.getState().setUser(account());
  const habit = first.store.getState().addHabit({
    name: "Server value",
    user_id: "alice",
  });
  await first.store.getState().syncFromCloud();
  first.stop();

  const saved = JSON.parse(first.storage.getItem(OFFLINE_KEY)!);
  saved.workspaces["account:alice"].data.habits[0].name = "Legacy local draft";
  saved.workspaces["account:alice"].pending = [
    {
      table: "habits",
      id: habit.id,
      operation: "update",
      patch: { name: "Legacy local draft" },
      version: "legacy-v1",
    },
  ];
  first.storage.setItem(OFFLINE_KEY, JSON.stringify(saved));

  const recovered = setup(first.storage, first.api);
  recovered.store.getState().setUser(account());
  const local = recovered.store.getState().habits[0];
  recovered.store.getState().updateHabit({ ...local, name: "Latest local draft" });
  const pending = JSON.parse(recovered.storage.getItem(OFFLINE_KEY)!).workspaces[
    "account:alice"
  ].pending[0];
  expect(pending).toMatchObject({
    operation: "update",
    patch: { name: "Latest local draft" },
    recoveryRequired: true,
  });
  expect(pending.base).toBeUndefined();
});
  it("rebases a newer in-flight edit after the older conditional write is acknowledged", async () => {
  const test = setup();
  test.store.getState().setUser(account());
  const habit = test.store.getState().addHabit({ name: "Original", user_id: "alice" });
  await test.store.getState().syncFromCloud();
  test.store.getState().updateHabit({ ...habit, name: "First" });
  let finish!: () => void;
  vi.mocked(test.api.push).mockImplementationOnce(
    () => new Promise<void>((resolve) => { finish = resolve; }),
  );
  const syncing = test.store.getState().syncFromCloud();
  await Promise.resolve();
  test.store.getState().updateHabit({ ...habit, name: "Latest" });
  finish();
  await syncing;
  const saved = JSON.parse(test.storage.getItem(OFFLINE_KEY)!);
  const pending = saved.workspaces["account:alice"].pending[0];
  expect(pending).toMatchObject({ patch: { name: "Latest" }, base: { name: "First" } });
});
describe("Supabase conflict adapter", () => {
  const update = (base: Record<string, unknown> | undefined): Write => ({
    table: "habits",
    id: "habit-1",
    operation: "update",
    patch: { name: "Mine" },
    base,
    version: "v1",
  });
  it("turns an edit made during an in-flight create into a conditional update", async () => {
    const test = setup();
    test.store.getState().setUser(account());
    const habit = test.store.getState().addHabit({ name: "Created", user_id: "alice" });
    let finish!: () => void;
    vi.mocked(test.api.push).mockImplementationOnce(
      () => new Promise<void>((resolve) => { finish = resolve; }),
    );
    const syncing = test.store.getState().syncFromCloud();
    await Promise.resolve();
    test.store.getState().updateHabit({ ...habit, name: "Edited after insert" });
    finish();
    await syncing;
    const saved = JSON.parse(test.storage.getItem(OFFLINE_KEY)!);
    const pending = saved.workspaces["account:alice"].pending[0];
    expect(pending).toMatchObject({
      operation: "update",
      patch: { name: "Edited after insert" },
      base: { name: "Created" },
    });
  });
  it("keeps deletion durable after a lost create response, restart, and in-flight edit", async () => {
    const first = setup();
    first.store.getState().setUser(account());
    const habit = first.store.getState().addHabit({
      name: "Created",
      user_id: "alice",
    });
    let rejectCreate!: (error: Error) => void;
    vi.mocked(first.api.push).mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectCreate = reject;
        }),
    );
    const syncing = first.store.getState().syncFromCloud();
    await Promise.resolve();
    await Promise.resolve();
    first.store
      .getState()
      .updateHabit({ ...habit, name: "Edited while sending" });
    isOnline = false;
    rejectCreate(new Error("Response lost"));
    await syncing;
    first.stop();

    const recovered = setup(first.storage, first.api);
    recovered.store.getState().setUser(account());
    expect(
      JSON.parse(recovered.storage.getItem(OFFLINE_KEY)!).workspaces[
        "account:alice"
      ].pending[0],
    ).toMatchObject({
      operation: "create",
      patch: { name: "Edited while sending" },
      createState: "uncertain",
      createAttempt: { name: "Created" },
    });
    recovered.store.getState().deleteHabit(habit.id);
    const deletion = JSON.parse(recovered.storage.getItem(OFFLINE_KEY)!)
      .workspaces["account:alice"].pending[0];
    expect(deletion).toMatchObject({
      operation: "delete",
      patch: {},
      base: { name: "Created" },
    });
    recovered.stop();

    const restarted = setup(recovered.storage, first.api);
    restarted.store.getState().setUser(account());
    expect(restarted.store.getState().pendingCount).toBe(1);
    isOnline = true;
    await restarted.store.getState().syncFromCloud();
    expect(restarted.store.getState().pendingCount).toBe(0);
    const deleteCalls = vi.mocked(first.api.push).mock.calls;
    expect(deleteCalls[deleteCalls.length - 1]?.[1]).toMatchObject({
      operation: "delete",
      base: { name: "Created" },
    });
  });
  it("reconciles the attempted create before uploading an edit after restart", async () => {
    const first = setup();
    first.store.getState().setUser(account());
    const habit = first.store.getState().addHabit({
      name: "Created",
      user_id: "alice",
    });
    let rejectCreate!: (error: Error) => void;
    vi.mocked(first.api.push).mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectCreate = reject;
        }),
    );
    const syncing = first.store.getState().syncFromCloud();
    await Promise.resolve();
    await Promise.resolve();
    first.store.getState().updateHabit({ ...habit, name: "Latest" });
    isOnline = false;
    rejectCreate(new Error("Response lost"));
    await syncing;
    first.stop();

    const recovered = setup(first.storage, first.api);
    recovered.store.getState().setUser(account());
    isOnline = true;
    const callOffset = vi.mocked(first.api.push).mock.calls.length;
    await recovered.store.getState().syncFromCloud();
    expect(vi.mocked(first.api.push).mock.calls.slice(callOffset)).toEqual([
      [
        "alice",
        expect.objectContaining({
          operation: "create",
          patch: expect.objectContaining({ name: "Created" }),
        }),
      ],
    ]);
    expect(recovered.store.getState().pendingCount).toBe(1);
    await recovered.store.getState().syncFromCloud();
    const updateCalls = vi.mocked(first.api.push).mock.calls;
    expect(updateCalls[updateCalls.length - 1]?.[1]).toMatchObject({
      operation: "update",
      patch: { name: "Latest" },
      base: { name: "Created" },
    });
    expect(recovered.store.getState().pendingCount).toBe(0);
  });
  it("uses original values as conditional filters, including null", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response([{ id: "habit-1" }]));
    await supabaseGateway(clientFor(fetcher)).push("alice", update({ name: "Before", icon: null }));
    expect(String(fetcher.mock.calls[0][0])).toContain("name=eq.Before");
    expect(String(fetcher.mock.calls[0][0])).toContain("icon=is.null");
  });
  it("does not send a blind follow-up update after a create retry", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ id: "habit-1", name: "New" }));
    await supabaseGateway(clientFor(fetcher)).push("alice", {
      ...update(undefined),
      operation: "create",
      patch: { name: "New" },
    });
    expect(fetcher.mock.calls.map(([, request]) => request.method)).toEqual([
      "POST",
      "GET",
    ]);
  });
  it("accepts an already-applied conditional update after a lost response", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ id: "habit-1", name: "Mine" }));
    await expect(
      supabaseGateway(clientFor(fetcher)).push("alice", update({ name: "Before" })),
    ).resolves.toBeUndefined();
  });
  it("retains a conflict when a row changed or disappeared", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ id: "habit-1", name: "Theirs" }));
    await expect(
      supabaseGateway(clientFor(fetcher)).push("alice", update({ name: "Before" })),
    ).rejects.toThrow("changed or was deleted");
  });
  it("conditionally deletes and treats a missing row only as a lost delete response", async () => {
    const write: Write = {
      ...update({ name: "Before", icon: null }),
      operation: "delete",
      patch: {},
    };
    const deleted = vi.fn().mockResolvedValue(response([{ id: "habit-1" }]));
    await supabaseGateway(clientFor(deleted)).push("alice", write);
    expect(String(deleted.mock.calls[0][0])).toContain("name=eq.Before");
    expect(String(deleted.mock.calls[0][0])).toContain("icon=is.null");
    expect(deleted.mock.calls[0][1].method).toBe("DELETE");

    const lostResponse = vi
      .fn()
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response(null));
    await expect(
      supabaseGateway(clientFor(lostResponse)).push("alice", write),
    ).resolves.toBeUndefined();

    const changed = vi
      .fn()
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ id: "habit-1", name: "Theirs" }));
    await expect(
      supabaseGateway(clientFor(changed)).push("alice", write),
    ).rejects.toThrow("changed or was deleted");
  });
  it("does not upload a coalesced legacy edit marked for recovery", async () => {
    const fetcher = vi.fn();
    await expect(
      supabaseGateway(clientFor(fetcher)).push("alice", {
        ...update({ name: "Earlier local draft" }),
        recoveryRequired: true,
      }),
    ).rejects.toThrow("no original value");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("editor lifetime lock", () => {
  it("keeps a second window read-only until the first disposes, then permits retry", async () => {
    let held = false;
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: (_name: string, options: { ifAvailable: boolean }, callback: (lock: object | null) => Promise<void>) => {
          if (options.ifAvailable && held) return callback(null);
          held = true;
          return callback({}).finally(() => { held = false; });
        },
      },
    });
    const firstModes: string[] = [];
    const secondModes: string[] = [];
    const first = holdEditorLock("test-lock", (mode) => firstModes.push(mode));
    const second = holdEditorLock("test-lock", (mode) => secondModes.push(mode));
    expect(firstModes).toEqual(["active"]);
    expect(secondModes).toEqual(["readOnly"]);
    second.retry();
    expect(secondModes).toEqual(["readOnly", "readOnly"]);
    first.dispose();
    await Promise.resolve();
    await Promise.resolve();
    second.retry();
    expect(secondModes).toEqual(["readOnly", "readOnly", "active"]);
    second.dispose();
  });
  it("does not publish an active grant that arrives after disposal", async () => {
    let grant!: () => void;
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: (_name: string, _options: unknown, callback: (lock: object) => Promise<void>) =>
          new Promise<void>((resolve) => { grant = () => { void callback({}).then(resolve); }; }),
      },
    });
    const modes: string[] = [];
    const lock = holdEditorLock("late-lock", (mode) => modes.push(mode));
    lock.dispose();
    grant();
    await Promise.resolve();
    expect(modes).toEqual([]);
  });
});
it("overlays an edit made during a cloud read", async () => {
  const test = setup();
  test.store.getState().setUser(account());
  const h = test.store.getState().addHabit({ name: "Original", user_id: "alice" });
  await test.store.getState().syncFromCloud();
  let finish!: (data: { habits: Habit[]; logs: [] }) => void;
  vi.mocked(test.api.pull).mockImplementationOnce(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  const syncing = test.store.getState().syncFromCloud();
  await Promise.resolve();
  await Promise.resolve();
  test.store.getState().updateHabit({ ...h, name: "Offline edit" });
  finish({ habits: [h], logs: [] });
  await syncing;
  expect(test.store.getState().habits[0].name).toBe("Offline edit");
  expect(test.store.getState().pendingCount).toBe(1);
});
it("isolates accounts and ignores a previous account's late response", async () => {
  const test = setup();
  test.store.getState().setUser(account());
  const h = test.store.getState().addHabit({ name: "Alice private", user_id: "alice" });
  let finish!: (data: { habits: Habit[]; logs: [] }) => void;
  vi.mocked(test.api.pull).mockImplementationOnce(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  const syncing = test.store.getState().syncFromCloud();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  test.store.getState().setUser(account("bob"));
  expect(test.store.getState().habits).toEqual([]);
  finish({ habits: [h], logs: [] });
  await syncing;
  expect(test.store.getState().habits).toEqual([]);
  test.store.getState().setUser(account());
  expect(test.store.getState().habits[0].name).toBe("Alice private");
});
it("hydrates only the authenticated account's snapshot in a read-only window", () => {
  const storage = memory();
  const first = setup(storage);
  first.store.getState().setUser(account("alice"));
  first.store.getState().addHabit({ name: "Alice private", user_id: "alice" });
  first.store.getState().setUser(account("bob"));
  first.store.getState().addHabit({ name: "Bob private", user_id: "bob" });
  first.stop();
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: (
        _name: string,
        _options: unknown,
        callback: (lock: object | null) => Promise<void>,
      ) => callback(null),
    },
  });
  const reader = createAppStore();
  const stop = connectOfflineSync(reader, storage, null);
  stops.push(stop);
  reader.getState().setUser(account("bob"));
  expect(reader.getState().editorMode).toBe("readOnly");
  expect(reader.getState().habits.map((habit) => habit.name)).toEqual([
    "Bob private",
  ]);
});
it("migrates guest data exactly once, retaining a separate guest workspace", async () => {
  const test = setup();
  test.store.getState().addHabit({ name: "Guest habit", user_id: "demo-user" });
  test.store.getState().setUser(account());
  expect(test.store.getState().habits[0].user_id).toBe("alice");
  expect(test.store.getState().pendingCount).toBe(1);
  test.store.getState().setUser(null);
  expect(test.store.getState().habits).toEqual([]);
  test.store.getState().setUser(account("bob"));
  expect(test.store.getState().habits).toEqual([]);
});
it("preserves corrupt storage instead of overwriting it", () => {
  const storage = memory();
  storage.setItem(OFFLINE_KEY, "corrupt");
  const test = setup(storage);
  test.store.getState().addHabit({ name: "New", user_id: "demo-user" });
  expect(storage.getItem(OFFLINE_KEY)).toBe("corrupt");
  expect(test.store.getState().localSaveError).toContain("kept untouched");
});
it("migrates the previous local-storage format without deleting its backup", () => {
  const storage = memory();
  const old = createAppStore();
  old.getState().addHabit({ name: "Legacy", user_id: "demo-user" });
  const { habits, logs, reflections, settings } = old.getState();
  const raw = JSON.stringify({ habits, logs, reflections, settings, schemaVersion: 1 });
  storage.setItem(STORAGE_KEY, raw);
  const test = setup(storage);
  expect(test.store.getState().habits[0].name).toBe("Legacy");
  expect(storage.getItem(STORAGE_KEY)).toBe(raw);
});
it("clears cached account content when startup finds no authenticated session", () => {
  const first = setup();
  first.store.getState().setUser(account());
  first.store.getState().addHabit({ name: "Private", user_id: "alice" });
  first.stop();
  const next = setup(first.storage, first.api);
  expect(next.store.getState().habits).toHaveLength(1);
  next.store.getState().setUser(null);
  expect(next.store.getState().habits).toEqual([]);
  expect(next.store.getState().localOwnerId).toBeNull();
  next.store.getState().setUser(account());
  expect(next.store.getState().habits[0].name).toBe("Private");
});
