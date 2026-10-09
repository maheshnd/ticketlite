"use client";
// Top navigation. Shows "Log in" or "Log out" depending on the auth state.
import Link from "next/link";
import { useAuth } from "../features/auth/auth-context";
import { useIsAdmin } from "../features/auth/use-me";

export function NavBar() {
  const { status, logout } = useAuth();
  const isAdmin = useIsAdmin();
  return (
    <nav aria-label="Main" className="mx-auto flex max-w-5xl items-center gap-6 p-4">
      <Link href="/" className="text-lg font-bold text-indigo-700">
        TicketLite
      </Link>
      <Link href="/search" className="text-slate-700 underline">
        Search
      </Link>
      <Link href="/learn" className="text-slate-700 underline">
        Learn
      </Link>
      <div className="ml-auto flex items-center gap-4">
        {isAdmin && (
          <Link href="/admin/events" className="text-slate-700 underline">
            Admin
          </Link>
        )}
        {status === "authenticated" && (
          <Link href="/bookings" className="text-slate-700 underline">
            My bookings
          </Link>
        )}
        {status === "authenticated" && (
          <button type="button" onClick={() => void logout()} className="text-slate-700 underline">
            Log out
          </button>
        )}
        {status === "anonymous" && (
          <Link href="/login" className="text-indigo-700 underline">
            Log in
          </Link>
        )}
      </div>
    </nav>
  );
}
