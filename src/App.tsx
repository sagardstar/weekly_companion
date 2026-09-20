import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CalendarRange,
  LayoutGrid,
  Leaf,
  Settings2,
  Sprout,
  UserRound,
} from "lucide-react";
import { ToastProvider } from "./components/ToastProvider";
import {
  detectInitialTimezone,
  formatTargetDate,
  formatCalendarDate,
  addCalendarDays,
} from "./lib/time";
import { supabase } from "./lib/supabase";
import { parseImportedState, serializeState } from "./persistence/export";
import { useAppStore } from "./store";
import { Habit, LogEntry, WeekStart } from "./types/schema";
import { Login } from "./components/auth/Login";
import { Dashboard } from "./components/dashboard/Dashboard";
import { useToast } from "./components/ToastProvider";

type TabKey = "dashboard" | "reflections" | "monthly" | "settings" | "account";

const DEMO_USER = "demo-user";

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const localSaveError = useAppStore((s) => s.localSaveError);
  const habits = useAppStore((s) => s.habits);
  const user = useAppStore((s) => s.user);
  const logs = useAppStore((s) => s.logs);
  const ensureSettings = useAppStore((s) => s.ensureSettings);
  const addLogWithUndo = useAppStore((s) => s.addLogWithUndo);
  const { showToast } = useToast();
  const addLog = (input: Parameters<typeof addLogWithUndo>[0]) => {
    const { undo } = addLogWithUndo(input);
    showToast({
      message: "Check-in saved. A little step forward.",
      actionLabel: "Undo",
      onAction: undo,
    });
  };
  const deleteLog = useAppStore((s) => s.deleteLog);
  const restoreLog = useAppStore((s) => s.addLog);
  const selectedDate = useAppStore((s) => s.selectedDate);
  const setHabitStatus = useAppStore((s) => s.setHabitStatus);
  const getWeekRange = useAppStore((s) => s.getWeekRange);
  const getWeeklyProgress = useAppStore((s) => s.getWeeklyProgress);
  const setUser = useAppStore((s) => s.setUser);
  const migrateGuestData = useAppStore((s) => s.migrateGuestData);
  const syncFromCloud = useAppStore((s) => s.syncFromCloud);
  const settings = useAppStore((s) => s.settings);
  const lastUserIdRef = useRef<string | null>(null);
  const ensuredProfileRef = useRef<string | null>(null);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const habitDetailRef = useRef<HTMLElement | null>(null);
  const ensureProfile = (userId: string, email?: string) => {
    if (!supabase || ensuredProfileRef.current === userId) return;
    ensuredProfileRef.current = userId;
    void (async () => {
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId, email }, { onConflict: "id", ignoreDuplicates: true });
      if (error) console.error("supabase upsert profile failed", error);
    })();
  };

  useEffect(() => {
    // Ensure settings exist for the active user (or guest).
    ensureSettings(user?.id ?? DEMO_USER);
  }, [ensureSettings, user?.id]);

  useEffect(() => {
    if (!supabase) {
      console.error("Supabase client not configured; skipping auth listener.");
      return;
    }

    const migrateLocalData = (userId: string) => {
      console.log("Migrating data for user:", userId);
    };

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session?.user) {
          console.log("Auth Change: INITIAL_SESSION", data.session.user.id);
          setUser(data.session.user);
          lastUserIdRef.current = data.session.user.id;
          ensureProfile(data.session.user.id, data.session.user.email ?? undefined);
          migrateLocalData(data.session.user.id);
          void syncFromCloud();
        }
      })
      .catch((err) => console.error("getSession error", err))
      .finally(() => undefined);

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth Change:", event);
      const user = session?.user ?? null;
      setUser(user);
      if (user) {
        if (event === "SIGNED_IN" && !lastUserIdRef.current) {
          void migrateGuestData(user.id);
          migrateLocalData(user.id);
        }
        ensureProfile(user.id, user.email ?? undefined);
        lastUserIdRef.current = user.id;
        void syncFromCloud();
      } else {
        lastUserIdRef.current = null;
      }
    });

    return () => {
      data?.subscription.unsubscribe();
    };
  }, [migrateGuestData, setUser, syncFromCloud]);

  const tabs = [
    { key: "dashboard" as TabKey, label: "My week", icon: LayoutGrid },
    { key: "reflections" as TabKey, label: "Reflections", icon: BookOpen },
    { key: "monthly" as TabKey, label: "Monthly Summary", icon: CalendarRange },
    { key: "settings" as TabKey, label: "Settings", icon: Settings2 },
    { key: "account" as TabKey, label: "Account", icon: UserRound },
  ];

  const weekRange = useMemo(
    () => getWeekRange(new Date(selectedDate)),
    [getWeekRange, selectedDate],
  );
  const fallbackHabitId =
    habits.find((h) => h.status === "active")?.id ??
    habits.find((h) => h.status !== "archived")?.id ??
    habits[0]?.id ??
    null;
  const resolvedHabitId = habits.some((habit) => habit.id === selectedHabitId)
    ? selectedHabitId
    : fallbackHabitId;
  const selectedHabit = habits.find((h) => h.id === resolvedHabitId) ?? null;
  const selectedWeeklyLogs = useMemo(() => {
    if (!selectedHabit) return [];
    return logs.filter(
      (l) =>
        l.habit_id === selectedHabit.id &&
        l.target_date >= weekRange.start &&
        l.target_date <= weekRange.end,
    );
  }, [logs, selectedHabit, weekRange.end, weekRange.start]);
  const selectedProgress = selectedHabit
    ? getWeeklyProgress(selectedHabit.id, new Date(selectedDate))
    : 0;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <a
          href="#main-content"
          className="brand"
          onClick={() => setActiveTab("dashboard")}
        >
          <span className="brand-mark">
            <Sprout size={25} strokeWidth={1.6} />
          </span>
          <span>
            weekly
            <br />
            <strong>companion</strong>
          </span>
        </a>
        <p className="sidebar-label">YOUR LITTLE CORNER</p>
        <nav aria-label="Primary">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              aria-pressed={activeTab === tab.key}
              className={activeTab === tab.key ? "nav-active" : ""}
            >
              <tab.icon size={18} strokeWidth={1.6} />
              {tab.label}
              {activeTab === tab.key && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Leaf size={23} strokeWidth={1.3} />
          <p>
            Good things
            <br />
            grow gently.
          </p>
          <span>One small step at a time.</span>
        </div>
        <button className="sidebar-account" onClick={() => setActiveTab("account")}>
          <span className="account-avatar">
            <UserRound size={18} />
          </span>
          <span>
            <strong>{user ? "Your account" : "Your personal space"}</strong>
            <small>
              {user ? "Account & connection" : "On this device · sign in to sync"}
            </small>
          </span>
        </button>
      </aside>
      <main id="main-content" className="main-content">
        <div className="topbar">
          <span>THE WEEKLY COMPANION</span>
          <span>
            {new Intl.DateTimeFormat("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              timeZone: settings?.timezone ?? "UTC",
            }).format(new Date())}
          </span>
        </div>
        <div
          className={`page-content ${activeTab !== "dashboard" ? "secondary-page" : ""}`}
        >
          {localSaveError && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
            >
              {localSaveError}{" "}
              <button className="underline" onClick={() => setActiveTab("settings")}>
                Open data settings
              </button>
            </div>
          )}
          {activeTab === "dashboard" && (
            <div className="space-y-4">
              <Dashboard
                selectedHabitId={resolvedHabitId}
                onReflect={() => setActiveTab("reflections")}
                onSelectHabit={(id) => {
                  setSelectedHabitId(id);
                  requestAnimationFrame(() => {
                    habitDetailRef.current?.scrollIntoView?.({
                      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
                        .matches
                        ? "instant"
                        : "smooth",
                      block: "start",
                    });
                    habitDetailRef.current?.focus({ preventScroll: true });
                  });
                }}
              />
              {selectedHabit && (
                <HabitDetail
                  key={`${selectedHabit.id}-${weekRange.start}`}
                  sectionRef={habitDetailRef}
                  habit={selectedHabit}
                  progress={selectedProgress}
                  weekRange={weekRange}
                  weeklyLogs={selectedWeeklyLogs}
                  onAdd={(note, targetDate) =>
                    addLog({
                      habit_id: selectedHabit.id,
                      user_id: settings?.user_id ?? selectedHabit.user_id ?? DEMO_USER,
                      amount: selectedHabit.default_increment,
                      note,
                      target_date: targetDate,
                    })
                  }
                  onAddCustom={(amount, note, targetDate) =>
                    addLog({
                      habit_id: selectedHabit.id,
                      user_id: settings?.user_id ?? selectedHabit.user_id ?? DEMO_USER,
                      amount,
                      note,
                      target_date: targetDate,
                    })
                  }
                  onDeleteLog={(id) => {
                    const log = logs.find((entry) => entry.id === id);
                    if (!log) return;
                    deleteLog(id);
                    showToast({
                      message: "Check-in removed.",
                      actionLabel: "Undo",
                      onAction: () =>
                        restoreLog({ ...log, timestamp: new Date(log.timestamp) }),
                    });
                  }}
                  onStatusChange={(status) => {
                    setSelectedHabitId(selectedHabit.id);
                    setHabitStatus(selectedHabit.id, status);
                  }}
                />
              )}
            </div>
          )}
          {activeTab === "reflections" && <ReflectionsTab />}
          {activeTab === "monthly" && <MonthlySummaryTab />}
          {activeTab === "settings" && <SettingsTab />}
          {activeTab === "account" &&
            (user ? (
              <section className="account-panel">
                <UserRound size={30} />
                <h1>A space that goes with you.</h1>
                <p>Signed in as {user.email}</p>
                <button
                  className="button-secondary"
                  onClick={() => void supabase?.auth.signOut()}
                >
                  Sign out
                </button>
              </section>
            ) : (
              <Login />
            ))}
        </div>
      </main>
    </div>
  );
}

