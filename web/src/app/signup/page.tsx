// /signup
import { PageHeading } from "../../components/PageHeading";
import { SignupForm } from "../../features/auth/SignupForm";

export default function SignupPage() {
  return (
    <section className="flex flex-col gap-4">
      <PageHeading>Create an account</PageHeading>
      <SignupForm />
    </section>
  );
}
