"use client";
// /confirm?email=... The email comes from the sign-up page.
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageHeading } from "../../components/PageHeading";
import { ConfirmForm } from "../../features/auth/ConfirmForm";

function Content() {
  return <ConfirmForm email={useSearchParams().get("email") ?? ""} />;
}

export default function ConfirmPage() {
  return (
    <section className="flex flex-col gap-4">
      <PageHeading>Confirm your email</PageHeading>
      <p>We emailed you a 6-digit code.</p>
      <Suspense>
        <Content />
      </Suspense>
    </section>
  );
}
