import PageShell from "../../../components/PageShell";
import AuthForm from "../../../components/AuthForm";

export default function ForgotPasswordPage() {
  return (
    <PageShell title="Reset password" description="Request a password reset.">
      <AuthForm kind="forgot-password" />
    </PageShell>
  );
}
