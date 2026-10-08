"use client";
// Shows its children only to admins. This is for the UI only: the API checks the admin group on every
// admin call, so hiding a page is never the security boundary. CONCEPT: rbac
import Link from "next/link";
import { useAuth } from "../auth/auth-context";
import { useMe } from "../auth/use-me";

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const me = useMe();

  if (status === "loading" || (status === "authenticated" && me.isPending))
    return <p role="status">Checking access…</p>;
  if (status === "anonymous") {
    return (
      <p>
        <Link href="/login" className="text-indigo-700 underline">
          Log in
        </Link>{" "}
        as an admin to continue.
      </p>
    );
  }
  if (!me.data?.groups.includes("admin")) return <p role="alert">Admins only.</p>;
  return <>{children}</>;
}
