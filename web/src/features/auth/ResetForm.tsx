"use client";
// Finish a password reset with the emailed code and a new password.
import { ResetInputSchema } from "@ticketlite/shared";
import { useRouter } from "next/navigation";
import { FormAlert } from "../../components/FormAlert";
import { TextField } from "../../components/TextField";
import { apiFetch } from "../../lib/api-client";
import { useForm } from "./use-form";

export function ResetForm({ email }: { email: string }) {
  const router = useRouter();
  const form = useForm(ResetInputSchema, { email, code: "", newPassword: "" }, async (data) => {
    await apiFetch("/api/auth/reset", { method: "POST", body: data });
    router.push("/login?reset=1");
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
      <TextField
        id="newPassword"
        label="New password"
        type="password"
        autoComplete="new-password"
        value={form.values.newPassword!}
        error={form.errors.newPassword}
        onChange={form.setValue("newPassword")}
      />
      <button
        type="submit"
        disabled={form.submitting}
        className="rounded bg-indigo-700 px-4 py-2 text-white disabled:opacity-60"
      >
        Reset password
      </button>
    </form>
  );
}
