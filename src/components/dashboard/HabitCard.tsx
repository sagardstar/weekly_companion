import { useState } from "react";
import { ArrowRight, Check, Pencil, RotateCcw } from "lucide-react";
import { Habit, LogEntry } from "../../types/schema";
import { useAppStore } from "../../store";
import { useToast } from "../ToastProvider";
import { addCalendarDays, formatCalendarDate, formatTargetDate } from "../../lib/time";

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
  const setHabitStatus = useAppStore((s) => s.setHabitStatus);
  const settings = useAppStore((s) => s.settings);
  const { showToast } = useToast();
  const [customAmount, setCustomAmount] = useState(String(habit.default_increment));
  const isActive = habit.status === "active";
  const complete = Boolean(habit.weekly_goal && stats.count >= habit.weekly_goal);
  const today = formatTargetDate(new Date(), settings?.timezone ?? "UTC");
  const isCurrentWeek =
    today >= weekStartDate && today <= addCalendarDays(weekStartDate, 6);
  const handleAdd = (amount: number) => {
    if (!isActive || !Number.isFinite(amount) || amount <= 0) return;
    const { undo } = addLogWithUndo({
      habit_id: habit.id,
      user_id: settings?.user_id ?? habit.user_id,
      amount,
      target_date: today,
    });
    showToast({
      message: `Logged ${habit.name}. A little step forward.`,
      actionLabel: "Undo",
      onAction: undo,
    });
  };
  return (
    <article
      className={`habit-card ${!isActive ? "habit-resting" : ""} ${selected ? "habit-selected" : ""}`}
      aria-label={`${habit.name} card`}
    >
      <div className="habit-card-top">
        <span className="habit-icon" aria-hidden="true">
          {habit.icon ?? "🌱"}
        </span>
        <span className={`habit-badge ${complete ? "complete" : ""}`}>
          {!isActive ? (
            habit.status
          ) : complete ? (
            <>
              <Check size={12} /> Goal met
            </>
          ) : habit.weekly_goal ? (
            "Weekly intention"
          ) : (
            "At your own pace"
          )}
        </span>
        <button
          onClick={onEdit}
          aria-label={`Edit ${habit.name}`}
          className="icon-button"
        >
          <Pencil size={15} />
        </button>
      </div>
      <h3>{habit.name}</h3>
      <p className="habit-count">
        {habit.weekly_goal
          ? `${stats.count} / ${habit.weekly_goal} ${habit.unit}`
          : `${stats.count} ${habit.unit}`}
        <span> this week</span>
      </p>
      {habit.weekly_goal ? (
        <div
          className="progress-track"
          role="progressbar"
          aria-label={`${habit.name} weekly progress`}
          aria-valuenow={Math.min(stats.count, habit.weekly_goal)}
          aria-valuemin={0}
          aria-valuemax={habit.weekly_goal}
        >
          <div style={{ width: `${Math.max(0, stats.progress)}%` }} />
        </div>
      ) : (
        <p className="no-goal-caption">Every check-in counts. No target needed.</p>
      )}
      <div className="activity-week" aria-label="Weekly activity">
        {Array.from({ length: 7 }, (_, i) => {
          const date = addCalendarDays(weekStartDate, i);
          const hasLog = weeklyLogs.some((l) => l.target_date === date);
          return (
            <div
              key={date}
              title={`${formatCalendarDate(date)}: ${hasLog ? "Checked in" : "No check-in"}`}
              className={date === today ? "activity-today" : ""}
            >
              <span>{formatCalendarDate(date, { weekday: "narrow" })}</span>
              <span className={`activity-dot ${hasLog ? "has-activity" : ""}`}>
                {hasLog ? <Check size={12} /> : ""}
              </span>
            </div>
          );
        })}
      </div>
      {isCurrentWeek ? (
        <button
          onClick={() => handleAdd(habit.default_increment)}
          disabled={!isActive}
          className="quick-add"
        >
          + Add{" "}
          <span>
            {habit.default_increment} {habit.unit} today
          </span>
        </button>
      ) : (
        <button onClick={onSelect} disabled={!isActive} className="quick-add">
          Log for this week <ArrowRight size={15} />
        </button>
      )}
      {isCurrentWeek && (
        <details className="custom-entry">
          <summary>Custom amount</summary>
          <div className="flex gap-2 pt-2">
            <input
              type="number"
              min="0.01"
              step="any"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              aria-label={`Custom amount for ${habit.name}`}
              disabled={!isActive}
            />
            <button
              onClick={() => handleAdd(Number(customAmount))}
              disabled={
                !isActive ||
                !Number.isFinite(Number(customAmount)) ||
                Number(customAmount) <= 0
              }
              className="button-secondary"
            >
              + Add custom
            </button>
          </div>
        </details>
      )}
      <div className="habit-card-footer">
        <button onClick={onSelect} className="text-link">
          View details <ArrowRight size={14} />
        </button>
        {!isActive && (
          <button
            className="text-link"
            onClick={() => {
              setHabitStatus(habit.id, "active");
              showToast({ message: `${habit.name} is ready when you are.` });
            }}
          >
            <RotateCcw size={13} /> {habit.status === "archived" ? "Restore" : "Resume"}
          </button>
        )}
      </div>
    </article>
  );
}
