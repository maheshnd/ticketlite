"use client";
// /reset?email=... The email comes from the forgot-password page.
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageHeading } from "../../components/PageHeading";
import { ResetForm } from "../../features/auth/ResetForm";

function Content() {
  return <ResetForm email={useSearchParams().get("email") ?? ""} />;
}

export default function ResetPage() {
  return (
    <section className="flex flex-col gap-4">
      <PageHeading>Choose a new password</PageHeading>
      <Suspense>
        <Content />
      </Suspense>
    </section>
  );
}
