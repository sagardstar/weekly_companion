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
  const start = addCalendarDays(baseDateStr, -diff);
  const end = addCalendarDays(start, 6);

  return {
    start,
    end,
  };
}

export function addDaysInTimezone(date: Date, timezone: string, days: number): string {
  const baseDateStr = formatTargetDate(date, timezone);
  return addCalendarDays(baseDateStr, days);
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

/** Calendar-only values must never shift with the browser's timezone. */
export function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function formatCalendarDate(
  date: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}
