import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export type WeekStartDay = "sunday" | "monday" | "saturday";

const weekStartMap: Record<WeekStartDay, 0 | 1 | 6> = {
  sunday: 0,
  monday: 1,
  saturday: 6,
};

export function formatTargetDate(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

export function getWeekRange(
  date: Date,
  timezone: string,
  weekStartDay: WeekStartDay = "monday",
): { start: string; end: string } {
  const baseDateStr = formatTargetDate(date, timezone);
  const baseDate = new Date(`${baseDateStr}T00:00:00Z`);
  const weekStartsOn = weekStartMap[weekStartDay];
  const dayOfWeek = baseDate.getUTCDay();
  const diff = (dayOfWeek - weekStartsOn + 7) % 7;
  const start = addDays(baseDate, -diff);
  const end = addDays(start, 6);

  return {
    start: toDateString(start),
    end: toDateString(end),
  };
}

export function addDaysInTimezone(
  date: Date,
  timezone: string,
  days: number,
): string {
  const baseDateStr = formatTargetDate(date, timezone);
  const baseDate = new Date(`${baseDateStr}T00:00:00Z`);
  const shifted = addDays(baseDate, days);
  return toDateString(shifted);
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function detectInitialTimezone(): string {
  if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) return tz;
    } catch {
      // fall through to default
    }
  }
  return DEFAULT_TIMEZONE;
}

const DEFAULT_TIMEZONE = "UTC";
