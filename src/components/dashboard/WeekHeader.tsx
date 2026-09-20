import { addDays } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useAppStore } from "../../store";
import { formatCalendarDate } from "../../lib/time";

export function WeekHeader() {
  const selectedDate = useAppStore((s) => s.selectedDate);
  const setSelectedDate = useAppStore((s) => s.setSelectedDate);
  const getWeekRange = useAppStore((s) => s.getWeekRange);
  const range = getWeekRange(new Date(selectedDate));
  const current = getWeekRange().start === range.start;
  return (
    <div className="week-picker">
      <div className="week-picker-title">
        <CalendarDays size={17} />
        <span>{current ? "THIS WEEK" : "YOUR WEEK"}</span>
        {!current && (
          <button
            onClick={() => setSelectedDate(new Date().toISOString())}
            className="text-link"
          >
            Back to today
          </button>
        )}
      </div>
      <div className="week-picker-controls">
        <h2>
          {formatCalendarDate(range.start)} – {formatCalendarDate(range.end)}
          <small>
            {range.start.slice(0, 4) !== range.end.slice(0, 4)
              ? `${range.start.slice(0, 4)} / `
              : ""}
            {range.end.slice(0, 4)}
          </small>
        </h2>
        <div className="flex gap-1">
          <button
            className="icon-button"
            aria-label="Previous week"
            onClick={() =>
              setSelectedDate(addDays(new Date(selectedDate), -7).toISOString())
            }
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Next week"
            onClick={() =>
              setSelectedDate(addDays(new Date(selectedDate), 7).toISOString())
            }
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
