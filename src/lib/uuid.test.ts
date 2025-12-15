import { describe, expect, it } from "vitest";
import { generateUUID } from "./uuid";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateUUID", () => {
  it("creates a v4 UUID string", () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(UUID_REGEX);
  });

  it("produces unique values across calls", () => {
    const first = generateUUID();
    const second = generateUUID();
    expect(first).not.toEqual(second);
  });
});
