import Link from "next/link";
import PageShell from "../../../../components/PageShell";
import NotEnabled from "../../../../components/NotEnabled";

export const dynamic = "force-dynamic";

export default function DemoEmailChangePage() {
  return (
    <PageShell title="Demo email change" description="Email change is not implemented in the demo.">
      <NotEnabled
        message="Not enabled yet"
        detail="No re-verification flow is offered because the email-change policy is undecided."
      />
      <Link href="/demo/account">Back to demo account</Link>
    </PageShell>
  );
}
