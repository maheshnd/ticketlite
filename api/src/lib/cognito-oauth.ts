// The OAuth 2.0 endpoints of Cognito managed login, used by the authorization code + PKCE demo.
// These are plain HTTPS endpoints (not the AWS SDK), so we call them with fetch. CONCEPT: oauth-pkce
import { config } from "../config";

// Must exactly match one of the client's callbackUrls in infra/cognito.ts.
export const redirectUri = () => `${config.apiPublicUrl}/api/auth/oauth/callback`;

// Step 1: the URL we send the browser to. Cognito shows its login page, then redirects back with ?code=.
export function authorizeUrl(state: string, codeChallenge: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.cognito.clientId,
    redirect_uri: redirectUri(),
    scope: "openid email profile",
    state, // echoed back; proves the callback belongs to a login WE started (CSRF protection)
    code_challenge: codeChallenge, // SHA-256 of the secret verifier
    code_challenge_method: "S256",
  });
  return `${config.cognito.domainUrl}/oauth2/authorize?${params}`;
}

// Step 2: swap the one-time code for tokens. Cognito checks that SHA-256(code_verifier) equals the
// challenge sent in step 1, so a stolen code is useless without the verifier (which never left the server).
export async function exchangeCode(code: string, codeVerifier: string) {
  const response = await fetch(`${config.cognito.domainUrl}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.cognito.clientId,
      code,
      redirect_uri: redirectUri(),
      code_verifier: codeVerifier,
    }),
    signal: AbortSignal.timeout(3000), // CONCEPT: timeout-chain
  });
  if (!response.ok) throw new Error(`token endpoint returned ${response.status}`);
  return (await response.json()) as { access_token: string; refresh_token: string; expires_in: number };
}
