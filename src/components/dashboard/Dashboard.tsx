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
    <div className="rounded-2xl bg-white/90 p-6 shadow-soft flex flex-col items-start gap-3">
      <h3 className="text-xl font-semibold text-stone-900">Create your first habit</h3>
      <p className="text-stone-600 text-sm">
        Start with one small habit and build consistency each week.
      </p>
      <button
        onClick={onAdd}
        className="rounded-2xl bg-emerald-400 px-4 py-2 font-semibold text-stone-900 hover:bg-emerald-300 transition"
      >
        Add Habit
      </button>
    </div>
  );
}
