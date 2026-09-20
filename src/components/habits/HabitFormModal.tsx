import { useEffect, useRef, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { Habit } from "../../types/schema";
import { useAppStore } from "../../store";
import { useToast } from "../ToastProvider";

type HabitFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Habit | null;
};

const defaultUnit = "sessions";
const ICON_CHOICES = [
  "🌱",
  "☀️",
  "🏃",
  "🏋️",
  "🧘",
  "📚",
  "✍️",
  "🎸",
  "🎹",
  "🎨",
  "🧠",
  "💧",
  "🥗",
  "🛌",
  "🧹",
  "🧘‍♂️",
  "🧘‍♀️",
  "🚶",
  "🧗",
  "🚴",
  "🧑‍💻",
  "🗓️",
  "📈",
  "🧊",
  "🍎",
] as const;

export function HabitFormModal({ isOpen, onClose, initialData }: HabitFormModalProps) {
  const addHabit = useAppStore((s) => s.addHabit);
  const updateHabit = useAppStore((s) => s.updateHabit);
  const deleteHabit = useAppStore((s) => s.deleteHabit);
  const settings = useAppStore((s) => s.settings);

  const [name, setName] = useState(initialData?.name ?? "");
  const [icon, setIcon] = useState(initialData?.icon ?? "🧭");
  const [goal, setGoal] = useState<number | "">(
    initialData &&
      initialData.weekly_goal !== null &&
      initialData.weekly_goal !== undefined
      ? initialData.weekly_goal
      : "",
  );
  const [unit, setUnit] = useState(initialData?.unit ?? defaultUnit);

  const { showToast } = useToast();
  const dialogRef = useRef<HTMLFormElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [increment, setIncrement] = useState(initialData?.default_increment ?? 1);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select, textarea, [tabindex="0"]',
        ) ?? [],
      );
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isEdit = Boolean(initialData);
  const weeklyGoal = goal === "" ? null : Number(goal);
  const selectedIcon = (icon && icon.trim().length > 0 ? icon : "🧭").trim();

  const handleSave = () => {
    if (
      !name.trim() ||
      !Number.isFinite(increment) ||
      increment <= 0 ||
      (weeklyGoal !== null && (!Number.isFinite(weeklyGoal) || weeklyGoal <= 0))
    )
      return;
    if (isEdit && initialData) {
      updateHabit({
        ...initialData,
        name: name.trim(),
        icon: selectedIcon || null,
        weekly_goal: weeklyGoal,
        unit: unit.trim() || defaultUnit,
        default_increment: increment,
      });
    } else {
      addHabit({
        user_id: settings?.user_id ?? "demo-user",
        name: name.trim(),
        icon: selectedIcon || null,
        weekly_goal: weeklyGoal,
        unit: unit.trim() || defaultUnit,
        default_increment: increment,
      });
    }
    showToast({
      message: isEdit
        ? "Habit updated. Make it work for you."
        : "A small beginning. Your habit is ready.",
    });
    onClose();
  };

  const handleDelete = () => {
    if (!initialData) return;

    deleteHabit(initialData.id);
    onClose();
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        ref={dialogRef}
        onSubmit={(event) => {
          event.preventDefault();
          handleSave();
        }}
        className="habit-dialog w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-stone-200 space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="habit-form-title"
      >
        <div className="flex items-center justify-between">
          <h3 id="habit-form-title" className="text-lg font-semibold text-stone-900">
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

        <p className="text-sm text-stone-500">
          {isEdit
            ? "Your habits can change with you."
            : "Start small. Choose something you’d like a little more of."}
        </p>
        <div className="space-y-3">
          <label className="text-sm text-stone-700 flex flex-col gap-1">
            Name
            <input
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
              placeholder="e.g., Morning Run"
            />
          </label>

          <div className="text-sm text-stone-700 flex flex-col gap-1">
            <label htmlFor="habit-icon">Icon (emoji)</label>
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-full bg-stone-100 flex items-center justify-center text-lg text-stone-700"
                aria-label={`Selected icon ${selectedIcon}`}
              >
                {selectedIcon}
              </div>
              <input
                id="habit-icon"
                value={icon ?? ""}
                onChange={(e) => setIcon(e.target.value)}
                className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm"
                placeholder="Type an emoji (optional)"
              />
            </div>
            <div className="icon-choices mt-2 grid gap-2">
              {ICON_CHOICES.map((choice) => {
                const isSelected = choice === selectedIcon;
                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setIcon(choice)}
                    aria-label={`Select icon ${choice}`}
                    aria-pressed={isSelected}
                    className={`h-9 w-9 rounded-xl border text-lg flex items-center justify-center transition ${
                      isSelected
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-white border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="text-sm text-stone-700 flex flex-col gap-1">
            Weekly goal (optional)
            <input
              type="number"
              min="0.01"
              step="any"
              value={goal}
              onChange={(e) =>
                setGoal(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
              placeholder="e.g., 3"
              aria-describedby="goal-help"
            />
          </label>

          <p id="goal-help" className="text-xs text-stone-500">
            Leave this blank to simply check in, without a target.
          </p>
          <label className="text-sm text-stone-700 flex flex-col gap-1">
            Unit
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
              placeholder="sessions"
            />
          </label>
          <label className="text-sm text-stone-700 flex flex-col gap-1">
            Quick-add amount
            <input
              type="number"
              min="0.01"
              step="any"
              required
              value={increment}
              onChange={(event) => setIncrement(Number(event.target.value))}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
        {confirmDelete && (
          <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
            <p>
              Delete “{initialData?.name}” and all its check-ins? This cannot be undone.
              You can archive it from its details to keep your history.
            </p>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setConfirmDelete(false)}
              >
                Keep habit
              </button>
              <button type="button" onClick={handleDelete}>
                Delete permanently
              </button>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between pt-2">
          {isEdit ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
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
            <button type="submit" disabled={!name.trim()} className="button-primary">
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
