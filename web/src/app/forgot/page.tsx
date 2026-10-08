// /forgot
import { PageHeading } from "../../components/PageHeading";
import { ForgotForm } from "../../features/auth/ForgotForm";

export default function ForgotPage() {
  return (
    <section className="flex flex-col gap-4">
      <PageHeading>Forgot your password?</PageHeading>
      <ForgotForm />
    </section>
  );
}
