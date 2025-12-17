import { addDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAppStore } from "../../store";

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatMonthDay(dateStr: string) {
  // dateStr is YYYY-MM-DD; treat as a pure calendar date to avoid timezone shifts.
  const month = Number(dateStr.slice(5, 7));
  const day = Number(dateStr.slice(8, 10));
  const monthLabel = MONTHS_SHORT[month - 1] ?? "";
  return `${monthLabel} ${day}`;
}

export function WeekHeader() {
  const selectedDate = useAppStore((s) => s.selectedDate);
  const setSelectedDate = useAppStore((s) => s.setSelectedDate);
  const getWeekRange = useAppStore((s) => s.getWeekRange);

  const currentDate = new Date(selectedDate);
  const range = getWeekRange(currentDate);

  const weekLabel = `${formatMonthDay(range.start)} - ${formatMonthDay(range.end)}`;

  const shiftWeek = (days: number) => {
    const next = addDays(currentDate, days);
    setSelectedDate(next.toISOString());
  };

  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/80 px-4 py-3 shadow-soft">
      <div>
        <p className="text-xs uppercase tracking-wide text-stone-500">Week</p>
        <h2 className="text-xl font-semibold text-stone-900">{weekLabel}</h2>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => shiftWeek(-7)}
          className="p-2 rounded-full bg-stone-100 text-stone-700 hover:bg-stone-200"
          aria-label="Previous week"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => shiftWeek(7)}
          className="p-2 rounded-full bg-stone-100 text-stone-700 hover:bg-stone-200"
          aria-label="Next week"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
