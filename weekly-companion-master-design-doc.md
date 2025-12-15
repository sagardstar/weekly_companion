Here is the fully updated design document, incorporating all the discussed improvements (UUIDs, Timezones, Undo logic, Paused state, and Visual refinements).

````markdown
---
title: Weekly Companion – Master Design Document
version: 2.0
author: Sagar (+ ChatGPT design assistant)
date: 2025-12-10
---

# 1. Product Overview

## 1.1. Working Name

**Product name (placeholder):** `Weekly Companion`  
(A calm, browser-based habit and reflection app.)

---

## 1.2. One-sentence Summary

A calm, browser-based weekly habit companion that helps you gently track what matters, reflect on your week, and build real consistency—without streaks, guilt, or pressure.

---

## 1.3. Core Philosophy

- **Guide, not tyrant.** The app nudges and reflects; it doesn’t judge or punish.
- **Weekly rhythm, not daily pressure.** Everything is framed around weekly goals and a monthly summary, not daily streaks.
- **Warm, calm, and personal.** The app should feel like a cozy notebook + soft dashboard hybrid.
- **Low friction.** Logging something is as easy as tapping “Add” once, with a safe "Undo" option.
- **Respectful nudges only.** The app **never speaks first** unless the user has explicitly enabled reminders.
- **Emotionally safe.** No red error states, no streak-breaking guilt, no shaming language. "Paused" states allow for sickness/travel without feeling like failure.

---

## 1.4. Primary Outcomes

For the user:

- Build **consistent weekly habits** like music practice, running, strength training, newsletter writing, healthy meals, eye exercises.
- Feel **encouraged**, not overwhelmed.
- Develop **identity-based change** (“I am someone who practices music / cares for my health”) through weekly and monthly reflection.

For the product:

- Simple, maintainable, low-cost architecture.
- Local-first (offline capable), with optional cloud sync.
- robust data integrity (UUIDs, Timezone-aware).

---

## 1.5. Non-goals (V1)

- No social graphs, friend lists, or public sharing features.
- No complex goal hierarchies (no quarterly/annual goals).
- No streaks or badges.
- No heavy customization (themes, fonts, layouts) beyond the fixed, thoughtfully designed calm UI.
- No complex analytics dashboards beyond simple, gentle insights.

---

# 2. Target Users & Use Cases

## 2.1. Primary User

- Busy adult who wants to:
  - Keep up with a few meaningful weekly habits (health, creativity, writing, food).
  - Avoid being overwhelmed by productivity tools.
  - Use the app across multiple devices (work laptop, personal laptop, phone) without data conflicts.

## 2.2. Typical Habits

Examples from the initial user:

- Music practice – 3 sessions/week.
- Cardio (running/other) – 5 sessions/week.
- Strength training – 2 sessions/week.
- Newsletter writing – 90 minutes/week.
- Healthy meals (raw/steamed/boiled) – 5 meals/week.
- Eye exercises – 3 sessions/week.

---

## 2.3. Key Use Cases

- As a user, I want to **log a habit session in 1 tap** and have an **"Undo" option** if I made a mistake.
- As a user, I want to **see my weekly progress at a glance**, correctly calculated even if I travel to a different timezone.
- As a user, I want to **pause a habit** (e.g., if sick or traveling) so it doesn't look like a failed week.
- As a user, I want to **write a few notes about how a session felt**.
- As a user, I want to **reflect weekly** on what went well and what I want to focus on next.
- As a user, I want to **export my data** (JSON backup and Markdown summaries) so I’m never locked in.

---

# 3. High-level Feature Set (V1)

- Weekly habit tracking with:
  - **Weekly goals**: numeric target + unit.
  - **Log-only habits**: No target, just tracking (visualized via sparkline/dots).
- Habit logging:
  - Quick “Add” button (+1 by default) with **Undo Toast notification**.
  - Custom amount logging per habit.
  - Optional notes per log entry.
- Weekly dashboard:
  - 2-column **grid of habit cards**.
  - Weekly totals (e.g., “2 / 5 sessions”).
- Habit detail view:
  - Detailed progress.
  - Log history (with ability to delete individual logs).
  - Notes feed.
  - Simple history view (by week).
