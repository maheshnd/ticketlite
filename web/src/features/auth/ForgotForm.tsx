"use client";
// Start a password reset. The API answers the same way whether or not the email exists.
import { ForgotInputSchema } from "@ticketlite/shared";
import { useRouter } from "next/navigation";
import { FormAlert } from "../../components/FormAlert";
import { SubmitButton } from "../../components/SubmitButton";
import { TextField } from "../../components/TextField";
import { apiFetch } from "../../lib/api-client";
import { useForm } from "./use-form";

export function ForgotForm() {
  const router = useRouter();
  const form = useForm(ForgotInputSchema, { email: "" }, async (data) => {
    await apiFetch("/api/auth/forgot", { method: "POST", body: data });
    router.push(`/reset?email=${encodeURIComponent(data.email)}`);
  });

  return (
    <form noValidate onSubmit={form.onSubmit} className="flex max-w-sm flex-col gap-4">
      <FormAlert message={form.formError} />
      <TextField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        value={form.values.email!}
        error={form.errors.email}
        onChange={form.setValue("email")}
      />
      <SubmitButton submitting={form.submitting}>Send reset code</SubmitButton>
    </form>
  );
}
