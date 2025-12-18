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
