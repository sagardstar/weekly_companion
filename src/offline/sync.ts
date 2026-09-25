import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppStore } from "../store/store";
import type { Habit, LogEntry, PersistedState } from "../types/schema";
import type { StorageLike } from "../persistence/storage";
import { parseImportedState } from "../persistence/export";
import { STORAGE_KEY } from "../persistence/schema";
import { holdEditorLock } from "./editorLock";

export type Write = {
  table: "habits" | "logs";
  id: string;
  operation: "create" | "update" | "delete";
  patch: Record<string, unknown>;
  /** Values seen before this edit. Missing bases are never uploaded as blind updates. */
  base?: Record<string, unknown>;
  /** Durable create lifecycle; missing on legacy creates is treated as uncertain. */
  createState?: "unattempted" | "uncertain";
  /** Exact create payload whose server outcome may be uncertain. */
  createAttempt?: Record<string, unknown>;
  /** A legacy conditional write is missing a trustworthy original value. */
  recoveryRequired?: boolean;
  version: string;
};
type Workspace = { data: PersistedState; pending: Write[] };
type Disk = { version: 1; owner: string | null; workspaces: Record<string, Workspace> };
export interface Gateway {
  owner(): Promise<string | null>;
  push(owner: string, write: Write): Promise<void>;
  pull(owner: string): Promise<{ habits: Habit[]; logs: LogEntry[] }>;
}
export const OFFLINE_KEY = "weekly-companion:offline:v1";
class RemoteConflict extends Error {}
const empty = (): PersistedState => ({
  settings: null,
  habits: [],
  logs: [],
  reflections: [],
  schemaVersion: 1,
});
const snapshot = (store: AppStore): PersistedState => {
  const { settings, habits, logs, reflections } = store.getState();
  return { settings, habits, logs, reflections, schemaVersion: 1 };
};
const keyFor = (owner: string | null) => (owner ? `account:${owner}` : "guest");
const online = () => typeof navigator === "undefined" || navigator.onLine;
const sameValue = (left: unknown, right: unknown, field: string) => {
  if (
    /(?:_at|timestamp)$/.test(field) &&
    typeof left === "string" &&
    typeof right === "string"
  ) {
    const a = Date.parse(left);
    const b = Date.parse(right);
    if (!Number.isNaN(a) && !Number.isNaN(b) && Math.abs(a - b) < 1)
      return true;
  }
  return left === right;
};
const matchesPatch = (row: Record<string, unknown>, patch: Record<string, unknown>) =>
  Object.entries(patch).every(([field, value]) =>
    sameValue(row[field], value, field),
  );
const assertConditional = (write: Write) => {
  if (
    write.recoveryRequired ||
    !write.base ||
    !Object.keys(write.base).length ||
    Object.values(write.base).some((value) => value === undefined) ||
    Object.keys(write.patch).some((field) => !(field in write.base!))
  )
    throw new RemoteConflict(
      "An older saved edit has no original value to compare. Export your data and review it before retrying.",
    );
};
const invalidConditional = (
  write: Pick<Write, "operation" | "patch" | "base" | "recoveryRequired">,
) =>
  write.operation !== "create" &&
  (write.recoveryRequired === true ||
    !write.base ||
    !Object.keys(write.base).length ||
    Object.values(write.base).some((value) => value === undefined) ||
    Object.keys(write.patch).some((field) => !(field in write.base!)));
const coalescedBase = (old: Write | undefined, write: Omit<Write, "version">) => {
  const base = { ...old?.base };
  for (const [field, value] of Object.entries(write.base ?? {}))
    if (!old || !(field in old.patch)) base[field] = value;
  return Object.keys(base).length ? base : undefined;
};
const definedFields = (row: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== undefined),
  );

