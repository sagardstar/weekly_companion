import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { appStore } from "./store";
import { AppWithProviders } from "./App";

beforeEach(() => {
  appStore.setState(
    {
      user: null,
      selectedDate: new Date().toISOString(),
      settings: null,
      habits: [],
      logs: [],
      reflections: [],
    },
    false,
  );
});

function seedHabits() {
  const now = new Date().toISOString();
  appStore.setState(
    {
      settings: {
        user_id: "demo-user",
        week_start_day: "sunday",
        timezone: "UTC",
        reflection_enabled: false,
        reflection_prompts: [],
        created_at: now,
        updated_at: now,
      },
      habits: [
        {
          id: "habit-music",
          user_id: "demo-user",
          name: "Music practice",
          icon: "🎸",
          weekly_goal: 3,
          unit: "sessions",
          default_increment: 1,
          status: "active",
          created_at: now,
          updated_at: now,
        },
        {
          id: "habit-cardio",
          user_id: "demo-user",
          name: "Cardio",
          icon: "🏃",
          weekly_goal: 5,
          unit: "sessions",
          default_increment: 1,
          status: "active",
          created_at: now,
          updated_at: now,
        },
        {
          id: "habit-strength",
          user_id: "demo-user",
          name: "Strength",
          icon: "🏋️",
          weekly_goal: 2,
          unit: "sessions",
          default_increment: 1,
          status: "paused",
          created_at: now,
          updated_at: now,
        },
      ],
    },
    false,
  );
}

