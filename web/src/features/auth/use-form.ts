// A tiny form helper shared by the forms: values, field errors, a form-level error, submitting state.
// On submit it validates with the shared Zod schema first; only valid data reaches `onValid`.
// Inputs always hold strings; `prepare` converts them (e.g. "499" -> 499) before validation.
// CONCEPT: schema-validation
import { useState } from "react";
import type { z } from "zod";
import { ApiError } from "../../lib/api-client";
import { focusFirstError, validate, type FieldErrors } from "../../lib/validate";

type Values = Record<string, string>;

export function useForm<T>(
  schema: z.ZodType<T>,
  initial: Values,
  onValid: (data: T) => Promise<void>,
  prepare: (values: Values) => unknown = (values) => values,
) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setValue = (field: string) => (value: string) => setValues((v) => ({ ...v, [field]: value }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    // Step 1: client-side validation (instant feedback, same rules as the API).
    const { data, errors: fieldErrors } = validate(schema, prepare(values));
    setErrors(fieldErrors);
    if (!data) return focusFirstError(fieldErrors);

    // Step 2: call the API. Its problem+json "detail" is written for humans, so we show it as-is.
    setSubmitting(true);
    try {
      await onValid(data);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.detail : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return { values, errors, formError, submitting, setValue, onSubmit };
}
