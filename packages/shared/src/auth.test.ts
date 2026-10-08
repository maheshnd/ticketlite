// Tests for the auth schemas: the password policy must match Cognito's, or users get confusing errors.
import { describe, expect, it } from "vitest";
import { PasswordSchema, SignupInputSchema } from "./auth";

describe("PasswordSchema", () => {
  it("accepts a password that meets the Cognito policy", () => {
    expect(PasswordSchema.safeParse("Tickets2026x").success).toBe(true);
  });

  it("explains what is missing", () => {
    const result = PasswordSchema.safeParse("alllowercase1");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Add an uppercase letter");
  });
});

describe("SignupInputSchema", () => {
  it("rejects an invalid email with a readable message", () => {
    const result = SignupInputSchema.safeParse({ email: "nope", password: "Tickets2026x" });
    expect(result.error?.issues[0]?.message).toBe("Enter a valid email address");
  });
});
