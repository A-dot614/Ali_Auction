import PageShell from "../../../components/PageShell";
import AuthForm from "../../../components/AuthForm";

export default function RegisterPage() {
  return (
    <PageShell title="Create account" description="Register to bid and sell.">
      <AuthForm kind="register" />
    </PageShell>
  );
}