describe("App layout and navigation", () => {
  it("renders welcome empty state when no habits exist", async () => {
    render(<AppWithProviders />);
    expect(
      screen.getByRole("heading", { name: /Your week, at your pace/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/What would you like to focus on this week\?/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /\+ create first habit/i }),
    ).toBeInTheDocument();
  });

  it("lets users create a habit with a chosen icon", async () => {
    render(<AppWithProviders />);
    const create = await screen.findByRole("button", { name: /\+ create first habit/i });
    fireEvent.click(create);

    const nameInput = await screen.findByLabelText(/Name/i);
    fireEvent.change(nameInput, { target: { value: "Meditation" } });

    const iconButton = screen.getByRole("button", { name: "Select icon 🧘" });
    fireEvent.click(iconButton);

    const save = screen.getByRole("button", { name: /save/i });
    fireEvent.click(save);

    expect(await screen.findByLabelText(/Meditation card/i)).toBeInTheDocument();
    expect(screen.getByText("🧘")).toBeInTheDocument();
  });

  it("switches tabs when navigation buttons are clicked", () => {
    render(<AppWithProviders />);
    const reflectionsTab = screen.getByRole("button", { name: /reflections/i });
    fireEvent.click(reflectionsTab);
    expect(screen.getByText(/Week at a glance/i)).toBeInTheDocument();
  });

  it("shows toast and supports undo when adding a log", async () => {
    seedHabits();
    render(<AppWithProviders />);
    const card = await screen.findByLabelText(/Music practice card/i);
    const addBtn = within(card).getByRole("button", {
      name: /^\+ add 1 sessions today$/i,
    });
    fireEvent.click(addBtn);

    expect(await screen.findByText(/logged/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(within(card).getByText(/1 \/ 3 sessions/i)).toBeInTheDocument(),
    );

    const undoButton = screen.getByRole("button", { name: /undo/i });
    fireEvent.click(undoButton);
    await waitFor(() =>
      expect(within(card).getByText(/0 \/ 3 sessions/i)).toBeInTheDocument(),
    );
  });

  it("supports custom amount logging and updates progress", async () => {
    seedHabits();
    render(<AppWithProviders />);
    const card = await screen.findByLabelText(/Music practice card/i);
    fireEvent.click(within(card).getByText("Custom amount"));
    const amountInput = within(card).getByLabelText(/custom amount/i);
    fireEvent.change(amountInput, { target: { value: "2" } });
    const addCustom = within(card).getByRole("button", { name: /\+ add custom/i });
    fireEvent.click(addCustom);

    await waitFor(() =>
      expect(within(card).getByText(/2 \/ 3 sessions/i)).toBeInTheDocument(),
    );
  });

  it("disables logging controls for paused habits", async () => {
    seedHabits();
    render(<AppWithProviders />);
    const strengthCard = await screen.findByLabelText(/Strength card/i);
    const addButtons = within(strengthCard).getAllByRole("button", { name: /\+ add/i });
    addButtons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it("shows habit detail logs and supports deletion", async () => {
    seedHabits();
    render(<AppWithProviders />);
    const dateButtons = await screen.findAllByRole("button", {
      name: /Select log date/i,
    });
    expect(dateButtons.length).toBeGreaterThan(0);
    const detailAdd = await screen.findByRole("button", { name: /^\+ add 1 sessions$/i });
    fireEvent.click(detailAdd);

    const logItem = await screen.findByText(/1 sessions on/i);
    expect(logItem).toBeInTheDocument();

    const deleteBtn = await screen.findByRole("button", { name: /delete/i });
    fireEvent.click(deleteBtn);
    await waitFor(() =>
      expect(screen.getByText(/no logs yet this week/i)).toBeInTheDocument(),
    );
  });

  it("lets users change habit status from detail", async () => {
    seedHabits();
    render(<AppWithProviders />);
    const statusSelect = await screen.findByLabelText(/Status:/i);
    fireEvent.change(statusSelect, { target: { value: "paused" } });
    const detailAdd = await screen.findByRole("button", { name: /^\+ add 1 sessions$/i });
    expect(detailAdd).toBeDisabled();
  });

  it("allows logging a session for a specific day in the current week", async () => {
    seedHabits();
    appStore.setState(
      { selectedDate: new Date("2025-12-17T12:00:00.000Z").toISOString() },
      false,
    );
    render(<AppWithProviders />);

    const backdate = await screen.findByRole("button", {
      name: /Select log date 2025-12-14/i,
    });
    fireEvent.click(backdate);

    const detailAdd = await screen.findByRole("button", { name: /^\+ add 1 sessions$/i });
    fireEvent.click(detailAdd);

    expect(await screen.findByText(/1 sessions on 2025-12-14/i)).toBeInTheDocument();
  });

  it("saves weekly reflection entries", async () => {
    render(<AppWithProviders />);
    const reflectionsTab = screen.getByRole("button", { name: /reflections/i });
    fireEvent.click(reflectionsTab);

    const well = await screen.findByLabelText(/What went well\?/i);
    fireEvent.change(well, { target: { value: "Ran 3 times" } });
    const focus = screen.getByLabelText(/Focus for next week\?/i);
    fireEvent.change(focus, { target: { value: "More stretching" } });

    const save = screen.getByRole("button", { name: /save reflection/i });
    fireEvent.click(save);
    const savedMessages = await screen.findAllByText(/Reflection saved/i);
    expect(savedMessages.length).toBeGreaterThan(0);
  });

  it("renders monthly summary with aggregated logs", async () => {
    seedHabits();
    render(<AppWithProviders />);
    const card = await screen.findByLabelText(/Music practice card/i);
    const addBtn = within(card).getByRole("button", {
      name: /^\+ add 1 sessions today$/i,
    });
    fireEvent.click(addBtn);

    const monthlyTab = screen.getByRole("button", { name: /monthly summary/i });
    fireEvent.click(monthlyTab);

    expect(await screen.findByText(/logs this month/i)).toBeInTheDocument();
    expect(screen.getByText(/Music practice .*1 sessions/i)).toBeInTheDocument();
  });

  it("updates settings for week start and timezone", async () => {
    render(<AppWithProviders />);
    const settingsTab = screen.getByRole("button", { name: /settings/i });
    fireEvent.click(settingsTab);

    const weekStart = await screen.findByLabelText(/Week start/i);
    fireEvent.change(weekStart, { target: { value: "sunday" } });
    const tzInput = screen.getByLabelText(/Timezone/i);
    fireEvent.change(tzInput, { target: { value: "Europe/Paris" } });

    const saveBtn = screen.getByRole("button", { name: /save settings/i });
    fireEvent.click(saveBtn);

    expect(appStore.getState().settings?.week_start_day).toBe("sunday");
    expect(appStore.getState().settings?.timezone).toBe("Europe/Paris");
  });

  it("exports and imports JSON state", async () => {
    render(<AppWithProviders />);
    const settingsTab = screen.getByRole("button", { name: /settings/i });
    fireEvent.click(settingsTab);

    const exportBtn = await screen.findByRole("button", { name: /export json/i });
    fireEvent.click(exportBtn);
    const exportTextarea = screen.getByLabelText(/Exported data/i) as HTMLTextAreaElement;
    expect(exportTextarea.value.length).toBeGreaterThan(10);

    const parsed = JSON.parse(exportTextarea.value);
    parsed.settings.timezone = "Asia/Tokyo";
    const importTextarea = screen.getByLabelText(/Import payload/i);
    fireEvent.change(importTextarea, { target: { value: JSON.stringify(parsed) } });

    const importBtn = screen.getByRole("button", { name: /import json/i });
    fireEvent.click(importBtn);

    expect(appStore.getState().settings?.timezone).toBe("Asia/Tokyo");
  });
});

it("resets the detail log date when moving to another week", async () => {
  seedHabits();
  appStore.setState({ selectedDate: "2025-12-17T12:00:00Z" });
  render(<AppWithProviders />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Select log date 2025-12-17" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
  fireEvent.click(screen.getByRole("button", { name: /^\+ Add 1 sessions$/ }));
  expect(appStore.getState().logs[0].target_date).toBe("2025-12-07");
  expect(
    screen.queryByRole("button", { name: /sessions today/ }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Back to today" }));
  expect(
    screen.getAllByRole("button", { name: /sessions today/ }).length,
  ).toBeGreaterThan(0);
});

it("restores an archived habit without losing its history", async () => {
  seedHabits();
  appStore.getState().setHabitStatus("habit-music", "archived");
  const log = appStore
    .getState()
    .addLog({ habit_id: "habit-music", user_id: "demo-user", amount: 1 });
  render(<AppWithProviders />);
  expect(screen.queryByLabelText("Music practice card")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Archived" }));
  const card = await screen.findByLabelText("Music practice card");
  fireEvent.click(within(card).getByRole("button", { name: "Restore" }));
  expect(appStore.getState().habits.find((h) => h.id === "habit-music")?.status).toBe(
    "active",
  );
  expect(appStore.getState().logs).toContainEqual(log);
});

it("starts a fresh habit form each time and returns focus on Escape", async () => {
  render(<AppWithProviders />);
  const open = screen.getByRole("button", { name: "New Habit" });
  open.focus();
  fireEvent.click(open);
  const name = screen.getByRole("textbox", { name: "Name" });
  expect(name).toHaveFocus();
  fireEvent.change(name, { target: { value: "Draft" } });
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(open).toHaveFocus();
  fireEvent.click(open);
  expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("");
});

it("rejects an invalid timezone without changing saved settings", async () => {
  seedHabits();
  render(<AppWithProviders />);
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.change(screen.getByLabelText("Timezone"), {
    target: { value: "not/a-timezone" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
  expect(screen.getByText(/Choose a valid timezone/)).toBeInTheDocument();
  expect(appStore.getState().settings?.timezone).toBe("UTC");
});

it("saves a reflection for the week being viewed", async () => {
  seedHabits();
  appStore.setState({ selectedDate: "2025-12-17T12:00:00Z" });
  render(<AppWithProviders />);
  fireEvent.click(screen.getByRole("button", { name: "Reflections" }));
  fireEvent.change(screen.getByLabelText("What went well?"), {
    target: { value: "Made time for music" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save reflection" }));
  expect(appStore.getState().reflections[0].week_start_date).toBe("2025-12-14");
});

it("can undo a removed check-in with its original date and note", async () => {
  seedHabits();
  render(<AppWithProviders />);
  fireEvent.change(screen.getByLabelText("Note (optional)"), {
    target: { value: "A lovely practice" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^\+ Add 1 sessions$/ }));
  const original = appStore.getState().logs[0];
  expect(screen.getByLabelText("Note (optional)")).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(appStore.getState().logs).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(appStore.getState().logs[0]).toMatchObject({
    target_date: original.target_date,
    timestamp: original.timestamp,
    note: original.note,
    amount: original.amount,
  });
});
