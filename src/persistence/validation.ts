import { PersistedState } from "../types/schema";
import { SCHEMA_VERSION } from "./schema";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateImportPayload(payload: unknown): ValidationResult {
  const errors: string[] = [];

  if (!payload || typeof payload !== "object") {
    return { valid: false, errors: ["Payload must be an object"] };
  }

  const data = payload as Partial<PersistedState>;

  if (typeof data.schemaVersion !== "number") {
    errors.push("schemaVersion is missing or invalid");
  } else if (data.schemaVersion > SCHEMA_VERSION) {
    errors.push("schemaVersion is newer than supported");
  }

  if (!Array.isArray(data.habits)) errors.push("habits must be an array");
  if (!Array.isArray(data.logs)) errors.push("logs must be an array");
  if (!Array.isArray(data.reflections)) errors.push("reflections must be an array");

  const record = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const text = (value: unknown) => typeof value === "string" && value.trim().length > 0;
  const positive = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value > 0;
  const date = (value: unknown) =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (data.settings != null) {
    const settings = data.settings;
    if (
      !record(settings) ||
      !["monday", "sunday", "saturday"].includes(settings.week_start_day) ||
      !text(settings.timezone) ||
      !Array.isArray(settings.reflection_prompts) ||
      !settings.reflection_prompts.every((prompt) => typeof prompt === "string")
    ) {
      errors.push("Settings are incomplete or invalid");
    } else {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone }).format();
      } catch {
        errors.push("Settings contain an invalid timezone");
      }
    }
  }
  if (
    Array.isArray(data.habits) &&
    data.habits.some(
      (habit) =>
        !record(habit) ||
        !text(habit.id) ||
        !text(habit.name) ||
        !text(habit.unit) ||
        (habit.icon != null && typeof habit.icon !== "string") ||
        !positive(habit.default_increment) ||
        (habit.weekly_goal != null &&
          habit.weekly_goal !== 0 &&
          !positive(habit.weekly_goal)) ||
        !["active", "paused", "archived"].includes(habit.status),
    )
  ) {
    errors.push("Each habit needs a name, unit, valid status, and positive amounts");
  }
  if (
    Array.isArray(data.logs) &&
    data.logs.some(
      (log) =>
        !record(log) ||
        !text(log.id) ||
        !text(log.habit_id) ||
        !date(log.target_date) ||
        !positive(log.amount) ||
        !text(log.timestamp) ||
        (log.note != null && typeof log.note !== "string"),
    )
  ) {
    errors.push("Each check-in needs a valid date, habit, and positive amount");
  }
  if (
    Array.isArray(data.reflections) &&
    data.reflections.some(
      (reflection) =>
        !record(reflection) ||
        !text(reflection.id) ||
        !date(reflection.week_start_date) ||
        !Array.isArray(reflection.answers) ||
        reflection.answers.some(
          (answer) =>
            !record(answer) || !text(answer.prompt) || typeof answer.answer !== "string",
        ),
    )
  ) {
    errors.push("Reflections contain an invalid date or answer");
  }
  return { valid: errors.length === 0, errors };
}
