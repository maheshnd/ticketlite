// Thin wrappers around the Cognito API calls the BFF makes. One function per call, nothing clever.
// These calls need no IAM permission: they are Cognito's PUBLIC APIs (authenticated by password, code or
// token), the same ones a mobile app would call. The client is created once per Lambda copy.
import {
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  GetUserCommand,
  InitiateAuthCommand,
  RevokeTokenCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { config } from "../config";

const client = new CognitoIdentityProviderClient({
  region: config.region,
  requestHandler: new NodeHttpHandler({ connectionTimeout: 1000, requestTimeout: 3000 }), // CONCEPT: timeout-chain
});
const ClientId = config.cognito.clientId;

export async function signUp(email: string, password: string) {
  await client.send(new SignUpCommand({ ClientId, Username: email, Password: password }));
}

export async function confirmSignUp(email: string, code: string) {
  await client.send(new ConfirmSignUpCommand({ ClientId, Username: email, ConfirmationCode: code }));
}

// Email + password -> tokens. Cognito checks the password hash; we never store or log the password.
export async function passwordLogin(email: string, password: string) {
  const result = await client.send(
    new InitiateAuthCommand({
      ClientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }),
  );
  return result.AuthenticationResult;
}

// Refresh token -> new access token. (Without refresh-token rotation, Cognito returns no new refresh token.)
export async function refreshLogin(refreshToken: string) {
  const result = await client.send(
    new InitiateAuthCommand({
      ClientId,
      AuthFlow: "REFRESH_TOKEN_AUTH",
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    }),
  );
  return result.AuthenticationResult;
}

// Logout: revoking the refresh token also invalidates the access tokens issued from it (Cognito checks
// revocation when tokens are used against Cognito; API Gateway can't see it, which is why access tokens
// are short-lived). CONCEPT: jwt-logout
export async function revokeRefreshToken(refreshToken: string) {
  await client.send(new RevokeTokenCommand({ ClientId, Token: refreshToken }));
}

export async function forgotPassword(email: string) {
  await client.send(new ForgotPasswordCommand({ ClientId, Username: email }));
}

export async function confirmForgotPassword(email: string, code: string, newPassword: string) {
  await client.send(
    new ConfirmForgotPasswordCommand({
      ClientId,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
    }),
  );
}

// The access token has no email claim, so GET /api/me asks Cognito for the user's attributes.
export async function getUserEmail(accessToken: string): Promise<string> {
  const result = await client.send(new GetUserCommand({ AccessToken: accessToken }));
  return result.UserAttributes?.find((a) => a.Name === "email")?.Value ?? "";
}
