export type HabitStatus = "active" | "paused" | "archived";
export type WeekStart = "monday" | "sunday" | "saturday";

export interface UserSettings {
  user_id: string;
  week_start_day: WeekStart;
  timezone: string;
  reflection_enabled: boolean;
  reflection_prompts: string[];
  created_at: string;
  updated_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  weekly_goal: number | null;
  unit: string;
  default_increment: number;
  status: HabitStatus;
  created_at: string;
  updated_at: string;
}

export interface LogEntry {
  id: string;
  habit_id: string;
  user_id: string;
  timestamp: string;
  target_date: string;
  amount: number;
  note: string | null;
  created_at: string;
}

export interface ReflectionAnswer {
  prompt: string;
  answer: string;
}

export interface WeeklyReflection {
  id: string;
  user_id: string;
  week_start_date: string;
  answers: ReflectionAnswer[];
  created_at: string;
  updated_at: string;
}

export interface PersistedState {
  settings: UserSettings | null;
  habits: Habit[];
  logs: LogEntry[];
  reflections: WeeklyReflection[];
  schemaVersion: number;
}
