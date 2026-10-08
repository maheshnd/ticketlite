"use client";
// Auth state for the whole app: "loading" until the first refresh answers, then "authenticated" or "anonymous".
// The token itself lives in lib/token-store.ts (memory only); this context mirrors it into React.
import type { LoginInput, TokenResponse } from "@ticketlite/shared";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import { apiFetch, refreshAccessToken } from "../../lib/api-client";
import { getAccessToken, onAccessTokenChange, setAccessToken } from "../../lib/token-store";

type Status = "loading" | "authenticated" | "anonymous";
type AuthContextValue = {
  status: Status;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>(getAccessToken() ? "authenticated" : "loading");

  useEffect(() => {
    // Step 1: follow the token store. A refresh inside apiFetch (after a 401) updates us too.
    const unsubscribe = onAccessTokenChange((token) => setStatus(token ? "authenticated" : "anonymous"));
    // Step 2: on page load, swap the HttpOnly refresh cookie for an access token (if the user has one).
    if (!getAccessToken()) void refreshAccessToken();
    return () => {
      unsubscribe();
    };
  }, []);

  async function login(input: LoginInput) {
    const tokens = await apiFetch<TokenResponse>("/api/auth/login", { method: "POST", body: input });
    setAccessToken(tokens.accessToken);
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST", headers: { "x-csrf": "1" } }).catch(() => undefined);
    setAccessToken(null);
    queryClient.clear(); // drop every cached response that belonged to this user
  }

  return <AuthContext.Provider value={{ status, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
