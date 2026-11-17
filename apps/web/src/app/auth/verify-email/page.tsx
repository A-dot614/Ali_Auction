import PageShell from "../../../components/PageShell";
import AuthForm from "../../../components/AuthForm";

export default function VerifyEmailPage() {
  return (
    <PageShell title="Verify email" description="Enter the token from your email.">
      <AuthForm kind="verify-email" />
    </PageShell>
  );
}
