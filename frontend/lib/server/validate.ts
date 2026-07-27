import { badRequest } from "./errors";

/**
 * Mirrors Sub0's `payload_validation`: declare the shape, get a 400 with a readable message
 * when it doesn't match. Same field types we used in the endpoint JSON.
 */

export type FieldType = "STRING" | "NUMBER" | "EMAIL" | "OBJECT" | "ARRAY" | "STRINGARRAY";

export interface FieldRule {
  type: FieldType;
  min_length?: number;
  max_length?: number;
  min?: number;
  max?: number;
  optional?: boolean;
}

export type Spec = Record<string, FieldRule>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validate(payload: Record<string, unknown>, spec: Spec): void {
  for (const [field, rule] of Object.entries(spec)) {
    const value = payload[field];

    if (value === undefined || value === null || value === "") {
      if (rule.optional) continue;
      throw badRequest(`"${field}" is required`);
    }

    switch (rule.type) {
      case "STRING":
      case "EMAIL": {
        if (typeof value !== "string") throw badRequest(`"${field}" must be text`);
        const text = value.trim();
        if (rule.min_length !== undefined && text.length < rule.min_length) {
          throw badRequest(`"${field}" must be at least ${rule.min_length} characters`);
        }
        if (rule.max_length !== undefined && text.length > rule.max_length) {
          throw badRequest(`"${field}" must be at most ${rule.max_length} characters`);
        }
        if (rule.type === "EMAIL" && !EMAIL_RE.test(text)) {
          throw badRequest(`"${field}" must be a valid email address`);
        }
        break;
      }
      case "NUMBER": {
        const num = typeof value === "string" ? Number(value) : value;
        if (typeof num !== "number" || !Number.isFinite(num)) {
          throw badRequest(`"${field}" must be a number`);
        }
        if (rule.min !== undefined && num < rule.min) {
          throw badRequest(`"${field}" must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && num > rule.max) {
          throw badRequest(`"${field}" must be at most ${rule.max}`);
        }
        break;
      }
      case "OBJECT": {
        if (typeof value !== "object" || Array.isArray(value)) {
          throw badRequest(`"${field}" must be an object`);
        }
        break;
      }
      case "ARRAY":
      case "STRINGARRAY": {
        if (!Array.isArray(value)) throw badRequest(`"${field}" must be an array`);
        if (rule.type === "STRINGARRAY" && value.some((v) => typeof v !== "string")) {
          throw badRequest(`"${field}" must be an array of strings`);
        }
        if (rule.min_length !== undefined && value.length < rule.min_length) {
          throw badRequest(`"${field}" needs at least ${rule.min_length} item(s)`);
        }
        break;
      }
    }
  }
}

/** Coerces a payload number the way the SQL casts expect (`$n::int`, `$n::float8`). */
export function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : fallback;
}

export function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
