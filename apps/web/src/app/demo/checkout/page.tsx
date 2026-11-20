import Link from "next/link";
import PageShell from "../../../components/PageShell";
import DemoCheckout from "../../../components/DemoCheckout";

export const dynamic = "force-dynamic";

export default function DemoCheckoutPage() {
  return (
    <PageShell
      title="Demo checkout"
      description="Provider-neutral fake hosted session, success, failure and refund simulations."
    >
      <DemoCheckout />
      <Link href="/demo">Back to demo hub</Link>
    </PageShell>
  );
}
