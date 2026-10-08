// Cognito: the user directory. Users sign up with email, confirm with an emailed code, and log in.
// Admins are users in the "admin" group (the group appears in the token's "cognito:groups" claim).
// CONCEPT: authentication, oauth-pkce
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { appUrl } from "./cdn";
import { stage } from "./config";

// Step 1: the user pool. Email is the username; Cognito hashes passwords for us (we never see them stored).
// ESSENTIALS tier: required for the new managed login pages; free up to 10,000 monthly active users.
export const userPool = new aws.cognito.UserPool("users", {
  name: `ticketlite-${stage}`,
  userPoolTier: "ESSENTIALS",
  usernameAttributes: ["email"],
  autoVerifiedAttributes: ["email"],
  // Must match PasswordSchema in packages/shared/src/auth.ts.
  passwordPolicy: {
    minimumLength: 10,
    requireLowercase: true,
    requireUppercase: true,
    requireNumbers: true,
    requireSymbols: false,
    temporaryPasswordValidityDays: 3,
  },
  accountRecoverySetting: { recoveryMechanisms: [{ name: "verified_email", priority: 1 }] },
  // Cognito's built-in email sender: free, but limited to about 50 emails a day. Fine for learning.
  emailConfiguration: { emailSendingAccount: "COGNITO_DEFAULT" },
});

// Step 2: the admin group. Put a user in it with:
//   aws cognito-idp admin-add-user-to-group --user-pool-id <id> --username <email> --group-name admin
new aws.cognito.UserGroup("admin", {
  userPoolId: userPool.id,
  name: "admin",
  description: "Can create and edit events",
});

// Step 3: the hosted "managed login" domain, used by the authorization code + PKCE demo.
// The prefix must be globally unique, so it includes the AWS account ID.
const accountId = aws.getCallerIdentityOutput().accountId;
export const userPoolDomain = new aws.cognito.UserPoolDomain("users-domain", {
  userPoolId: userPool.id,
  domain: pulumi.interpolate`ticketlite-${stage}-${accountId}`,
  managedLoginVersion: 2, // the newer managed login pages (v1 is the classic hosted UI)
});

// Step 4: ONE app client, used by the BFF (the Fastify API). No client secret: the PKCE flow is
// designed for public clients, and the API never stores a secret for it.
export const userPoolClient = new aws.cognito.UserPoolClient("web-client", {
  userPoolId: userPool.id,
  name: `ticketlite-web-${stage}`,
  generateSecret: false,
  // The custom login form: the API sends email + password to Cognito (USER_PASSWORD_AUTH) over HTTPS,
  // and refreshes tokens with the refresh token.
  explicitAuthFlows: ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
  // The PKCE demo: managed login redirects back to the API with a one-time code.
  allowedOauthFlowsUserPoolClient: true,
  allowedOauthFlows: ["code"],
  allowedOauthScopes: ["openid", "email", "profile"],
  supportedIdentityProviders: ["COGNITO"],
  callbackUrls: [
    pulumi.interpolate`${appUrl}/api/auth/oauth/callback`,
    "http://localhost:3000/api/auth/oauth/callback",
  ],
  logoutUrls: [appUrl, "http://localhost:3001"],
  // Short-lived access tokens limit the damage of a stolen one; the refresh cookie lasts a week.
  accessTokenValidity: 15,
  idTokenValidity: 15,
  refreshTokenValidity: 7,
  tokenValidityUnits: { accessToken: "minutes", idToken: "minutes", refreshToken: "days" },
  enableTokenRevocation: true, // lets logout revoke the refresh token (RevokeToken)
  preventUserExistenceErrors: "ENABLED", // "wrong email or password", never "no such user". CONCEPT: user-enumeration
});

// Step 5: managed login v2 needs a branding style per client. Cognito's defaults are fine for a demo.
new aws.cognito.ManagedLoginBranding("web-client-branding", {
  userPoolId: userPool.id,
  clientId: userPoolClient.id,
  useCognitoProvidedValues: true,
});

// The token issuer: API Gateway's JWT authorizer and the API check that tokens come from this pool.
export const issuerUrl = pulumi.interpolate`https://cognito-idp.us-east-1.amazonaws.com/${userPool.id}`;
export const cognitoDomainUrl = pulumi.interpolate`https://${userPoolDomain.domain}.auth.us-east-1.amazoncognito.com`;
