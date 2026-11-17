import PageShell from "../../../components/PageShell";
import AuthForm from "../../../components/AuthForm";

export default function LoginPage() {
  return (
    <PageShell title="Sign in" description="Access your account.">
      <AuthForm kind="login" />
    </PageShell>
  );
}
