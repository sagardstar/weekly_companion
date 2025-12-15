import { describe, expect, it } from "vitest";
import {
  addDaysInTimezone,
  detectInitialTimezone,
  formatTargetDate,
  getWeekRange,
} from "./time";

describe("time utilities", () => {
  it("formats target date using the provided timezone", () => {
    const utcDate = new Date("2025-01-01T02:30:00Z");
    const result = formatTargetDate(utcDate, "America/New_York");
    expect(result).toBe("2024-12-31");
  });

  it("computes week range using week start day (monday)", () => {
    const utcDate = new Date("2025-01-01T12:00:00Z"); // Wednesday
    const range = getWeekRange(utcDate, "America/New_York", "monday");
    expect(range).toEqual({ start: "2024-12-30", end: "2025-01-05" });
  });

  it("computes week range using week start day (sunday)", () => {
    const utcDate = new Date("2025-01-03T03:00:00Z"); // Friday JST
    const range = getWeekRange(utcDate, "Asia/Tokyo", "sunday");
    expect(range).toEqual({ start: "2024-12-29", end: "2025-01-04" });
  });

  it("adds days within timezone and returns the target date string", () => {
    const utcDate = new Date("2025-06-15T22:00:00Z");
    const target = addDaysInTimezone(utcDate, "Europe/London", 2);
    expect(target).toBe("2025-06-17");
  });

  it("detects initial timezone or falls back to UTC", () => {
    const tz = detectInitialTimezone();
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });
});
