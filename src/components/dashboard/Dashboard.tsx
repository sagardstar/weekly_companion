import { useMemo, useState } from "react";
import { ArrowUpRight, Check, Flower2, Plus, Sprout } from "lucide-react";
import { useAppStore } from "../../store";
import { WeekHeader } from "./WeekHeader";
import { HabitCard } from "./HabitCard";
import { HabitFormModal } from "../habits/HabitFormModal";
import { Habit } from "../../types/schema";

type DashboardProps = {
  onSelectHabit?: (id: string) => void;
  selectedHabitId?: string | null;
  onReflect?: () => void;
};

export function Dashboard({ onSelectHabit, selectedHabitId, onReflect }: DashboardProps) {
  const habits = useAppStore((s) => s.habits);
  const logs = useAppStore((s) => s.logs);
  const getWeekRange = useAppStore((s) => s.getWeekRange);
  const getWeeklyProgress = useAppStore((s) => s.getWeeklyProgress);
  const selectedDate = useAppStore((s) => s.selectedDate);
  const [showModal, setShowModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "paused" | "archived">("all");
  const weekRange = useMemo(
    () => getWeekRange(new Date(selectedDate)),
    [getWeekRange, selectedDate],
  );
  const gridHabits = habits.filter((h) =>
    filter === "all" ? h.status !== "archived" : h.status === filter,
  );
  const active = habits.filter((h) => h.status === "active");
  const weekLogs = logs.filter(
    (l) => l.target_date >= weekRange.start && l.target_date <= weekRange.end,
  );
  const goalHabits = active.filter((h) => h.weekly_goal);
  const completed = goalHabits.filter(
    (h) => getWeeklyProgress(h.id, new Date(selectedDate)) >= h.weekly_goal!,
  ).length;
  const openNew = () => {
    setEditingHabit(null);
    setShowModal(true);
  };

  return (
    <div className="dashboard space-y-7">
      <header className="page-heading">
        <div>
          <p className="eyebrow">A LITTLE CARE, EVERY DAY</p>
          <h1>Your week, at your pace.</h1>
          <p>Make room for the things that make you feel good.</p>
        </div>
        <button onClick={openNew} className="button-primary">
          <Plus size={17} /> New Habit
        </button>
      </header>
      <section className="welcome-banner" aria-label="A gentle reminder">
        <div>
          <span className="eyebrow">SMALL STEPS. MEANINGFUL DAYS.</span>
          <h2>A little progress is still progress.</h2>
          <p>
            You don’t have to do it all. Just keep coming back to what matters to you.
          </p>
          <button onClick={onReflect} className="text-link">
            Take a moment to reflect <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="garden-art" aria-hidden="true">
          <div className="garden-sun" />
          <span className="garden-stem stem-one">
            <Sprout />
          </span>
          <span className="garden-stem stem-two">
            <Flower2 />
          </span>
          <span className="garden-stem stem-three">
            <Sprout />
          </span>
          <div className="garden-ground" />
        </div>
      </section>
      <div className="week-overview">
        <WeekHeader />
        <div className="week-stats">
          <div>
            <strong>{weekLogs.length}</strong>
            <span>check-ins</span>
          </div>
          <div>
            <strong>
              {new Set(weekLogs.map((l) => l.target_date)).size}
              <small> / 7</small>
            </strong>
            <span>days with a little progress</span>
          </div>
          <div>
            <strong>
              {completed}
              <small> / {goalHabits.length}</small>
            </strong>
            <span>
              weekly goals met <Check size={12} />
            </span>
          </div>
        </div>
      </div>
      <div className="habit-section-heading">
        <div>
          <h2>
            Your habits <span>{gridHabits.length}</span>
          </h2>
          <p>A little intention goes a long way.</p>
        </div>
        <div className="habit-filters" aria-label="Filter habits">
          {(["all", "active", "paused", "archived"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value === "all" ? "All habits" : value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {gridHabits.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Sprout size={35} strokeWidth={1.5} />
          </div>
          <h3>
            {habits.length === 0
              ? "What would you like to focus on this week?"
              : `No ${filter === "all" ? "current" : filter} habits here.`}
          </h3>
          <p>
            {habits.length === 0
              ? "Start with one small thing that feels good. You can grow from there."
              : "Your habits can change with you. There’s no rush."}
          </p>
          {habits.length === 0 ? (
            <button onClick={openNew} className="button-primary">
              + Create First Habit
            </button>
          ) : (
            <button className="button-secondary" onClick={() => setFilter("all")}>
              Show all habits
            </button>
          )}
        </div>
      ) : (
        <div className="habit-grid">
          {gridHabits.map((habit) => {
            const count = getWeeklyProgress(habit.id, new Date(selectedDate));
            return (
              <HabitCard
                key={habit.id}
                habit={habit}
                stats={{
                  count,
                  progress: habit.weekly_goal
                    ? Math.min(100, Math.round((count / habit.weekly_goal) * 100))
                    : 0,
                }}
                weeklyLogs={weekLogs.filter((l) => l.habit_id === habit.id)}
                weekStartDate={weekRange.start}
                selected={habit.id === selectedHabitId}
                onSelect={() => onSelectHabit?.(habit.id)}
                onEdit={() => {
                  setEditingHabit(habit);
                  setShowModal(true);
                }}
              />
            );
          })}
        </div>
      )}
      <p className="dashboard-footnote">
        <Sprout size={15} /> Consistency has room for rest days, too.
      </p>
      {showModal && (
        <HabitFormModal
          key={editingHabit?.id ?? "new"}
          isOpen
          onClose={() => setShowModal(false)}
          initialData={editingHabit}
        />
      )}
    </div>
  );
}
