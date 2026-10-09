// Runs a shared Zod schema against form values and returns one message per field (the first problem).
// The API validates with the same schema, so the browser and the server always agree.
// CONCEPT: schema-validation
import type { z } from "zod";

export type FieldErrors = Record<string, string>;

export function validate<T>(schema: z.ZodType<T>, values: unknown): { data?: T; errors: FieldErrors } {
  const result = schema.safeParse(values);
  if (result.success) return { data: result.data, errors: {} };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return { errors };
}

// Moves focus to the first invalid field, so keyboard users land right on the problem.
export function focusFirstError(errors: FieldErrors) {
  const first = Object.keys(errors)[0];
  if (first) document.getElementById(first)?.focus();
}
