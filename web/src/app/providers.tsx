"use client";
// Client-side providers for the whole app: React Query (server state) and auth (who is logged in).
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { MockGate } from "../components/MockGate";
import { AuthProvider } from "../features/auth/auth-context";
import { makeQueryClient } from "../lib/query-client";

export function Providers({ children }: { children: React.ReactNode }) {
  // useState, not a module variable: one client per browser tab, created once, never shared.
  const [queryClient] = useState(makeQueryClient);
  return (
    <MockGate>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </MockGate>
  );
}
