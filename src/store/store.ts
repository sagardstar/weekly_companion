import { createStore } from "zustand/vanilla";
import { supabase } from "../lib/supabase";
import { generateUUID } from "../lib/uuid";
import {
  detectInitialTimezone,
  formatTargetDate,
  getWeekRange,
  WeekStartDay,
} from "../lib/time";
import { User } from "@supabase/supabase-js";
import { HabitStatus, PersistedState, UserSettings } from "../types/schema";
import { AddHabitInput, AddLogInput, AddLogWithUndoResult, AddReflectionInput, AppState, StatusFilter } from "./types";
import { Habit } from "../types/schema";

const DEFAULT_WEEK_START: WeekStartDay = "monday";
const DEFAULT_TIMEZONE = "UTC";

export type AppStore = ReturnType<typeof createAppStore>;

export function createAppStore(initial?: Partial<PersistedState>) {
  const baseState: AppState = {
    user: null,
    selectedDate: new Date().toISOString(),
    settings: initial?.settings ?? null,
    habits: initial?.habits ?? [],
    logs: initial?.logs ?? [],
    reflections: initial?.reflections ?? [],
  };

  return createStore<AppState & Actions>((set, get) => ({
    ...baseState,
    setSettings(settings) {
      const now = new Date().toISOString();
      const merged: UserSettings = {
        user_id: settings.user_id,
        week_start_day: settings.week_start_day ?? DEFAULT_WEEK_START,
        timezone: settings.timezone ?? detectInitialTimezone() ?? DEFAULT_TIMEZONE,
        reflection_enabled: settings.reflection_enabled ?? false,
        reflection_prompts: settings.reflection_prompts ?? [],
        created_at: settings.created_at ?? now,
        updated_at: now,
      };
      set({ settings: merged });
      return merged;
    },
    ensureSettings(user_id: string) {
      const current = get().settings;
      if (current) return current;
      return get().setSettings({
        user_id,
        timezone: detectInitialTimezone(),
        week_start_day: DEFAULT_WEEK_START,
      });
    },
    setSelectedDate(dateIso) {
      set({ selectedDate: dateIso });
    },
    setHabits(habits) {
      set((state) => ({ ...state, habits }));
    },
    setLogs(logs) {
      set((state) => ({ ...state, logs }));
    },
    setUser(user) {
      set({ user });
    },
    addHabit(input) {
      const now = new Date().toISOString();
      const habit = {
        id: generateUUID(),
        user_id: input.user_id,
        name: input.name,
        icon: input.icon ?? null,
        weekly_goal: input.weekly_goal ?? null,
        unit: input.unit ?? "sessions",
        default_increment: input.default_increment ?? 1,
        status: "active" as HabitStatus,
        created_at: now,
        updated_at: now,
      };
      set((state) => ({ habits: [...state.habits, habit] }));
      const currentUser = get().user;
      if (currentUser && supabase && habit.user_id === currentUser.id) {
        void (async () => {
          const { error } = await supabase
            .from("habits")
            .insert({ ...habit, user_id: currentUser.id });
          if (error) console.error("supabase insert habit failed", error);
        })();
      }
      return habit;
    },
    updateHabit(habit) {
      const now = new Date().toISOString();
      const merged: Habit = { ...habit, updated_at: now };
      set((state) => ({
        habits: state.habits.map((h) => (h.id === habit.id ? merged : h)),
      }));
      const currentUser = get().user;
      if (currentUser && supabase && merged.user_id === currentUser.id) {
        void (async () => {
          const { error } = await supabase
            .from("habits")
            .update({ ...merged, user_id: currentUser.id })
            .eq("id", habit.id);
          if (error) console.error("supabase update habit failed", error);
        })();
      }
      return merged;
    },
    setHabitStatus(id, status) {
      const existing = get().habits.find((h) => h.id === id);
      if (!existing) return null;
      return get().updateHabit({ ...existing, status });
    },
    addLog(input) {
      const settings = get().settings;
      const now = input.timestamp ?? new Date();
      const timezone = settings?.timezone ?? DEFAULT_TIMEZONE;
      const target_date = formatTargetDate(now, timezone);
      const log = {
        id: generateUUID(),
        habit_id: input.habit_id,
        user_id: input.user_id,
        timestamp: now.toISOString(),
        target_date,
        amount: input.amount,
        note: input.note ?? null,
        created_at: now.toISOString(),
      };
      set((state) => ({ logs: [...state.logs, log] }));
      const currentUser = get().user;
      if (currentUser && supabase && log.user_id === currentUser.id) {
        void (async () => {
          const { error } = await supabase
            .from("logs")
            .insert({ ...log, user_id: currentUser.id });
          if (error) console.error("supabase insert log failed", error);
        })();
      }
      return log;
    },
    addLogWithUndo(input) {
      const log = get().addLog(input);
      const undo = () => {
        const exists = get().logs.some((l) => l.id === log.id);
        if (exists) {
          get().deleteLog(log.id);
        }
      };
      return { log, undo };
    },
    deleteLog(id) {
      set((state) => ({ logs: state.logs.filter((l) => l.id !== id) }));
      const currentUser = get().user;
      if (currentUser && supabase) {
        void (async () => {
          const { error } = await supabase.from("logs").delete().eq("id", id);
          if (error) console.error("supabase delete log failed", error);
        })();
      }
    },
    addReflection(input) {
      const now = new Date().toISOString();
      const reflection = {
        id: generateUUID(),
        user_id: input.user_id,
        week_start_date: input.week_start_date,
        answers: input.answers,
        created_at: now,
        updated_at: now,
      };
      set((state) => ({ reflections: [...state.reflections, reflection] }));
      return reflection;
    },
    updateReflection(id, answers) {
      const now = new Date().toISOString();
      set((state) => ({
        reflections: state.reflections.map((r) =>
          r.id === id ? { ...r, answers, updated_at: now } : r,
        ),
      }));
      return get().reflections.find((r) => r.id === id) ?? null;
    },
    replaceState(state) {
      set({
        settings: state.settings,
        habits: state.habits,
        logs: state.logs,
        reflections: state.reflections,
      });
    },
    deleteHabit(habitId) {
      set((state) => ({
        habits: state.habits.filter((h) => h.id !== habitId),
        logs: state.logs.filter((l) => l.habit_id !== habitId),
      }));
      const currentUser = get().user;
      if (currentUser && supabase) {
        void (async () => {
          const { error } = await supabase.from("habits").delete().eq("id", habitId);
          if (error) console.error("supabase delete habit failed", error);
        })();
      }
    },
    async migrateGuestData(userId) {
      const state = get();
      const guestHabits = state.habits.map((h) => ({ ...h, user_id: userId }));
      const guestLogs = state.logs.map((l) => ({ ...l, user_id: userId }));
      if (supabase && guestHabits.length > 0) {
        const { error } = await supabase
          .from("habits")
          .upsert(guestHabits, { onConflict: "id", ignoreDuplicates: true });
        if (error) console.error("supabase upsert habits failed", error);
      }
      if (supabase && guestLogs.length > 0) {
        const { error } = await supabase
          .from("logs")
          .upsert(guestLogs, { onConflict: "id", ignoreDuplicates: true });
        if (error) console.error("supabase upsert logs failed", error);
      }
    },
    async syncFromCloud() {
      const user = get().user;
      if (!user || !supabase) return;
      const [{ data: habitsData, error: habitsError }, { data: logsData, error: logsError }] =
        await Promise.all([
          supabase.from("habits").select("*").eq("user_id", user.id),
          supabase.from("logs").select("*").eq("user_id", user.id),
        ]);
      if (habitsError) console.error("supabase fetch habits failed", habitsError);
      if (logsError) console.error("supabase fetch logs failed", logsError);
      if (!habitsError && !logsError) {
        get().setHabits(habitsData ?? []);
        get().setLogs(logsData ?? []);
      }
    },
    getHabits(filter = "all") {
      const habits = get().habits;
      if (filter === "all") return habits;
      return habits.filter((h) => h.status === filter);
    },
    getWeekRange(referenceDate = new Date()) {
      const settings = get().settings;
      const timezone = settings?.timezone ?? DEFAULT_TIMEZONE;
      const weekStart = (settings?.week_start_day ?? DEFAULT_WEEK_START) as WeekStartDay;
      return getWeekRange(referenceDate, timezone, weekStart);
    },
    getWeeklyProgress(habitId, referenceDate = new Date()) {
      const settings = get().settings;
      const timezone = settings?.timezone ?? DEFAULT_TIMEZONE;
      const weekStart = (settings?.week_start_day ?? DEFAULT_WEEK_START) as WeekStartDay;
      const { start, end } = getWeekRange(referenceDate, timezone, weekStart);
      const habit = get().habits.find((h) => h.id === habitId);
      if (habit?.status === "paused") return 0;
      return get()
        .logs.filter(
          (log) =>
            log.habit_id === habitId &&
            log.target_date >= start &&
            log.target_date <= end,
        )
        .reduce((sum, log) => sum + log.amount, 0);
    },
  }));
}