function ReflectionsTab() {
  const logs = useAppStore((s) => s.logs);
  const reflections = useAppStore((s) => s.reflections);
  const addReflection = useAppStore((s) => s.addReflection);
  const updateReflection = useAppStore((s) => s.updateReflection);
  const getWeekRangeFn = useAppStore((s) => s.getWeekRange);
  const settings = useAppStore((s) => s.settings);
  const { showToast } = useToast();

  const selectedDate = useAppStore((s) => s.selectedDate);
  const weekRange = getWeekRangeFn(new Date(selectedDate));
  const existing = reflections.find((r) => r.week_start_date === weekRange.start);

  const activePrompts = useMemo(
    () =>
      settings?.reflection_prompts && settings.reflection_prompts.length > 0
        ? settings.reflection_prompts
        : ["What went well?", "Focus for next week?"],
    [settings?.reflection_prompts],
  );

  const promptDefaults = useMemo(() => {
    const initial: Record<string, string> = {};
    activePrompts.forEach((prompt) => {
      const match = existing?.answers.find((a) => a.prompt === prompt);
      if (match) initial[prompt] = match.answer;
    });
    return initial;
  }, [activePrompts, existing]);

  const [answers, setAnswers] = useState<Record<string, string>>(promptDefaults);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setAnswers(promptDefaults);
  }, [promptDefaults]);

  const weekLogs = logs.filter(
    (l) => l.target_date >= weekRange.start && l.target_date <= weekRange.end,
  );

  const handleSave = () => {
    const promptAnswers = activePrompts.map((prompt) => ({
      prompt,
      answer: answers[prompt] ?? "",
    }));
    if (existing) {
      updateReflection(existing.id, promptAnswers);
    } else {
      addReflection({
        user_id: settings?.user_id ?? DEMO_USER,
        week_start_date: weekRange.start,
        answers: promptAnswers,
      });
    }
    setStatus("Reflection saved");
    showToast({ message: "Reflection saved" });
  };

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-sage-500">Reflections</p>
        <h2 className="text-2xl font-semibold text-slate-900">Week at a glance</h2>
        <p className="text-slate-600">
          Week of {formatCalendarDate(weekRange.start)} —{" "}
          {formatCalendarDate(weekRange.end)} · {weekLogs.length} check-ins
        </p>
      </header>
      <p className="text-stone-500">
        A quiet moment to notice what felt good, and what you need next. A few words are
        enough.
      </p>
      <div className="space-y-3 rounded-2xl border border-sand-100 bg-white p-4 shadow-soft">
        {activePrompts.map((prompt) => (
          <label key={prompt} className="text-sm text-slate-700 flex flex-col gap-1">
            {prompt}
            <textarea
              value={answers[prompt] ?? ""}
              onChange={(e) => {
                setStatus(null);
                setAnswers((prev) => ({ ...prev, [prompt]: e.target.value }));
              }}
              placeholder="There’s no right answer. Start wherever you are."
              rows={4}
              className="rounded-lg border border-sand-100 px-3 py-2 text-sm"
            />
          </label>
        ))}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-sage-500 text-white font-medium hover:bg-sage-700 transition"
          >
            Save reflection
          </button>
          {status && (
            <span role="status" className="text-sm text-slate-600">
              {status}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function MonthlySummaryTab() {
  const logs = useAppStore((s) => s.logs);
  const habits = useAppStore((s) => s.habits);
  const timezone = useAppStore((s) => s.settings?.timezone) ?? "UTC";
  const currentMonth = formatTargetDate(new Date(), timezone).slice(0, 7);
  const [monthOffset, setMonthOffset] = useState(0);
  const monthDate = new Date(`${currentMonth}-01T12:00:00Z`);
  monthDate.setUTCMonth(monthDate.getUTCMonth() + monthOffset);
  const monthPrefix = monthDate.toISOString().slice(0, 7);
  const monthLogs = logs.filter((l) => l.target_date.startsWith(monthPrefix));

  const perHabit = monthLogs.reduce<Record<string, number>>((acc, log) => {
    acc[log.habit_id] = (acc[log.habit_id] ?? 0) + log.amount;
    return acc;
  }, {});

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-sage-500">Monthly summary</p>
        <h2 className="text-2xl font-semibold text-slate-900">
          {formatCalendarDate(`${monthPrefix}-01`, { month: "long", year: "numeric" })}
        </h2>
        <p className="text-slate-600">
          {monthLogs.length} logs this month ·{" "}
          {new Set(monthLogs.map((log) => log.target_date)).size} days with a check-in
        </p>
        <div className="flex items-center gap-2">
          <button
            className="button-secondary"
            aria-label="Previous month"
            onClick={() => setMonthOffset((value) => value - 1)}
          >
            ← Previous
          </button>
          <button
            className="button-secondary"
            aria-label="Next month"
            onClick={() => setMonthOffset((value) => value + 1)}
          >
            Next →
          </button>
          {monthOffset !== 0 && (
            <button className="text-link" onClick={() => setMonthOffset(0)}>
              This month
            </button>
          )}
        </div>
      </header>
      <div className="space-y-2 rounded-2xl border border-sand-100 bg-white p-4 shadow-soft">
        {monthLogs.length === 0 ? (
          <p className="text-slate-500 text-sm">
            Your month is a fresh page. Your check-ins will collect here as you go.
          </p>
        ) : (
          <ul className="space-y-2">
            {Object.entries(perHabit).map(([habitId, total]) => {
              const habit = habits.find((h) => h.id === habitId);
              return (
                <li
                  key={habitId}
                  className="flex items-center justify-between rounded-lg border border-sand-100 px-3 py-2"
                >
                  <span className="text-sm text-slate-800">
                    {habit?.name ?? "Habit"} — {total} {habit?.unit ?? "entries"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function SettingsTab() {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const ensureSettings = useAppStore((s) => s.ensureSettings);
  const replaceState = useAppStore((s) => s.replaceState);
  const habits = useAppStore((s) => s.habits);
  const logs = useAppStore((s) => s.logs);
  const reflections = useAppStore((s) => s.reflections);
  const { showToast } = useToast();

  const [timezone, setTimezone] = useState(settings?.timezone ?? detectInitialTimezone());
  const [weekStart, setWeekStart] = useState<WeekStart>(
    (settings?.week_start_day as WeekStart) ?? "monday",
  );
  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const ensured = ensureSettings(settings?.user_id ?? DEMO_USER);
    setTimezone(ensured.timezone);
    setWeekStart(ensured.week_start_day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = () => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone.trim() }).format();
    } catch {
      setStatus("Choose a valid timezone, such as America/New_York.");
      return;
    }
    setSettings({
      user_id: settings?.user_id ?? DEMO_USER,
      timezone: timezone.trim(),
      week_start_day: weekStart,
      reflection_enabled: settings?.reflection_enabled ?? false,
      reflection_prompts: settings?.reflection_prompts ?? [],
    });
    setStatus("Settings saved");
    showToast({ message: "Settings saved" });
  };

  const handleExport = () => {
    const json = serializeState({
      settings,
      habits,
      logs,
      reflections,
      schemaVersion: 1,
    });
    setExportText(json);
    setStatus("Export ready");
  };

  const handleDownload = () => {
    const json = serializeState({
      settings,
      habits,
      logs,
      reflections,
      schemaVersion: 1,
    });
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `weekly-companion-${formatTargetDate(new Date(), settings?.timezone ?? "UTC")}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast({ message: "Your backup is ready to download." });
  };

  const handleImport = () => {
    const { state, errors } = parseImportedState(importText);
    if (errors.length > 0 || !state) {
      setStatus(errors.join("; "));
      return;
    }
    replaceState(state);
    setTimezone(state.settings?.timezone ?? timezone);
    setWeekStart(state.settings?.week_start_day ?? weekStart);
    setStatus("Import applied");
    showToast({ message: "Data imported" });
  };

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-sage-500">Settings</p>
        <h2 className="text-2xl font-semibold text-slate-900">Preferences & Data</h2>
      </header>
      <div className="space-y-3 rounded-2xl border border-sand-100 bg-white p-4 shadow-soft">
        <label className="text-sm text-slate-700 flex flex-col gap-1">
          Week start
          <select
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value as WeekStart)}
            className="rounded-lg border border-sand-100 px-3 py-2 text-sm"
          >
            <option value="monday">Monday</option>
            <option value="sunday">Sunday</option>
            <option value="saturday">Saturday</option>
          </select>
        </label>
        <label className="text-sm text-slate-700 flex flex-col gap-1">
          Timezone
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="rounded-lg border border-sand-100 px-3 py-2 text-sm"
            placeholder="e.g., America/New_York"
          />
        </label>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-sage-500 text-white font-medium hover:bg-sage-700 transition"
          >
            Save settings
          </button>
          {status && (
            <span role="status" className="text-sm text-slate-600">
              {status}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 rounded-2xl border border-sand-100 bg-white p-4 shadow-soft">
        <h3 className="text-lg font-semibold text-slate-900">Keep a little backup</h3>
        <p className="text-sm text-stone-500">
          Download your habits, check-ins, and reflections to keep a copy.
        </p>
        <button className="button-primary" onClick={handleDownload}>
          Download backup
        </button>
        <p className="text-xs text-stone-500">
          Importing replaces the data on this device. Download a backup first if you’d
          like to keep it.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="px-4 py-2 rounded-xl bg-white border border-sage-300 text-sage-700 hover:bg-sage-100 transition"
          >
            Export JSON
          </button>
          <button
            onClick={handleImport}
            className="px-4 py-2 rounded-xl bg-sage-500 text-white font-medium hover:bg-sage-700 transition"
          >
            Import JSON
          </button>
        </div>
        <label className="text-sm text-slate-700 flex flex-col gap-1">
          Exported data
          <textarea
            value={exportText}
            readOnly
            rows={4}
            className="rounded-lg border border-sand-100 px-3 py-2 text-sm font-mono"
          />
        </label>
        <label className="text-sm text-slate-700 flex flex-col gap-1">
          Import payload
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={4}
            className="rounded-lg border border-sand-100 px-3 py-2 text-sm font-mono"
            placeholder="Paste exported JSON"
          />
        </label>
      </div>
    </section>
  );
}

function HabitDetail({
  habit,
  progress,
  weekRange,
  weeklyLogs,
  sectionRef,
  onAdd,
  onAddCustom,
  onDeleteLog,
  onStatusChange,
}: {
  habit: Habit;
  progress: number;
  weekRange: { start: string; end: string };
  weeklyLogs: LogEntry[];
  sectionRef?: React.RefObject<HTMLElement | null>;
  onAdd: (note: string | undefined, targetDate: string) => void;
  onAddCustom: (amount: number, note: string | undefined, targetDate: string) => void;
  onDeleteLog: (id: string) => void;
  onStatusChange: (status: Habit["status"]) => void;
}) {
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState(habit.default_increment);
  const disabled = habit.status !== "active";
  const timezone =
    useAppStore((s) => s.settings?.timezone) ?? detectInitialTimezone() ?? "UTC";

  const defaultTargetDate = (() => {
    const today = formatTargetDate(new Date(), timezone);
    if (today >= weekRange.start && today <= weekRange.end) return today;
    return weekRange.start;
  })();
  const [targetDate, setTargetDate] = useState<string>(defaultTargetDate);
  const weekDates = Array.from({ length: 7 }, (_, idx) => {
    const dateStr = addCalendarDays(weekRange.start, idx);
    const dayLabel = formatCalendarDate(dateStr, { weekday: "short" });
    const dayNum = dateStr.slice(8, 10);
    return { date: dateStr, label: `${dayLabel} ${dayNum}` };
  });

  const sortedLogs = weeklyLogs
    .slice()
    .sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      id="habit-detail"
      className="mt-2 rounded-2xl border border-sand-100 bg-white p-4 sm:p-6 shadow-soft space-y-4 focus:outline-none focus:ring-2 focus:ring-sage-300"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-wide text-sage-500">Habit detail</p>
          <h3 className="text-2xl font-semibold text-slate-900">{habit.name}</h3>
          <p className="text-slate-600">
            {habit.weekly_goal
              ? `${progress} / ${habit.weekly_goal} ${habit.unit} this week`
              : `${weeklyLogs.length} entries this week`}
          </p>
          <p className="text-sm text-slate-500">
            Week of {formatCalendarDate(weekRange.start)} —{" "}
            {formatCalendarDate(weekRange.end)}
          </p>
        </div>
        <label className="text-sm text-slate-700 flex items-center gap-2">
          Status:
          <select
            value={habit.status}
            onChange={(e) => onStatusChange(e.target.value as Habit["status"])}
            className="rounded-lg border border-sand-100 px-3 py-2 text-sm"
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>

      <div className="space-y-2">
        <div className="rounded-xl border border-sand-100 bg-white p-3">
          <p className="text-sm font-semibold text-slate-800">Log for</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {weekDates.map((d) => {
              const selected = d.date === targetDate;
              return (
                <button
                  key={d.date}
                  type="button"
                  aria-label={`Select log date ${d.date}`}
                  aria-pressed={selected}
                  onClick={() => setTargetDate(d.date)}
                  className={`rounded-xl px-3 py-2 text-sm transition border ${
                    selected
                      ? "bg-sage-100 border-sage-300 text-sage-800"
                      : "bg-white border-sand-100 text-slate-700 hover:bg-sand-50"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
        <label className="text-sm text-slate-700 flex flex-col gap-1">
          Note (optional)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="rounded-lg border border-sand-100 px-3 py-2 text-sm"
            placeholder="How did it feel?"
            disabled={disabled}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => {
            onAdd(note.trim() || undefined, targetDate);
            setNote("");
          }}
          disabled={disabled}
          className={`w-full font-medium py-2 rounded-xl transition ${
            disabled
              ? "bg-sand-100 text-slate-400 cursor-not-allowed"
              : "bg-sage-500 hover:bg-sage-700 text-white"
          }`}
        >
          + Add {habit.default_increment} {habit.unit}
        </button>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="number"
            min="0.01"
            step="any"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="rounded-lg border border-sand-100 px-3 py-2 text-sm flex-1"
            aria-label={`Custom amount for ${habit.name} (detail)`}
            disabled={disabled}
          />
          <button
            onClick={() => {
              const amt = Number(amount) || 0;
              if (!Number.isFinite(amt) || amt <= 0) return;
              onAddCustom(amt, note.trim() ? note.trim() : undefined, targetDate);
              setAmount(habit.default_increment);
              setNote("");
            }}
            disabled={disabled}
            className={`font-medium px-4 py-2 rounded-xl transition ${
              disabled
                ? "bg-sand-100 text-slate-400 cursor-not-allowed"
                : "bg-white border border-sage-300 text-sage-700 hover:bg-sage-100"
            }`}
          >
            + Add custom
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-800">
          This week&apos;s logs ({weeklyLogs.length})
        </h4>
        {weeklyLogs.length === 0 ? (
          <p className="text-slate-500 text-sm">
            No logs yet this week. A fresh start, whenever you’re ready.
          </p>
        ) : (
          <ul className="space-y-2">
            {sortedLogs.map((log) => (
              <li
                key={log.id}
                className="flex items-start justify-between rounded-lg border border-sand-100 bg-sand-50 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {log.amount} {habit.unit} on {log.target_date}
                  </p>
                  {log.note && <p className="text-sm text-slate-600">{log.note}</p>}
                </div>
                <button
                  onClick={() => onDeleteLog(log.id)}
                  className="text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default App;

export function AppWithProviders() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}
