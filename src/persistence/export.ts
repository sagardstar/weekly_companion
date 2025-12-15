import { PersistedState } from "../types/schema";
import { SCHEMA_VERSION } from "./schema";
import { validateImportPayload } from "./validation";

export function serializeState(state: PersistedState): string {
  return JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION });
}

export function parseImportedState(json: string): {
  state: PersistedState | null;
  errors: string[];
} {
  try {
    const parsed = JSON.parse(json);
    const result = validateImportPayload(parsed);
    if (!result.valid) {
      return { state: null, errors: result.errors };
    }
    return {
      state: {
        ...parsed,
        schemaVersion: parsed.schemaVersion ?? SCHEMA_VERSION,
      } as PersistedState,
      errors: [],
    };
  } catch (error) {
    return { state: null, errors: ["Invalid JSON", String(error)] };
  }
}
