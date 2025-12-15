
import { createClient } from "@supabase/supabase-js";
import { describe, it, expect } from "vitest";

describe("repro crash", () => {
  it("does not throw when url is placeholder", () => {
     const client = createClient("https://placeholder.supabase.co", "placeholder");
     expect(client).toBeDefined();
  });
});
