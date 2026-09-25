# Weekly Companion

Weekly Companion is a calm, focused habit tracker that helps you plan your week, log sessions, and reflect without the noise. It is built to feel like a fresh notebook you can revisit every week.

Try it here: https://weekly-companion.vercel.app/

## What it does
- Plan your week with a clear, weekly view.
- Log sessions on the day they happened (even if you are logging later).
- Track progress with goals and visual weekly dots.
- Pause or archive habits without losing history.
- Write quick weekly reflections to close the loop.

## How to use it
1. Open the app and create your first habit.
2. Pick an icon to make it yours.
3. Log sessions as you go, or backdate them to the correct day.
4. Review your week and reflect on what worked.

## Note for developers/contributors
```bash
npm install
npm run dev
```

If you want to enable Supabase auth and sync:
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.
- Restart the dev server after adding env vars.

## Tech stack
- React + TypeScript
- Vite
- Tailwind CSS
- Zustand
- Supabase (auth + sync)

---

If you want feedback or want to contribute, open an issue or start a discussion. The goal is to keep this app light, calming, and genuinely useful week after week.

## Install and use offline

Run `npm run build`, then `npm run preview` to test the production PWA. Deploy using the existing HTTPS hosting; development mode deliberately does not register a service worker. The build generates a versioned `dist/sw.js` and precaches the entire app shell. A new version activates once all old app windows have closed, so an update cannot interrupt an open edit.

- Pixel / Chrome: menu → Install app (or Add to Home screen).
- iPhone / Safari: Share → Add to Home Screen → Open as Web App.
- Open online once to download the application and sign in for account sync.
- Habits and check-ins save locally immediately, survive reloads offline, and sync on reconnect, focus, and every 30 seconds while the app is visible. Sync now also retries manually.
- Preferences and reflections remain device-local, as before; JSON export includes them. This change requires no database migration.

Each account and the guest workspace have separate local snapshots. Habit/log changes and their outbox are saved together under `weekly-companion:offline:v1`; the previous `weekly-companion:v1` snapshot is retained as a migration backup. Guest habits and check-ins are queued once when signing in. Old account data never migrates into another account.

One origin-wide Web Lock covers every workspace. Only the lock holder may hydrate writable state, persist, or sync; other windows show a read-only storage snapshot and can take over only by closing the editor then using the explicit retry. Browsers without Web Locks remain read-only rather than using a local-storage lease. The Settings backup export/download remains available in read-only mode.

Only changed fields are uploaded for updates. Concurrent edits to different fields are preserved; same-field writes use the original value as a conditional filter. Deletes are also conditional, including null values, and their lost acknowledgements are checked before being treated as complete. A create is durably marked before its first request: never-attempted creates can be discarded locally, while uncertain creates reconcile the exact attempted payload before later edits or deletion continue, including after restart. Legacy queued edits without a trustworthy original value remain blocked when newer edits coalesce. Updates or deletes that conflict with a changed/deleted remote record stay pending with an explanation and exportable local data instead of recreating or overwriting it. Pending drafts overlay cloud reads, and a delayed response cannot clear a newer edit or another account's data. Sync requires a valid session for the workspace owner. Expired sessions can require signing in again online.

Verification: `npm test -- --run`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`. Offline tests cover restart recovery, failed uploads, in-flight edits, account isolation, deletion retry, and guest/legacy migration. For device acceptance: load online, enable airplane mode, close/reopen, add/edit/delete a habit or check-in, reopen again, reconnect, and verify on a second signed-in device. Background sync while closed is not required. Browser storage clearing removes local drafts; export remains available for backups.
