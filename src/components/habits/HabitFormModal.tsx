import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { Habit } from "../../types/schema";
import { useAppStore } from "../../store";

type HabitFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Habit | null;
};

const defaultUnit = "sessions";

export function HabitFormModal({ isOpen, onClose, initialData }: HabitFormModalProps) {
  const addHabit = useAppStore((s) => s.addHabit);
  const updateHabit = useAppStore((s) => s.updateHabit);
  const deleteHabit = useAppStore((s) => s.deleteHabit);
  const settings = useAppStore((s) => s.settings);

  const [name, setName] = useState(initialData?.name ?? "");
  const [icon, setIcon] = useState(initialData?.icon ?? "🧭");
  const [goal, setGoal] = useState<number | "">(
    initialData && initialData.weekly_goal !== null && initialData.weekly_goal !== undefined
      ? initialData.weekly_goal
      : "",
  );
  const [unit, setUnit] = useState(initialData?.unit ?? defaultUnit);

  if (!isOpen) return null;

  const isEdit = Boolean(initialData);
  const weeklyGoal = goal === "" ? null : Number(goal);

  const handleSave = () => {
    if (!name.trim()) return;
    if (isEdit && initialData) {
      updateHabit({
        ...initialData,
        name: name.trim(),
        icon: icon || null,
        weekly_goal: weeklyGoal,
        unit: unit.trim() || defaultUnit,
      });
    } else {
      addHabit({
        user_id: settings?.user_id ?? "demo-user",
        name: name.trim(),
        icon: icon || null,
        weekly_goal: weeklyGoal,
        unit: unit.trim() || defaultUnit,
        default_increment: 1,
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (!initialData) return;
    const confirmed = window.confirm("Delete this habit? Logs will be kept locally cleared.");
    if (!confirmed) return;
    deleteHabit(initialData.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-stone-200 space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-stone-900">
            {isEdit ? "Edit Habit" : "New Habit"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 hover:bg-stone-100 text-stone-500"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <label className="text-sm text-stone-700 flex flex-col gap-1">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
              placeholder="e.g., Morning Run"
            />
          </label>

          <label className="text-sm text-stone-700 flex flex-col gap-1">
            Icon (emoji)
            <input
              value={icon ?? ""}
              onChange={(e) => setIcon(e.target.value)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
              placeholder="😀"
            />
          </label>

          <label className="text-sm text-stone-700 flex flex-col gap-1">
            Weekly goal
            <input
              type="number"
              min={0}
              value={goal}
              onChange={(e) => setGoal(e.target.value === "" ? "" : Number(e.target.value))}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
              placeholder="3"
            />
          </label>

          <label className="text-sm text-stone-700 flex flex-col gap-1">
            Unit
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
              placeholder="sessions"
            />
          </label>
        </div>

        <div className="flex items-center justify-between pt-2">
          {isEdit ? (
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
            >
              <Trash2 size={16} /> Delete Habit
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-stone-200 px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-emerald-300"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
