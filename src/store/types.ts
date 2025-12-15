import { Habit, LogEntry, UserSettings, WeeklyReflection } from "../types/schema";
import { User } from "@supabase/supabase-js";

export interface AppState {
  user: User | null;
  selectedDate: string; // ISO string for the dashboard week selection
  settings: UserSettings | null;
  habits: Habit[];
  logs: LogEntry[];
  reflections: WeeklyReflection[];
}

export type StatusFilter = "active" | "paused" | "archived" | "all";

export interface AddHabitInput {
  user_id: string;
  name: string;
  icon?: string | null;
  weekly_goal?: number | null;
  unit?: string;
  default_increment?: number;
}

export interface UpdateHabitInput
  extends Partial<Omit<AddHabitInput, "user_id" | "name">> {
  name?: string;
}

export interface AddLogInput {
  habit_id: string;
  user_id: string;
  amount: number;
  note?: string | null;
  timestamp?: Date;
}

export interface AddReflectionInput {
  week_start_date: string;
  answers: WeeklyReflection["answers"];
  user_id: string;
}

export interface AddLogWithUndoResult {
  log: LogEntry;
  undo: () => void;
}
