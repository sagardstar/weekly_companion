import { describe, expect, it } from "vitest";
import { validateImportPayload } from "./validation";

describe("validateImportPayload", () => {
  it("rejects non-object payloads", () => {
    const result = validateImportPayload(null);
    expect(result.valid).toBe(false);
  });

  it("rejects future schema versions", () => {
    const result = validateImportPayload({
      schemaVersion: 99,
      habits: [],
      logs: [],
      reflections: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("schemaVersion is newer than supported");
  });

  it("accepts minimal valid payload", () => {
    const result = validateImportPayload({
      schemaVersion: 1,
      habits: [],
      logs: [],
      reflections: [],
    });
    expect(result.valid).toBe(true);
  });
});
