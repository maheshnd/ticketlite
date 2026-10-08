// The current user (id, email, groups) from GET /api/me. Only fetched when logged in.
import type { Me } from "@ticketlite/shared";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api-client";
import { authKeys } from "../../lib/query-keys";
import { useAuth } from "./auth-context";

export function useMe() {
  const { status } = useAuth();
  return useQuery({
    queryKey: authKeys.me,
    queryFn: () => apiFetch<Me>("/api/me"),
    enabled: status === "authenticated",
    staleTime: 5 * 60_000, // groups rarely change
  });
}

export function useIsAdmin() {
  return useMe().data?.groups.includes("admin") ?? false;
}
