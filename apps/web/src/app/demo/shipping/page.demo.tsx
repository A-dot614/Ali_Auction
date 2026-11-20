import Link from "next/link";
import PageShell from "../../../components/PageShell";
import DemoShippingQuote from "../../../components/DemoShippingQuote";

export const dynamic = "force-dynamic";

export default function DemoShippingPage() {
  return (
    <PageShell
      title="Demo shipping"
      description="Rate quote shown from the in-memory fake quoter. No real rate request is made."
    >
      <DemoShippingQuote />
      <Link href="/demo">Back to demo hub</Link>
    </PageShell>
  );
}
