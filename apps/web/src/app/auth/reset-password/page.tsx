import PageShell from "../../../components/PageShell";
import AuthForm from "../../../components/AuthForm";

export default function ResetPasswordPage() {
  return (
    <PageShell title="Choose a new password" description="Enter your reset token and new password.">
      <AuthForm kind="reset-password" />
    </PageShell>
  );
}
