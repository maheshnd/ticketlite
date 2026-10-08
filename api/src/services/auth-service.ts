// Auth logic for the BFF: calls Cognito and turns Cognito's error names into our HTTP errors.
// Messages are deliberately vague where precision would help an attacker. CONCEPT: user-enumeration
import { HttpError, badRequest, conflict, forbidden, tooManyRequests, unauthorized } from "../errors";
import * as cognito from "../lib/cognito";

// Step 1: map a Cognito exception (by its `name`) to an HttpError. Unknown errors are re-thrown -> 500.
function toHttpError(error: unknown): never {
  const name = (error as { name?: string }).name;
  switch (name) {
    case "UsernameExistsException":
      throw conflict("An account with this email already exists.");
    case "NotAuthorizedException":
      throw unauthorized("Wrong email or password, or the session has ended. Log in again.");
    case "UserNotConfirmedException":
      throw forbidden("Confirm your email first. We sent you a code.");
    case "CodeMismatchException":
    case "ExpiredCodeException":
      throw badRequest("The code is wrong or has expired.");
    case "InvalidPasswordException":
      throw badRequest("The password does not meet the policy.");
    case "LimitExceededException":
    case "TooManyRequestsException":
    case "TooManyFailedAttemptsException":
      throw tooManyRequests(60);
    default:
      throw error;
  }
}

// Step 2: wrap every call, so routes never see a raw Cognito error.
async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    return toHttpError(error);
  }
}

export const signUp = (email: string, password: string) => call(() => cognito.signUp(email, password));
export const confirmSignUp = (email: string, code: string) => call(() => cognito.confirmSignUp(email, code));
export const resetPassword = (email: string, code: string, newPassword: string) =>
  call(() => cognito.confirmForgotPassword(email, code, newPassword));
export const getEmail = (accessToken: string) => call(() => cognito.getUserEmail(accessToken));

// Forgot password always "succeeds": answering "no such user" would reveal which emails have accounts.
export async function forgotPassword(email: string) {
  await call(() => cognito.forgotPassword(email)).catch((error) => {
    if (error instanceof HttpError && error.statusCode === 429) throw error;
  });
}

export type Tokens = { accessToken: string; refreshToken?: string; expiresIn: number };

export async function login(email: string, password: string): Promise<Tokens> {
  const result = await call(() => cognito.passwordLogin(email, password));
  if (!result?.AccessToken) throw unauthorized(); // e.g. Cognito asked for MFA, which this app doesn't use
  return {
    accessToken: result.AccessToken,
    refreshToken: result.RefreshToken,
    expiresIn: result.ExpiresIn ?? 900,
  };
}

export async function refresh(refreshToken: string): Promise<Tokens> {
  const result = await call(() => cognito.refreshLogin(refreshToken));
  if (!result?.AccessToken) throw unauthorized();
  return { accessToken: result.AccessToken, expiresIn: result.ExpiresIn ?? 900 };
}

// Logout must succeed even if the token is already invalid: the goal ("logged out") is reached either way.
export async function logout(refreshToken: string | undefined) {
  if (!refreshToken) return;
  await cognito.revokeRefreshToken(refreshToken).catch(() => undefined);
}