- Habit States:
  - **Active**: Shows on dashboard.
  - **Paused**: Hidden from main metrics/dashboard (or visually dimmed) to prevent guilt during sickness/breaks.
  - **Archived**: Fully hidden, preserved for history.
- Weekly reflection:
  - Optional weekly reflection prompt (off by default).
  - "Week at a glance" stats shown while reflecting to aid memory.
- Monthly summary:
  - Simple stats and highlights.
- Settings:
  - Week start day (default: Monday).
  - **Timezone** (Critical for accurate weeks).
  - Reminder configuration.
  - Export/import.

---

# 4. UX & Visual Design

## 4.1. Visual Style

**Overall aesthetic:** Calm • Warm • Encouraging

- **Base style:** Calm minimalism (Notion-like spacing and simplicity).
- **Emotional layer:** Cozy, warm colors (soft beige/linen backgrounds, muted sage or gentle accent).
- **Guidelines:**
  - No harsh reds.
  - Rounded corners.
  - Soft shadows.
  - Plenty of whitespace.
  - Typography: Inter/Lato-style.

---

## 4.2. Layout & Navigation

- **Dashboard** (Home).
- **Reflections**.
- **Monthly Summary**.
- **Settings**.

---

## 4.3. Screen: Weekly Dashboard (Home)

**Primary screen of the app. No “Today” tab.**

### Content

- **Header:**

  - Week label: e.g., “Week of Dec 8–14”.

- **Habit grid:**

Each **habit card** contains:

1. **Habit name** & Icon.
2. **Visual Indicator:**
   - _Goal-based:_ Progress bar (Soft rounded).
   - _Log-only:_ **Sparkline or Activity Dots** (7 dots representing the week, filling in as logs occur).
3. **Progress text:**
   - “2 / 3 sessions this week” OR “3 entries this week”.
4. **Primary action: [ + Add ]**
   - Full-width button.

### Interactions (Crucial)

- **One-Tap Log with Undo:**
  - Tap `[ + Add ]` → Updates UI immediately (optimistic).
  - **Toast Notification appears:** "Logged Music Practice. (Undo)"
  - Toast persists for 4 seconds.
  - Tapping "(Undo)" removes the log immediately.

---

## 4.4. Screen: Habit Detail View

### Sections

1. **Header:** Habit name, goal info.
2. **Weekly progress:** Expanded bar/stats.
3. **Quick actions:** `+ Add`, `Add custom amount`, `Add note`.
4. **Log Feed:** Chronological list of current week's logs.
   - **Action:** Ability to delete specific logs here (trash icon).
5. **Habit Settings (Contextual):**
   - Edit Goal.
   - **Change Status:** Active / Paused / Archived.

---

## 4.5. Screen: Reflections

1. **Weekly Reflection Editor**
   - Triggered when user opens the current week’s reflection.
   - **Helper View:** Top of screen shows "Week at a Glance" stats (e.g., "You logged 12 times this week across 4 habits") to help the user remember what they did.
   - Prompts: "What went well?", "Focus for next week?" (Editable).

---

# 5. Functional Design

## 5.1. Habit Model & Behavior

### Habit States

- **Active:** Standard behavior.
- **Paused:** - User selects "Pause" (e.g., for sickness or vacation).
  - Habit does not count towards "missed" goals.
  - Visually distinct (e.g., moved to bottom or grayed out).
- **Archived:** Hidden from dashboard completely.

### Weekly Reset & Timezones

- **The Problem:** A user travels from New York (EST) to Seattle (PST). If the app relies on browser time, the "end of the week" shifts, potentially moving logs between weeks confusingly.
- **The Solution:** - User selects a **"Home Timezone"** in settings (e.g., America/New_York).
  - Weeks are calculated based on that timezone, regardless of where the user physically is.
  - Logs are assigned a `target_date` based on that timezone.

---

# 6. Data Model (Schema)

_Implementation Note: Use UUIDs for all IDs to ensure safe syncing and merging._

## 6.1. User Settings

