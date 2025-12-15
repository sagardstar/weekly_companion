import { describe, expect, it } from "vitest";
import { PersistedState } from "../types/schema";
import { parseImportedState, serializeState } from "./export";

const baseState: PersistedState = {
  settings: null,
  habits: [],
  logs: [],
  reflections: [],
  schemaVersion: 1,
};

describe("export/import helpers", () => {
  it("serializes state with schema version", () => {
    const json = serializeState(baseState);
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe(1);
  });

  it("parses valid JSON", () => {
    const json = serializeState(baseState);
    const { state, errors } = parseImportedState(json);
    expect(errors).toHaveLength(0);
    expect(state).toEqual(baseState);
  });

  it("returns errors for invalid JSON", () => {
    const { state, errors } = parseImportedState("{bad");
    expect(state).toBeNull();
    expect(errors[0]).toBe("Invalid JSON");
  });
});
