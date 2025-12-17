import { useMemo, useState } from "react";
import { useAppStore } from "../../store";
import { WeekHeader } from "./WeekHeader";
import { HabitCard } from "./HabitCard";
import { HabitFormModal } from "../habits/HabitFormModal";
import { Habit } from "../../types/schema";

type DashboardProps = {
  onSelectHabit?: (id: string) => void;
  selectedHabitId?: string | null;
};

export function Dashboard({ onSelectHabit, selectedHabitId }: DashboardProps) {
  const habits = useAppStore((s) => s.habits);
  const logs = useAppStore((s) => s.logs);
  const getWeekRange = useAppStore((s) => s.getWeekRange);
  const getWeeklyProgress = useAppStore((s) => s.getWeeklyProgress);
  const selectedDate = useAppStore((s) => s.selectedDate);
  const [showModal, setShowModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  const weekRange = useMemo(
    () => getWeekRange(new Date(selectedDate)),
    [getWeekRange, selectedDate],
  );

  const gridHabits = habits.filter((h) => h.status !== "archived");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <WeekHeader />
        <button
          onClick={() => {
            setEditingHabit(null);
            setShowModal(true);
          }}
          className="self-start rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-emerald-300 transition"
        >
          New Habit
        </button>
      </div>
      {gridHabits.length === 0 ? (
        <EmptyState
          onAdd={() => {
            setEditingHabit(null);
            setShowModal(true);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gridHabits.map((habit) => {
            const count = getWeeklyProgress(habit.id, new Date(selectedDate));
            const goal = habit.weekly_goal;
            const progress = goal ? Math.min(100, Math.round((count / goal) * 100)) : 0;
            const weeklyLogs = logs.filter(
              (l) =>
                l.habit_id === habit.id &&
                l.target_date >= weekRange.start &&
                l.target_date <= weekRange.end,
            );
            return (
              <HabitCard
                key={habit.id}
                habit={habit}
                stats={{ count, progress }}
                weeklyLogs={weeklyLogs}
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
      <HabitFormModal
        key={editingHabit?.id ?? "new"}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        initialData={editingHabit}
      />
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl bg-white/90 p-8 shadow-soft border border-stone-200 overflow-hidden relative">
      <div
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(231,229,228,0.35) 1px, transparent 1px)",
          backgroundSize: "100% 28px",
        }}
      />
      <div className="relative flex flex-col items-center text-center gap-3">
        <div className="h-16 w-16 rounded-2xl bg-emerald-50 flex items-center justify-center shadow-soft">
          <span className="text-3xl" aria-hidden="true">
            🌱
          </span>
        </div>
        <h3 className="text-2xl font-semibold text-stone-900">
          What would you like to focus on this week?
        </h3>
        <p className="text-stone-600 text-sm max-w-sm">
          Start small. You can always add more later.
        </p>
        <button
          onClick={onAdd}
          className="mt-2 rounded-2xl bg-emerald-400 px-5 py-2.5 font-semibold text-stone-900 hover:bg-emerald-300 transition shadow-soft"
        >
          + Create First Habit
        </button>
      </div>
    </div>
  );
}
