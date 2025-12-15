## Weekly Companion – Handoff Notes for Future Agents

### Stack
- React + Vite + TypeScript + Tailwind.
- State: Zustand (vanilla store with React hook wrapper in `src/store/index.ts`).
- Auth/Sync: Supabase (magic link / Google); local-first with UUIDs; optimistic updates for user actions; pull/merge and guest migration implemented.
- Date/time: date-fns + date-fns-tz; fixed “home timezone” + `target_date` for logs; weekly ranges respect user week start.

### Key Files
- `src/App.tsx`: App shell, dashboard, detail view, reflections, monthly summary, settings (includes account/login or sign-out), auth listener, activity dots for log-only habits, archived filtering.
- `src/store/store.ts`: Zustand store with actions, Supabase-aware optimistic writes, `syncFromCloud`, `migrateGuestData`, `setHabits`/`setLogs`, user state.
- `src/lib/supabase.ts`: Supabase client (null-safe if envs missing) + config flag.
- `src/components/auth/Login.tsx`: Magic link / Google login with guards when Supabase config is missing.
- `src/types/schema.ts`: Data models.
- `implementation_progress.md`: Milestone log.
- `analysis_plan.md`: Initial plan.

### Supabase Notes
- Env vars required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Restart dev server after adding.
- `supabase` may be `null` if envs missing; guarded in code.
- Auth listener in `App.tsx`: `getSession` on mount, `onAuthStateChange` subscription, migrates guest data once, then pulls from cloud.
- Store sync:
  - `syncFromCloud`: fetch habits/logs by user_id; uses `setHabits`/`setLogs` (no inserts) to avoid 409s.
  - `migrateGuestData`: `upsert(..., { onConflict: "id", ignoreDuplicates: true })` for habits/logs.
  - User actions (add/update/delete habit/log) remain optimistic and call Supabase when logged in; errors are logged.

### UX / Data Behavior
- Dashboard hides archived habits; paused are dimmed/disabled.
- Log-only habits show 7-day activity dots aligned to week start.
- Detail view: status change, quick add/custom add, notes, delete log.
- Reflections: prompts from `settings.reflection_prompts` or defaults; saves per week.
- Monthly summary: aggregates logs per habit for current month.
- Settings: week start/timezone, export/import JSON, account card (email + sign-out) or login.

### Tests
- `npm test` (Vitest + Testing Library) and `npm run lint` pass at last check. Auth change logs appear in tests (expected).

### Common Pitfalls
- White screen previously due to missing Supabase envs; now guarded but ensure envs are set.
- Avoid calling Supabase in pull paths; use `setHabits`/`setLogs`.
- Activity dots rely on week range and `target_date`; keep timezone helpers centralized.

### Next Ideas
- Add retry/backoff queue for Supabase writes.
- Surface sync status/errors in UI.
- Persist session/user to avoid flicker on reload.
