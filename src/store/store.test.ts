import { describe, expect, it, vi } from "vitest";
import { createAppStore } from "./store";

const userId = "user-1";

describe("app store", () => {
  it("sets settings with defaults", () => {
    const store = createAppStore();
    const settings = store.getState().setSettings({
      user_id: userId,
      timezone: "America/New_York",
    });

    expect(settings.week_start_day).toBe("monday");
    expect(settings.reflection_enabled).toBe(false);
    expect(settings.reflection_prompts).toEqual([]);
  });

  it("adds a habit and respects defaults", () => {
    const store = createAppStore();
    store.getState().setSettings({ user_id: userId, timezone: "UTC" });
    const habit = store.getState().addHabit({ user_id: userId, name: "Run" });

    expect(habit.weekly_goal).toBeNull();
    expect(habit.unit).toBe("sessions");
    expect(habit.default_increment).toBe(1);
    expect(store.getState().habits).toHaveLength(1);
  });

  it("adds logs with target_date respecting timezone and week progress ignores paused", () => {
    const store = createAppStore();
    store.getState().setSettings({
      user_id: userId,
      timezone: "America/New_York",
      week_start_day: "sunday",
    });
    const habit = store.getState().addHabit({ user_id: userId, name: "Yoga" });

    const fixedDate = new Date("2025-01-03T03:00:00Z"); // Thursday night ET
    const log = store.getState().addLog({
      habit_id: habit.id,
      user_id: userId,
      amount: 1,
      timestamp: fixedDate,
    });

    expect(log.target_date).toBe("2025-01-02"); // Eastern time still Jan 2
    const progress = store.getState().getWeeklyProgress(habit.id, fixedDate);
    expect(progress).toBe(1);

    store.getState().setHabitStatus(habit.id, "paused");
    const pausedProgress = store.getState().getWeeklyProgress(habit.id, fixedDate);
    expect(pausedProgress).toBe(0);
  });

  it("supports optimistic add with undo for logs", () => {
    const store = createAppStore();
    store.getState().setSettings({ user_id: userId, timezone: "UTC" });
    const habit = store.getState().addHabit({ user_id: userId, name: "Loggable" });

    const { log, undo } = store.getState().addLogWithUndo({
      habit_id: habit.id,
      user_id: userId,
      amount: 1,
      timestamp: new Date("2025-02-01T00:00:00Z"),
    });

    expect(store.getState().logs.some((l) => l.id === log.id)).toBe(true);
    undo();
    expect(store.getState().logs.some((l) => l.id === log.id)).toBe(false);
    // Second undo is a no-op
    undo();
    expect(store.getState().logs).toHaveLength(0);
  });

  it("filters habits by status", () => {
    const store = createAppStore();
    store.getState().setSettings({ user_id: userId, timezone: "UTC" });
    const activeHabit = store.getState().addHabit({ user_id: userId, name: "Run" });
    const pausedHabit = store.getState().addHabit({ user_id: userId, name: "Read" });
    store.getState().setHabitStatus(pausedHabit.id, "paused");

    const activeList = store.getState().getHabits("active");
    const pausedList = store.getState().getHabits("paused");

    expect(activeList.map((h) => h.id)).toEqual([activeHabit.id]);
    expect(pausedList.map((h) => h.id)).toEqual([pausedHabit.id]);
  });

  it("adds and updates reflections", () => {
    const store = createAppStore();
    store.getState().setSettings({ user_id: userId, timezone: "UTC" });
    const reflection = store.getState().addReflection({
      user_id: userId,
      week_start_date: "2025-01-06",
      answers: [{ prompt: "What went well?", answer: "Ran 3 times" }],
    });

    const updated = store
      .getState()
      .updateReflection(reflection.id, [
        { prompt: "What went well?", answer: "Ran 4 times" },
      ]);

    expect(updated?.answers[0].answer).toBe("Ran 4 times");
  });

  it("returns a consistent week range from settings", () => {
    const store = createAppStore();
    store.getState().setSettings({
      user_id: userId,
      timezone: "Asia/Tokyo",
      week_start_day: "sunday",
    });
    const range = store.getState().getWeekRange(new Date("2025-01-03T03:00:00Z"));
    expect(range).toEqual({ start: "2024-12-29", end: "2025-01-04" });
  });

  it("uses deterministic UUIDs in tests when mocked", () => {
    const store = createAppStore();
    const uuidSpy = vi.spyOn(crypto, "randomUUID").mockReturnValue("fixed-id");
    const habit = store.getState().addHabit({ user_id: userId, name: "Swim" });
    expect(habit.id).toBe("fixed-id");
    uuidSpy.mockRestore();
  });

  it("ensures settings when absent by detecting timezone", () => {
    const store = createAppStore();
    const settings = store.getState().ensureSettings(userId);
    expect(settings.user_id).toBe(userId);
    expect(settings.timezone.length).toBeGreaterThan(0);
  });
});
