import ScaffoldPage from "../../../../components/ScaffoldPage";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <ScaffoldPage title="Order detail" description={`Order ${orderId}`} state="empty" />;
}
