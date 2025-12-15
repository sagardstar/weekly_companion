import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { appStore } from "./store";
import { AppWithProviders } from "./App";

beforeEach(() => {
  appStore.setState({ settings: null, habits: [], logs: [], reflections: [] }, false);
});

describe("App layout and navigation", () => {
  it("renders dashboard by default with seeded habits", async () => {
    render(<AppWithProviders />);
    expect(screen.getByRole("heading", { name: /habit dashboard/i })).toBeInTheDocument();
    const cards = await screen.findAllByRole("article");
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });

  it("switches tabs when navigation buttons are clicked", () => {
    render(<AppWithProviders />);
    const reflectionsTab = screen.getByRole("button", { name: /reflections/i });
    fireEvent.click(reflectionsTab);
    expect(screen.getByText(/Week at a glance/i)).toBeInTheDocument();
  });

  it("shows toast and supports undo when adding a log", async () => {
    render(<AppWithProviders />);
    const card = await screen.findByLabelText(/Music practice card/i);
    const addBtn = within(card).getByRole("button", { name: /^\+ add$/i });
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
    render(<AppWithProviders />);
    const card = await screen.findByLabelText(/Music practice card/i);
    const amountInput = within(card).getByLabelText(/custom amount/i);
    fireEvent.change(amountInput, { target: { value: "2" } });
    const addCustom = within(card).getByRole("button", { name: /\+ add custom/i });
    fireEvent.click(addCustom);

    await waitFor(() =>
      expect(within(card).getByText(/2 \/ 3 sessions/i)).toBeInTheDocument(),
    );
  });

  it("disables logging controls for paused habits", async () => {
    render(<AppWithProviders />);
    const strengthCard = await screen.findByLabelText(/Strength card/i);
    const addButtons = within(strengthCard).getAllByRole("button", { name: /\+ add/i });
    addButtons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it("shows habit detail logs and supports deletion", async () => {
    render(<AppWithProviders />);
    const detailAdd = await screen.findByRole("button", { name: /\+ add 1 sessions/i });
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
    render(<AppWithProviders />);
    const statusSelect = await screen.findByLabelText(/Status:/i);
    fireEvent.change(statusSelect, { target: { value: "paused" } });
    const detailAdd = await screen.findByRole("button", { name: /\+ add 1 sessions/i });
    expect(detailAdd).toBeDisabled();
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
    render(<AppWithProviders />);
    const card = await screen.findByLabelText(/Music practice card/i);
    const addBtn = within(card).getByRole("button", { name: /^\+ add$/i });
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