export function supabaseGateway(client: SupabaseClient): Gateway {
  return {
    async owner() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session?.user.id ?? null;
    },
    async push(owner, write) {
      const table = client.from(write.table);
      const readCurrent = async () => {
        const { data, error } = await table
          .select("*")
          .eq("id", write.id)
          .eq("user_id", owner)
          .maybeSingle();
        if (error) throw error;
        return (data ?? null) as Record<string, unknown> | null;
      };
      if (write.operation === "delete") {
        assertConditional(write);
        let request = table.delete().eq("id", write.id).eq("user_id", owner);
        for (const [field, value] of Object.entries(write.base!))
          request = value === null ? request.is(field, null) : request.eq(field, value);
        const { data, error } = await request.select("id");
        if (error) throw error;
        if (data?.length) return;
        // An earlier delete may have committed before its response was lost.
        if (!(await readCurrent())) return;
        throw new RemoteConflict(
          "This item changed or was deleted on another device. Its local draft is still here; export it and review before discarding or recreating it.",
        );
      }
      if (write.operation === "create") {
        const { data, error } = await table
          .upsert(
            { ...write.patch, id: write.id, user_id: owner },
            { onConflict: "id", ignoreDuplicates: true },
          )
          .select("*");
        if (error) throw error;
        if (data?.length) return;
        const current = await readCurrent();
        if (current && matchesPatch(current, write.patch)) return;
        throw new RemoteConflict(
          "This item changed or was deleted on another device. Its local draft is still here; export it and review before discarding or recreating it.",
        );
      }
      assertConditional(write);
      let request = table
        .update({ ...write.patch, user_id: owner })
        .eq("id", write.id)
        .eq("user_id", owner);
      for (const [field, value] of Object.entries(write.base ?? {}))
        request = value === null ? request.is(field, null) : request.eq(field, value);
      const { data, error } = await request.select("id");
      if (error) throw error;
      if (!data?.length) {
        // The previous request may have reached PostgREST but lost its response.
        // A matching row is already acknowledged; never turn that retry into a
        // blind overwrite.
        const current = await readCurrent();
        if (current && matchesPatch(current, write.patch))
          return;
        throw new RemoteConflict(
          "This item changed or was deleted on another device. Its local draft is still here; export it and review before discarding or recreating it.",
        );
      }
    },
    async pull(owner) {
      const [habits, logs] = await Promise.all([
        client.from("habits").select("*").eq("user_id", owner),
        client.from("logs").select("*").eq("user_id", owner),
      ]);
      if (habits.error) throw habits.error;
      if (logs.error) throw logs.error;
      return { habits: habits.data ?? [], logs: logs.data ?? [] };
    },
  };
}

