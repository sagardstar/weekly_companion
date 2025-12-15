import { useState } from "react";
import { X } from "lucide-react";
import { useAppStore } from "../../store";

type CreateHabitModalProps = {
  open: boolean;
  onClose: () => void;
};

export function CreateHabitModal({ open, onClose }: CreateHabitModalProps) {
  const addHabit = useAppStore((s) => s.addHabit);
  const settings = useAppStore((s) => s.settings);
  const user = useAppStore((s) => s.user);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🧭");
  const [goal, setGoal] = useState<number | null>(3);
  const [unit, setUnit] = useState("sessions");

  if (!open) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    addHabit({
      user_id: user?.id ?? settings?.user_id ?? "local-user",
      name: name.trim(),
      icon,
      weekly_goal: goal,
      unit,
      default_increment: 1,
    });
    onClose();
    setName("");
    setGoal(3);
    setUnit("sessions");
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-soft space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-stone-900">Create Habit</h3>
          <button onClick={onClose} aria-label="Close modal" className="text-stone-500">
            <X size={20} />
          </button>
        </div>
        <label className="flex flex-col gap-1 text-sm text-stone-700">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-stone-200 px-3 py-2"
            placeholder="Habit name"
          />
        </label>
        <div className="flex gap-3">
          <label className="flex-1 flex flex-col gap-1 text-sm text-stone-700">
            Icon (emoji)
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="rounded-xl border border-stone-200 px-3 py-2"
              maxLength={2}
            />
          </label>
          <label className="flex-1 flex flex-col gap-1 text-sm text-stone-700">
            Weekly Goal
            <input
              type="number"
              value={goal ?? ""}
              onChange={(e) => setGoal(e.target.value ? Number(e.target.value) : null)}
              className="rounded-xl border border-stone-200 px-3 py-2"
              min={0}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm text-stone-700">
          Unit
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="rounded-xl border border-stone-200 px-3 py-2"
            placeholder="sessions, minutes, etc."
          />
        </label>
        <button
          onClick={handleSave}
          className="w-full rounded-2xl bg-emerald-400 py-3 font-semibold text-stone-900 hover:bg-emerald-300 transition"
        >
          Add Habit
        </button>
      </div>
    </div>
  );
}
