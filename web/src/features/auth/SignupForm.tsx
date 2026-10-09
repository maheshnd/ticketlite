"use client";
// Sign-up form. Cognito emails a 6-digit code; the confirm page comes next.
import { SignupInputSchema } from "@ticketlite/shared";
import { useRouter } from "next/navigation";
import { FormAlert } from "../../components/FormAlert";
import { SubmitButton } from "../../components/SubmitButton";
import { TextField } from "../../components/TextField";
import { apiFetch } from "../../lib/api-client";
import { useForm } from "./use-form";

export function SignupForm() {
  const router = useRouter();
  const form = useForm(SignupInputSchema, { email: "", password: "" }, async (data) => {
    await apiFetch("/api/auth/signup", { method: "POST", body: data });
    router.push(`/confirm?email=${encodeURIComponent(data.email)}`);
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
        id="password"
        label="Password (10+ characters, upper and lower case, a number)"
        type="password"
        autoComplete="new-password"
        value={form.values.password!}
        error={form.errors.password}
        onChange={form.setValue("password")}
      />
      <SubmitButton submitting={form.submitting} busyLabel="Creating account…">
        Sign up
      </SubmitButton>
    </form>
  );
}