/** Data and its outbox share one atomic storage write. Accounts have separate workspaces. */
export function connectOfflineSync(
  store: AppStore,
  storage: StorageLike,
  gateway: Gateway | null,
) {
  let disconnect: (() => void) | undefined;
  const hydrateReadOnly = (requestedOwner?: string | null) => {
    try {
      const raw = storage.getItem(OFFLINE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Disk;
      const owner = requestedOwner === undefined ? saved.owner : requestedOwner;
      const ws = saved.workspaces?.[keyFor(owner)];
      if (!ws?.data || !Array.isArray(ws.pending)) {
        store.setState({
          ...empty(),
          localOwnerId: owner,
          pendingCount: 0,
          syncStatus: "local",
        });
        return;
      }
      store.setState({
        ...ws.data,
        localOwnerId: owner,
        pendingCount: ws.pending.length,
        syncStatus: "local",
      });
    } catch {
      store.setState({
        localSaveError:
          "The other window's saved snapshot couldn't be opened. It has not been changed.",
      });
    }
  };
  const lock = holdEditorLock("weekly-companion:editor:v1", (mode) => {
    store.setState({ editorMode: mode });
    if (mode === "active" && !disconnect)
      disconnect = connectOfflineSyncAsEditor(store, storage, gateway);
    if (mode !== "active") hydrateReadOnly();
    if (mode === "unsupported")
      store.setState({
        localSaveError:
          "This browser can't safely coordinate multiple Weekly Companion windows. This window is read-only; use a browser with Web Locks or close the other window.",
      });
  });
  const retryLock = () => lock.retry();
  const readOnlyOwnerListener = store.subscribe((state, previous) => {
    if (
      state.editorMode !== "active" &&
      state.authRevision !== previous.authRevision
    )
      hydrateReadOnly(state.user?.id ?? null);
  });
  const storageListener = (event: StorageEvent) => {
    if (event.key === OFFLINE_KEY && store.getState().editorMode !== "active")
      hydrateReadOnly();
  };
  window.addEventListener("weekly-companion:retry-editor-lock", retryLock);
  window.addEventListener("storage", storageListener);
  return () => {
    disconnect?.();
    readOnlyOwnerListener();
    lock.dispose();
    window.removeEventListener("weekly-companion:retry-editor-lock", retryLock);
    window.removeEventListener("storage", storageListener);
  };
}

function connectOfflineSyncAsEditor(
  store: AppStore,
  storage: StorageLike,
  gateway: Gateway | null,
) {
  let disk: Disk = { version: 1, owner: null, workspaces: {} };
  let muted = false;
  let stopped = false;
  let generation = 0;
  let running: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const status = (value: Partial<ReturnType<AppStore["getState"]>>) => {
    muted = true;
    store.setState(value);
    muted = false;
  };
  try {
    const raw = storage.getItem(OFFLINE_KEY);
    if (raw) {
      disk = JSON.parse(raw);
      if (
        disk.version !== 1 ||
        !disk.workspaces ||
        (disk.owner !== null && typeof disk.owner !== "string")
      )
        throw new Error("Invalid offline storage");
      for (const workspace of Object.values(disk.workspaces)) {
        if (
          !parseImportedState(JSON.stringify(workspace.data)).state ||
          !Array.isArray(workspace.pending) ||
          workspace.pending.some(
            (w) =>
              !w ||
              !["habits", "logs"].includes(w.table) ||
              !["create", "update", "delete"].includes(w.operation) ||
              typeof w.id !== "string" ||
              typeof w.version !== "string" ||
              !w.patch ||
              typeof w.patch !== "object" ||
              (w.createState !== undefined &&
                !["unattempted", "uncertain"].includes(w.createState)) ||
              (w.createAttempt !== undefined &&
                (!w.createAttempt || typeof w.createAttempt !== "object")) ||
              (w.recoveryRequired !== undefined &&
                typeof w.recoveryRequired !== "boolean"),
          )
        )
          throw new Error("Invalid offline workspace");
        workspace.pending = workspace.pending.map((write) => {
          if (write.operation === "create") {
            const createState = write.createState ?? "uncertain";
            return {
              ...write,
              createState,
              createAttempt:
                createState === "uncertain"
                  ? { ...(write.createAttempt ?? write.patch) }
                  : undefined,
              recoveryRequired: undefined,
            };
          }
          return {
            ...write,
            recoveryRequired: invalidConditional(write),
          };
        });
      }
    } else {
      const legacy = storage.getItem(STORAGE_KEY);
      const data = legacy ? parseImportedState(legacy).state : snapshot(store);
      if (!data) throw new Error("Invalid saved data");
      // Existing signed-in data must never migrate into a different account.
      const owner =
        data.habits.find((h) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(h.user_id))
          ?.user_id ??
        (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(data.settings?.user_id ?? "")
          ? data.settings?.user_id
          : undefined);
      disk.owner = owner ?? null;
      disk.workspaces[keyFor(disk.owner)] = { data, pending: [] };
    }
    disk.workspaces[keyFor(disk.owner)] ??= { data: empty(), pending: [] };
    status({ ...disk.workspaces[keyFor(disk.owner)].data, localOwnerId: disk.owner });
  } catch {
    status({
      localSaveError:
        "Your saved data couldn’t be opened. It has been kept untouched. Export any new work before closing this page.",
    });
    return () => {};
  }
  const workspace = () => disk.workspaces[keyFor(disk.owner)];
  const publish = () =>
    status({
      pendingCount: workspace().pending.length,
      syncStatus: !online()
        ? "offline"
        : !disk.owner || !gateway
          ? "local"
          : workspace().pending.length
            ? "pending"
            : "synced",
    });
  const persist = () => {
    try {
      storage.setItem(OFFLINE_KEY, JSON.stringify(disk));
      status({ localSaveError: null });
      return true;
    } catch {
      status({
        localSaveError:
          "Your latest changes couldn’t be saved on this device. Export your data before closing this page.",
      });
      return false;
    }
  };
  const enqueue = (ws: Workspace, write: Omit<Write, "version">) => {
    const old = ws.pending.find((w) => w.id === write.id && w.table === write.table);
    if (old?.operation === "create" && write.operation === "delete") {
      if (old.createState === "uncertain") {
        ws.pending = ws.pending.filter((w) => w !== old);
        ws.pending.push({
          ...write,
          operation: "delete",
          patch: {},
          base: { ...(old.createAttempt ?? old.patch) },
          createState: undefined,
          createAttempt: undefined,
          recoveryRequired: false,
          version: crypto.randomUUID(),
        });
      } else {
        // A local creation that has not been sent may be explicitly discarded.
        ws.pending = ws.pending.filter((w) => w !== old);
      }
      return;
    }
    ws.pending = ws.pending.filter((w) => w !== old);
    const operation =
      write.operation === "update" && old?.operation === "create"
        ? "create"
        : write.operation;
    const next: Write = {
      ...write,
      operation,
      patch: { ...old?.patch, ...write.patch },
      base: coalescedBase(old, write),
      createState:
        operation === "create"
          ? (old?.createState ?? write.createState ?? "unattempted")
          : undefined,
      createAttempt:
        operation === "create"
          ? (old?.createAttempt ?? write.createAttempt)
          : undefined,
      version: crypto.randomUUID(),
    };
    next.recoveryRequired =
      operation !== "create" &&
      (old?.recoveryRequired === true || invalidConditional(next));
    ws.pending.push(next);
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void sync();
    }, 500);
  };
  const sync = async () => {
    if (stopped) return;
    if (!online() || !disk.owner || !gateway) {
      publish();
      return;
    }
    if (running) return running;
    const owner = disk.owner;
    const epoch = generation;
    const ws = workspace();
    const valid = () => !stopped && epoch === generation && owner === disk.owner;
    const task = async () => {
      status({ syncStatus: "syncing", syncError: null });
      try {
        if ((await gateway.owner()) !== owner)
          throw new Error("Sign in to this account to sync your saved changes.");
        if (!valid()) return;
        if (!persist())
          throw new Error(
            "Local saving must recover before syncing. Your edits are still open here.",
          );
        // Parent creates precede child creates; child deletes precede parent deletes.
        const priority = (w: Write) =>
          w.operation === "delete"
            ? w.table === "logs"
              ? 2
              : 3
            : w.table === "habits"
              ? 0
              : 1;
        for (const write of [...ws.pending].sort((a, b) => priority(a) - priority(b))) {
          if (!valid() || !online()) return;
          if (!ws.pending.some((w) => w.version === write.version)) continue;
          let sent = write;
          if (write.operation === "create") {
            if (write.createState === "unattempted") {
              write.createState = "uncertain";
              write.createAttempt = { ...write.patch };
            }
            if (!persist())
              throw new Error("Couldn't save create recovery state on this device.");
            sent = {
              ...write,
              version: `attempt:${write.version}`,
              patch: { ...(write.createAttempt ?? write.patch) },
            };
          }
          await gateway.push(owner, sent);
          if (!valid()) return;
          ws.pending = ws.pending.filter((w) => w.version !== sent.version);
          const newer = ws.pending.find(
            (w) => w.table === sent.table && w.id === sent.id,
          );
          if (sent.operation === "create" && newer?.operation === "create") {
            const patch = Object.fromEntries(
              Object.entries(newer.patch).filter(
                ([field, value]) => !sameValue(sent.patch[field], value, field),
              ),
            );
            if (!Object.keys(patch).length)
              ws.pending = ws.pending.filter((w) => w.version !== newer.version);
            else {
              newer.operation = "update";
              newer.patch = patch;
              newer.base = Object.fromEntries(
                Object.keys(patch).map((field) => [field, sent.patch[field]]),
              );
              newer.createState = undefined;
              newer.createAttempt = undefined;
              newer.recoveryRequired = false;
            }
          } else if (newer?.base)
            for (const field of Object.keys(sent.patch))
              if (field in newer.base) newer.base[field] = sent.patch[field];
          if (!persist()) throw new Error("Couldn't save sync progress on this device.");
        }
        const remote = await gateway.pull(owner);
        if (!valid()) return;
        const merged = { ...ws.data, ...remote };
        for (const table of ["habits", "logs"] as const) {
          const rows = new Map<string, Habit | LogEntry>(
            merged[table].map((row) => [row.id, row] as const),
          );
          for (const write of ws.pending.filter((w) => w.table === table)) {
            if (write.operation === "delete") rows.delete(write.id);
            else {
              const local = ws.data[table].find((row) => row.id === write.id);
              if (local)
                rows.set(write.id, { ...local, ...rows.get(write.id), ...write.patch } as
                  | Habit
                  | LogEntry);
            }
          }
          if (table === "habits") merged.habits = [...rows.values()] as Habit[];
          else merged.logs = [...rows.values()] as LogEntry[];
        }
        const deletedHabits = new Set(
          ws.pending
            .filter((w) => w.table === "habits" && w.operation === "delete")
            .map((w) => w.id),
        );
        merged.logs = merged.logs.filter((log) => !deletedHabits.has(log.habit_id));
        ws.data = merged;
        status(merged);
        persist();
        publish();
        if (ws.pending.length) schedule();
      } catch (error) {
        if (valid())
          status({
            syncStatus: online() ? "error" : "offline",
            pendingCount: ws.pending.length,
            syncError:
              error instanceof Error
                ? error.message
                : "Couldn't sync. Your changes remain on this device.",
          });
      }
    };
    running = task();
    try {
      await running;
    } finally {
      running = null;
    }
  };
  status({ syncFromCloud: sync });
  publish();
  const unsubscribe = store.subscribe((state, previous) => {
    if (muted) return;
    if (state.authRevision !== previous.authRevision) {
      const nextOwner = state.user?.id ?? null;
      if (nextOwner === disk.owner) {
        schedule();
        return;
      }
      generation++;
      const guest = !disk.owner ? workspace() : null;
      disk.owner = nextOwner;
      const ws = (disk.workspaces[keyFor(nextOwner)] ??= { data: empty(), pending: [] });
      if (
        nextOwner &&
        guest &&
        (guest.data.habits.length || guest.data.reflections.length)
      ) {
        const habits = guest.data.habits.map((h) => ({ ...h, user_id: nextOwner }));
        const logs = guest.data.logs.map((l) => ({ ...l, user_id: nextOwner }));
        ws.data = {
          ...guest.data,
          habits: [...ws.data.habits, ...habits],
          logs: [...ws.data.logs, ...logs],
          reflections: [
            ...ws.data.reflections,
            ...guest.data.reflections.map((r) => ({ ...r, user_id: nextOwner })),
          ],
        };
        habits.forEach((h) =>
          enqueue(ws, {
            table: "habits",
            id: h.id,
            operation: "create",
            patch: { ...h },
          }),
        );
        logs.forEach((l) =>
          enqueue(ws, { table: "logs", id: l.id, operation: "create", patch: { ...l } }),
        );
        disk.workspaces.guest = { data: empty(), pending: [] };
      }
      status({ ...ws.data, localOwnerId: nextOwner, syncError: null });
      persist();
      publish();
      schedule();
      return;
    }
    if (
      state.habits === previous.habits &&
      state.logs === previous.logs &&
      state.settings === previous.settings &&
      state.reflections === previous.reflections
    )
      return;
    const ws = workspace();
    if (disk.owner)
      for (const table of ["habits", "logs"] as const) {
        const before = new Map<string, Habit | LogEntry>(
          ws.data[table].map((row) => [row.id, row] as const),
        );
        for (const row of state[table]) {
          const old = before.get(row.id);
          if (!old)
            enqueue(ws, {
              table,
              id: row.id,
              operation: "create",
              patch: { ...row, user_id: disk.owner },
            });
          else if (row !== old) {
            const patch = Object.fromEntries(
              Object.entries(row).filter(
                ([key, value]) =>
                  value !== (old as unknown as Record<string, unknown>)[key],
              ),
            );
            if (Object.keys(patch).length)
              enqueue(ws, {
                table,
                id: row.id,
                operation: "update",
                patch,
                base: Object.fromEntries(
                  Object.keys(patch).map((key) => [
                    key,
                    (old as unknown as Record<string, unknown>)[key],
                  ]),
                ),
              });
          }
          before.delete(row.id);
        }
        for (const [id, row] of before)
          enqueue(ws, {
            table,
            id,
            operation: "delete",
            patch: {},
            base: definedFields(row as unknown as Record<string, unknown>),
          });
      }
    ws.data = snapshot(store);
    persist();
    publish();
    schedule();
  });
  const wake = () => {
    if (document.visibilityState !== "hidden") void sync();
  };
  const wentOffline = () => publish();
  window.addEventListener("online", wake);
  window.addEventListener("offline", wentOffline);
  window.addEventListener("focus", wake);
  document.addEventListener("visibilitychange", wake);
  const interval = setInterval(wake, 30_000);
  return () => {
    stopped = true;
    generation++;
    unsubscribe();
    clearTimeout(timer);
    clearInterval(interval);
    window.removeEventListener("online", wake);
    window.removeEventListener("offline", wentOffline);
    window.removeEventListener("focus", wake);
    document.removeEventListener("visibilitychange", wake);
  };
}
