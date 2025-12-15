## Analysis Plan for Weekly Companion

This document outlines how we will translate the master design doc into a shippable app. It covers the analytical focus areas, milestones, and step-by-step tasks to reach a usable V1 while preserving the calm, weekly-first philosophy.

### 1) Goals and Success Criteria
- Deliver a local-first, timezone-correct weekly habit companion with logging + undo, weekly reflections, and simple monthly summary.
- Maintain warm, calm UX: no guilt, clear paused state, optimistic logging with undo.
- Data integrity: UUIDs everywhere; store both `timestamp` (UTC) and `target_date` (user timezone).
- Offline-first with pluggable persistence; export/import to avoid lock-in.

### 2) Scope Confirmation (V1 guardrails)
- In-scope: weekly goals/log-only habits, pause/archive, reflections (optional prompts), monthly summary, settings (week start, timezone, reminders toggle), export/import (JSON, Markdown reflections/summaries), undo for logging.
- Out-of-scope: social features, streaks/badges, heavy customization, complex analytics.

### 3) Architecture & Data Notes to Validate Early
- Stack: React + Vite + Tailwind, Zustand store, date-fns/date-fns-tz for week math.
- Persistence adapter: start with localStorage/IndexedDB wrapper and schema versioning; design an interface that can swap to Supabase/Firebase.
- Timezone correctness: helpers for `target_date` and week ranges using selected home timezone and week start.
- State slices: settings, habits, logs, reflections; selectors for weekly progress and monthly summaries; paused/archived filtering.

### 4) Milestones and Steps

#### Milestone 1: Project Setup & Utilities
- Initialize Vite + React + TypeScript + Tailwind; configure ESLint/Prettier/Vitest.
- Add UUID helper and date-fns/date-fns-tz utilities (week range, format in TZ, month aggregates).
- Create persistence adapter interface with local implementation + schema version constant.
- Add JSON import/export stubs and validation skeleton.

#### Milestone 2: State Model & Store
- Define TypeScript models (UserSettings, Habit, LogEntry, WeeklyReflection) with UUIDs and timestamps.
- Implement Zustand slices: settings, habits, logs, reflections.
- Add selectors: current week range, habit weekly totals, monthly summaries, paused/archived filters.
- Implement actions: create/edit habit, status transitions, add log (optimistic), undo/delete log, reflections CRUD, export/import handlers.

#### Milestone 3: Core Logic (Timezone, Weekly Views, Undo)
- Implement `addLog` computing `target_date` from user timezone; optimistic add + undo token.
- On first load, default the "Home Timezone" using `Intl.DateTimeFormat().resolvedOptions().timeZone`, while keeping it user-editable in Settings.
- Weekly filtering logic (no DB reset): filter by week range; exclude paused habits from weekly metrics.
- Monthly aggregation over `target_date`; safe defaults for units and default increments.
- Wire toast-based undo that rolls back the optimistic log.

#### Milestone 4: UI Foundations & Navigation
- Layout/navigation shell with tabs: Dashboard, Reflections, Monthly Summary, Settings.
- Global theming tokens for warm, calm look (colors, radii, spacing, shadows); design mobile-first CSS.
- Responsive grid baseline: Habit grid 1-column on mobile, 2-column on desktop; set responsive spacing and typography early.
- Reusable components: Button, Card, Toast, ProgressBar, Dots/Sparkline, Section headers.

#### Milestone 5: Dashboard & Logging
- Dashboard header showing “Week of …”.
- Habit cards (2-column): name/icon, progress bar (goal) or dots/sparkline (log-only), progress text, primary `+ Add` CTA.
- Logging interactions: +1 via default increment, undo toast, visual update optimistic.
- Paused habits visually dimmed or segregated; archived hidden.

#### Milestone 6: Habit Detail
- Detail view: expanded stats, quick actions (+1/custom/note), log feed with delete.
- Habit settings: edit goal/unit/default increment, status change (active/paused/archived).
- Notes per log (optional input and display).

#### Milestone 7: Reflections & Monthly Summary
- Weekly reflection editor: prompts (on/off), “Week at a glance” stats at top.
- Monthly summary: simple aggregates and highlights from logs/notes.
- Markdown export for reflections and monthly summaries.

#### Milestone 8: Settings & Export/Import
- Settings screen: week start selector, timezone selector, reminders toggle placeholder.
- Export/import flows: JSON export/import with confirmation and schema guard; Markdown export hook.
- Persistence testing: ensure state rehydrates correctly from storage.

#### Milestone 9: Polish, QA, and Readiness
- Empty/loading/paused states; no red/guilt states.
- Keyboard and mobile friendliness; basic accessibility pass.
- Visual refinements: spacing, shadows, hover/focus states, toast timing.
- QA checklist run; prep release notes.

### 5) Testing Strategy
- Unit: timezone `target_date`, week range helpers, progress selectors, undo logic.
- Component: logging UI (optimistic + undo), paused visibility, reflection editor.
- Integration/smoke: navigation, persistence round-trip (export/import), monthly summary rendering.

### 6) Risks & Mitigations
- Timezone drift: centralize helpers, test cross-TZ cases; store `target_date` at log time.
- Undo coherence: time-bound undo token linked to log ID; rollback both UI and store.
- Persistence/versioning: schema version constant; migration hook; validate imports before apply.
- Scope creep: adhere to V1 guardrails; avoid streaks/badges/custom theme requests.

### 7) Delivery Cadence (Suggested)
- Week 1: Milestones 1–2 (setup, store, helpers).
- Week 2: Milestones 3–5 (core logic, dashboard, logging).
- Week 3: Milestones 6–8 (detail, reflections/monthly, settings/export).
- Week 4: Milestone 9 (polish, tests, QA, release prep).