interface Actions {
  setSettings(settings: Partial<UserSettings> & { user_id: string }): UserSettings;
  ensureSettings(user_id: string): UserSettings;
  setSelectedDate(dateIso: string): void;
  setHabits(habits: AppState["habits"]): void;
  setLogs(logs: AppState["logs"]): void;
  setUser(user: User | null): void;
  addHabit(input: AddHabitInput): HabitWithId;
  updateHabit(habit: Habit): HabitWithId | null;
  setHabitStatus(id: string, status: HabitStatus): HabitWithId | null;
  addLog(input: AddLogInput): LogWithId;
  addLogWithUndo(input: AddLogInput): AddLogWithUndoResult;
  deleteLog(id: string): void;
  deleteHabit(habitId: string): void;
  replaceState(state: PersistedState): void;
  migrateGuestData(userId: string): Promise<void>;
  syncFromCloud(): Promise<void>;
  addReflection(input: AddReflectionInput): WeeklyReflectionWithId;
  updateReflection(id: string, answers: WeeklyReflectionWithId["answers"]):
    | WeeklyReflectionWithId
    | null;
  getHabits(filter?: StatusFilter): HabitWithId[];
  getWeekRange(referenceDate?: Date): { start: string; end: string };
  getWeeklyProgress(habitId: string, referenceDate?: Date): number;
}

type HabitWithId = AppState["habits"][number];
type LogWithId = AppState["logs"][number];
type WeeklyReflectionWithId = AppState["reflections"][number];
