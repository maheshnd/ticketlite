// Holds the access token IN MEMORY only (a module variable), never in localStorage or a readable cookie.
// Memory is wiped on reload, which is why the app calls /api/auth/refresh on every page load: the
// HttpOnly refresh cookie (which JavaScript can't read) gets a fresh access token. CONCEPT: token-storage
type Listener = (token: string | null) => void;

let accessToken: string | null = null;
const listeners = new Set<Listener>();

export const getAccessToken = () => accessToken;

// Every change is broadcast, so the auth context (React state) stays in sync with this variable.
export function setAccessToken(token: string | null) {
  accessToken = token;
  for (const listener of listeners) listener(token);
}

export function onAccessTokenChange(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
