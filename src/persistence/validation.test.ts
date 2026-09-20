import { describe, expect, it } from "vitest";
import { validateImportPayload } from "./validation";

describe("validateImportPayload", () => {
  it("rejects non-object payloads", () => {
    const result = validateImportPayload(null);
    expect(result.valid).toBe(false);
  });

  it("rejects future schema versions", () => {
    const result = validateImportPayload({
      schemaVersion: 99,
      habits: [],
      logs: [],
      reflections: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("schemaVersion is newer than supported");
  });

  it("accepts minimal valid payload", () => {
    const result = validateImportPayload({
      schemaVersion: 1,
      habits: [],
      logs: [],
      reflections: [],
    });
    expect(result.valid).toBe(true);
  });
});

it("rejects settings that would crash timezone formatting", () => {
  const result = validateImportPayload({
    schemaVersion: 1,
    habits: [],
    logs: [],
    reflections: [],
    settings: {
      week_start_day: "monday",
      timezone: "not/a-timezone",
      reflection_prompts: [],
    },
  });
  expect(result.valid).toBe(false);
  expect(result.errors).toContain("Settings contain an invalid timezone");
});

it("rejects malformed rows instead of allowing a broken dashboard", () => {
  expect(
    validateImportPayload({ schemaVersion: 1, habits: [null], logs: [], reflections: [] })
      .valid,
  ).toBe(false);
  expect(
    validateImportPayload({
      schemaVersion: 1,
      habits: [],
      logs: [
        {
          id: "log",
          habit_id: "habit",
          amount: 1,
          target_date: "2026-02-30",
          timestamp: "2026-02-28T12:00:00Z",
        },
      ],
      reflections: [],
    }).valid,
  ).toBe(false);
});