```ts
UserSettings {
  user_id: string         // UUID v4
  week_start_day: 'monday' | 'sunday' | 'saturday'
  timezone: string        // e.g., "America/New_York" - Anchor for week calcs
  reflection_enabled: boolean
  reflection_prompts: string[]
  created_at: string      // ISO 8601 UTC
  updated_at: string      // ISO 8601 UTC
}
```
````

## 6.2. Habit

```ts
Habit {
  id: string              // UUID v4
  user_id: string         // UUID v4
  name: string
  icon: string | null
  weekly_goal: number | null // null → log-only habit
  unit: string               // "sessions", "minutes", "meals"
  default_increment: number
  status: 'active' | 'paused' | 'archived' // Tri-state
  created_at: string      // ISO 8601 UTC
  updated_at: string      // ISO 8601 UTC
}
```

## 6.3. LogEntry

```ts
LogEntry {
  id: string              // UUID v4
  habit_id: string        // UUID v4
  user_id: string         // UUID v4
  timestamp: string       // ISO 8601 UTC (The literal time of the tap)

  // CRITICAL: The "calendar day" this log belongs to,
  // calculated using User's Timezone at moment of logging.
  // This locks the log to a specific day/week, preventing shifts during travel.
  target_date: string     // "YYYY-MM-DD"

  amount: number
  note: string | null
  created_at: string
}
```

## 6.4. WeeklyReflection

```ts
WeeklyReflection {
  id: string              // UUID v4
  user_id: string         // UUID v4
  week_start_date: string // "YYYY-MM-DD" (Normalized to start day)
  answers: ReflectionAnswer[]
  created_at: string
  updated_at: string
}
```

---

# 7\. Architecture & Sync

## 7.1. Local-First Strategy

1.  **Local Mode:**
    - App initializes using `localStorage` (or IndexedDB).
    - Generates UUIDs locally.
    - Fully functional without internet.
2.  **Cloud Mode (Optional):**
    - Auth via Supabase/Firebase.
    - **Sync Strategy:** - Since UUIDs are used, no ID collision risk.
      - On login: Upload all local data to cloud (upsert).
      - On subsequent loads: Fetch changes \> `last_synced_at`.

---

# 8\. Export & Import

- **JSON Export:** Full state dump (Schema v2).
- **JSON Import:** - Replaces local state (with confirmation).
- **Markdown Export:** Reflections + Monthly summaries text.

---

# 9\. Implementation Notes (for Developer)

## 9.1. Key Logic: Logging with Timezone

When user taps `Add`:

```javascript
function addLog(habitId, amount) {
  const now = new Date();
  const userTimezone = useStore.getState().settings.timezone;

  // Calculate the "Calendar Date" for the user's home timezone
  // Use a library like date-fns-tz or standard Intl API
  const targetDate = formatInTimeZone(now, userTimezone, "yyyy-MM-dd");

  const newLog = {
    id: crypto.randomUUID(),
    habit_id: habitId,
    timestamp: now.toISOString(),
    target_date: targetDate, // The anchor
    amount: amount,
  };

  saveLog(newLog);
  showUndoToast(newLog.id);
}
```

## 9.2. Key Logic: Weekly Reset

Do not "reset" the database. Filter the view:

```javascript
function getWeeklyProgress(habitId) {
  const userTimezone = useStore.getState().settings.timezone;
  const currentWeekRange = getWeekRange(new Date(), userTimezone); // [start, end]

  // Filter logs where log.target_date falls within currentWeekRange
  const logs = allLogs.filter(
    (l) =>
      l.habit_id === habitId &&
      isWithinInterval(l.target_date, currentWeekRange)
  );

  return sum(logs.amount);
}
```

---

# 10\. Summary for Implementation

- **Stack:** React, Vite, Tailwind CSS, Zustand (Store), LocalStorage (Persistence).
- **Identity:** UUIDs for everything.
- **Time:** Store UTC timestamp _and_ `target_date` (YYYY-MM-DD) based on user's fixed timezone.
- **UX:** Optimistic UI updates with "Undo" Toast.
- **Visuals:** Warm, rounded, calm. Log-only habits use Sparklines/Dots.
- **Logic:** "Paused" habits are hidden from the weekly calculation but preserved in DB.

<!-- end list -->

```

```
