"use client";
// Login form. On success the access token is stored in memory and the user goes back to the events.
import { LoginInputSchema } from "@ticketlite/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormAlert } from "../../components/FormAlert";
import { SubmitButton } from "../../components/SubmitButton";
import { TextField } from "../../components/TextField";
import { useAuth } from "./auth-context";
import { useForm } from "./use-form";

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const form = useForm(LoginInputSchema, { email: "", password: "" }, async (data) => {
    await login(data);
    router.push("/");
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
        label="Password"
        type="password"
        autoComplete="current-password"
        value={form.values.password!}
        error={form.errors.password}
        onChange={form.setValue("password")}
      />
      <SubmitButton submitting={form.submitting} busyLabel="Logging in…">
        Log in
      </SubmitButton>
      <LoginLinks />
    </form>
  );
}

// Other ways in. "Log in with Cognito" is the authorization code + PKCE demo: a full-page redirect to
// Cognito's managed login (not a fetch), which comes back to the API's callback. CONCEPT: oauth-pkce
function LoginLinks() {
  return (
    <p className="flex gap-4 text-sm">
      <Link href="/signup" className="underline">
        Create an account
      </Link>
      <Link href="/forgot" className="underline">
        Forgot password?
      </Link>
      <a href={`${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/auth/oauth/start`} className="underline">
        Log in with Cognito
      </a>
    </p>
  );
}
