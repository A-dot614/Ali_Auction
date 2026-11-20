import Link from "next/link";
import PageShell from "../../../components/PageShell";
import DemoDisputeFlow from "../../../components/DemoDisputeFlow";

export const dynamic = "force-dynamic";

export default async function DemoDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  return (
    <PageShell
      title="Demo disputes"
      description="Buyer dispute, evidence list and status from local in-memory state."
    >
      <DemoDisputeFlow initialOrderId={orderId} />
      <Link href="/demo/staff/disputes">View demo staff review</Link>
      <Link href="/demo">Back to demo hub</Link>
    </PageShell>
  );
}
