// /login
import { PageHeading } from "../../components/PageHeading";
import { LoginForm } from "../../features/auth/LoginForm";

export default function LoginPage() {
  return (
    <section className="flex flex-col gap-4">
      <PageHeading>Log in</PageHeading>
      <LoginForm />
    </section>
  );
}
