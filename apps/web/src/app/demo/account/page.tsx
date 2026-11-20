import Link from "next/link";
import PageShell from "../../../components/PageShell";
import NotEnabled from "../../../components/NotEnabled";
import DemoProfileForm from "../../../components/DemoProfileForm";

export const dynamic = "force-dynamic";

export default function DemoAccountPage() {
  return (
    <PageShell title="Demo account" description="Profile allowlist and email-change state in the demo build.">
      <DemoProfileForm />
      <NotEnabled
        message="Not enabled yet"
        detail="Email change and re-verification are pending; the demo does not offer either."
      />
      <Link href="/demo/account/email">View demo email change screen</Link>
      <Link href="/demo">Back to demo hub</Link>
    </PageShell>
  );
}
