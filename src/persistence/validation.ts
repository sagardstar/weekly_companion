import { PersistedState } from "../types/schema";
import { SCHEMA_VERSION } from "./schema";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateImportPayload(payload: unknown): ValidationResult {
  const errors: string[] = [];

  if (!payload || typeof payload !== "object") {
    return { valid: false, errors: ["Payload must be an object"] };
  }

  const data = payload as Partial<PersistedState>;

  if (typeof data.schemaVersion !== "number") {
    errors.push("schemaVersion is missing or invalid");
  } else if (data.schemaVersion > SCHEMA_VERSION) {
    errors.push("schemaVersion is newer than supported");
  }

  if (!Array.isArray(data.habits)) errors.push("habits must be an array");
  if (!Array.isArray(data.logs)) errors.push("logs must be an array");
  if (!Array.isArray(data.reflections))
    errors.push("reflections must be an array");

  return { valid: errors.length === 0, errors };
}
