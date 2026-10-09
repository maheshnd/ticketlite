"use client";
// Confirm the email address with the code Cognito sent. The email comes pre-filled from the sign-up page.
import { ConfirmInputSchema } from "@ticketlite/shared";
import { useRouter } from "next/navigation";
import { FormAlert } from "../../components/FormAlert";
import { SubmitButton } from "../../components/SubmitButton";
import { TextField } from "../../components/TextField";
import { apiFetch } from "../../lib/api-client";
import { useForm } from "./use-form";

export function ConfirmForm({ email }: { email: string }) {
  const router = useRouter();
  const form = useForm(ConfirmInputSchema, { email, code: "" }, async (data) => {
    await apiFetch("/api/auth/confirm", { method: "POST", body: data });
    router.push("/login?confirmed=1");
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
      <TextField
        id="code"
        label="6-digit code"
        autoComplete="one-time-code"
        value={form.values.code!}
        error={form.errors.code}
        onChange={form.setValue("code")}
      />
      <SubmitButton submitting={form.submitting}>Confirm</SubmitButton>
    </form>
  );
}
