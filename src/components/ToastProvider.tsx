import { X } from "lucide-react";
import { createContext, useEffect, ReactNode, useContext, useRef, useState } from "react";

interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
}

interface ToastState extends ToastOptions {
  id: number;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const showToast = (options: ToastOptions) => {
    clearTimer();
    const nextId = idRef.current + 1;
    idRef.current = nextId;
    const nextToast: ToastState = { id: nextId, ...options };
    setToast(nextToast);
    const duration = options.durationMs ?? 6500;
    timerRef.current = setTimeout(() => {
      setToast(null);
    }, duration);
  };

  const resumeTimer = () => {
    clearTimer();
    timerRef.current = setTimeout(() => setToast(null), toast?.durationMs ?? 6500);
  };

  const handleAction = () => {
    if (toast?.onAction) toast.onAction();
    setToast(null);
    clearTimer();
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          className="toast-region fixed bottom-4 inset-x-0 flex justify-center px-4 pointer-events-none"
          role="status"
          aria-live="polite"
          onMouseEnter={clearTimer}
          onFocus={clearTimer}
          onMouseLeave={resumeTimer}
          onBlur={resumeTimer}
        >
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-slate-900 text-sand-50 shadow-soft px-4 py-3">
            <span className="text-sm">{toast.message}</span>
            {toast.actionLabel && (
              <button
                onClick={handleAction}
                className="text-sage-100 underline text-sm font-medium"
              >
                {toast.actionLabel}
              </button>
            )}
            <button
              aria-label="Dismiss notification"
              onClick={() => {
                clearTimer();
                setToast(null);
              }}
              className="rounded p-1 text-sand-50 hover:bg-white/10"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
