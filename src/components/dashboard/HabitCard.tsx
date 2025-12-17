import { useMemo, useState } from "react";
import { CheckCircle2, Pencil } from "lucide-react";
import { Habit, LogEntry } from "../../types/schema";
import { useAppStore } from "../../store";
import { useToast } from "../ToastProvider";
function addDaysISO(dateStr: string, days: number) {
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(5, 7));
  const day = Number(dateStr.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

type HabitCardProps = {
  habit: Habit;
  stats: { count: number; progress: number };
  weeklyLogs: LogEntry[];
  weekStartDate: string;
  selected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
};

export function HabitCard({
  habit,
  stats,
  weeklyLogs,
  weekStartDate,
  selected,
  onSelect,
  onEdit,
}: HabitCardProps) {
  const addLogWithUndo = useAppStore((s) => s.addLogWithUndo);
  const settings = useAppStore((s) => s.settings);
  const { showToast } = useToast();
  const [customAmount, setCustomAmount] = useState<number>(habit.default_increment);

  const progressPct = habit.weekly_goal
    ? Math.min(100, Math.round((stats.count / habit.weekly_goal) * 100))
    : stats.progress;

  const handleAdd = (amount: number) => {
    const { undo } = addLogWithUndo({
      habit_id: habit.id,
      user_id: settings?.user_id ?? habit.user_id,
      amount,
    });
    showToast({
      message: `Logged ${habit.name}.`,
      actionLabel: "Undo",
      onAction: () => {
        undo();
      },
    });
  };

  const isPaused = habit.status === "paused";
  const isArchived = habit.status === "archived";
  const isActive = habit.status === "active";

  const entriesText = habit.weekly_goal
    ? `${stats.count} / ${habit.weekly_goal} ${habit.unit}`
    : `${stats.count} entries`;

  const statusLabel = habit.status === "active" ? "Active" : habit.status;

  const weeklyDots = useMemo(() => {
    return Array.from({ length: 7 }).map((_, idx) => {
      const dateStr = addDaysISO(weekStartDate, idx);
      return weeklyLogs.some((l) => l.target_date === dateStr);
    });
  }, [weekStartDate, weeklyLogs]);

  return (
    <article
      className={`rounded-2xl bg-white/90 p-4 shadow-soft flex flex-col gap-3 transition ${
        isArchived ? "opacity-50" : ""
      } ${isPaused ? "opacity-70 grayscale-[0.25]" : ""} ${
        selected ? "ring-2 ring-emerald-200" : ""
      }`}
      aria-label={`${habit.name} card`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="h-9 w-9 flex items-center justify-center rounded-full bg-stone-100 text-stone-700 text-lg">
            {habit.icon ?? "🧭"}
          </span>
          <div>
            <p className="text-sm text-stone-500 capitalize">{statusLabel}</p>
            <h3 className="text-lg font-semibold text-stone-900">{habit.name}</h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
            aria-label={`Edit ${habit.name}`}
            className="rounded-full p-1 hover:bg-stone-100 text-stone-500"
          >
            <Pencil size={16} />
          </button>
          <CheckCircle2 className={isActive ? "text-emerald-400" : "text-stone-300"} size={18} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-2 w-full rounded-full bg-stone-100">
          <div
            className={`h-2 rounded-full transition-all ${
              isActive ? "bg-emerald-400" : "bg-stone-300"
            }`}
            style={{ width: `${progressPct || 0}%` }}
          />
        </div>
        <p className="text-sm text-stone-600">{entriesText}</p>
        {!habit.weekly_goal && (
          <div className="flex items-center gap-1" aria-label="Weekly activity dots">
            {weeklyDots.map((hasLog, idx) => (
              <span
                key={idx}
                className={`h-2.5 w-2.5 rounded-full ${
                  hasLog ? (isActive ? "bg-emerald-400" : "bg-stone-400") : "bg-stone-200"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => handleAdd(habit.default_increment)}
        disabled={isPaused || isArchived}
        className="mt-auto w-full rounded-2xl bg-stone-100 py-3 text-stone-800 font-semibold hover:bg-emerald-400 hover:text-stone-900 transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        + Add
      </button>
      <div className="flex flex-col gap-2">
        <label className="text-xs text-stone-600" htmlFor={`custom-${habit.id}`}>
          Custom amount
        </label>
        <div className="flex gap-2">
          <input
            id={`custom-${habit.id}`}
            type="number"
            min={0}
            value={customAmount}
            onChange={(e) => setCustomAmount(Number(e.target.value))}
            aria-label={`Custom amount for ${habit.name}`}
            className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm"
            disabled={isPaused || isArchived}
          />
          <button
            onClick={() => {
              if (customAmount <= 0) return;
              handleAdd(customAmount);
            }}
            disabled={isPaused || isArchived}
            className="rounded-2xl bg-white px-3 py-2 text-stone-800 font-semibold border border-stone-200 hover:bg-emerald-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            + Add custom
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onSelect}
        className={`text-sm underline ${selected ? "text-emerald-600" : "text-stone-600"}`}
      >
        View details
      </button>
    </article>
  );
}
