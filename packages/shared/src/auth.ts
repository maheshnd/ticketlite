// Zod schemas for the auth forms and responses. The web forms and the API validate with the same rules.
// The password rules mirror the Cognito user pool's password policy (infra/cognito.ts).
import { z } from "zod";

// Step 1: building blocks.
export const EmailSchema = z.email("Enter a valid email address").max(254);
export const PasswordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a number");
// Cognito sends a 6-digit code by email for sign-up confirmation and password reset.
export const CodeSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code from the email");

// Step 2: one schema per form / endpoint body.
export const SignupInputSchema = z.object({ email: EmailSchema, password: PasswordSchema });
export const ConfirmInputSchema = z.object({ email: EmailSchema, code: CodeSchema });
// Login only checks that a password was typed: the policy may have changed since the user signed up.
export const LoginInputSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, "Enter your password"),
});
export const ForgotInputSchema = z.object({ email: EmailSchema });
export const ResetInputSchema = z.object({
  email: EmailSchema,
  code: CodeSchema,
  newPassword: PasswordSchema,
});

export type SignupInput = z.infer<typeof SignupInputSchema>;
export type ConfirmInput = z.infer<typeof ConfirmInputSchema>;
export type LoginInput = z.infer<typeof LoginInputSchema>;
export type ForgotInput = z.infer<typeof ForgotInputSchema>;
export type ResetInput = z.infer<typeof ResetInputSchema>;

// Step 3: what login and refresh return. Only the ACCESS token goes in the body; the web app keeps it in
// memory. The refresh token travels in an HttpOnly cookie that JavaScript can't read. CONCEPT: token-storage
export const TokenResponseSchema = z.object({ accessToken: z.string(), expiresIn: z.number().int() });
export type TokenResponse = z.infer<typeof TokenResponseSchema>;

// Step 4: the current user, as returned by GET /api/me.
export const MeSchema = z.object({
  userId: z.string(),
  email: z.string(),
  groups: z.array(z.string()),
});
export type Me = z.infer<typeof MeSchema>;
