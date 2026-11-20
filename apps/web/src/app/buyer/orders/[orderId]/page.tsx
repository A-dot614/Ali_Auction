import type { Metadata } from "next";
import PageShell from "../../../../components/PageShell";
import ScreenState from "../../../../components/ScreenState";
import Table from "../../../../components/ui/Table";
import { gql } from "../../../../lib/graphql";
import { stateForFailure } from "../../../../lib/error-state";
import { formatMinorUnits } from "../../../../lib/money";

export const metadata: Metadata = {
  title: "Order detail — AliAuction.ca",
  description: "Participant-only order status, charges and fulfilment details.",
};
export const dynamic = "force-dynamic";

const QUERY = `query($id: ID!) {
  order(id: $id) {
    id status currency hammerPriceMinor feeTotalMinor totalMinor createdAt updatedAt
    shippingAddressSnapshot
    shipments { method carrier trackingNumber }
    estimatedShippingMinor estimateBasis
  }
}`;

export default async function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const result = await gql(QUERY, { id: orderId });
  if (result.errors?.length) {
    const failure = stateForFailure(result.errors[0].message);
    return (
      <PageShell title="Order detail" description={`Order ${orderId}`}>
        <ScreenState state={failure.state === "not-enabled" ? "empty" : failure.state} />
      </PageShell>
    );
  }

  const order = result.data?.order;
  if (!order) {
    return (
      <PageShell title="Order detail" description={`Order ${orderId}`}>
        <ScreenState state="empty" />
      </PageShell>
    );
  }

  const currency = String(order.currency ?? "CAD");
  const shipments: any[] = order.shipments ?? [];
  return (
    <PageShell title="Order detail" description={`Order ${orderId}`}>
      <section className="card ui-card">
        <h2>Summary</h2>
        <dl className="detail-list">
          <dt>Order</dt><dd>{String(order.id)}</dd>
          <dt>Status</dt><dd>{String(order.status)}</dd>
          <dt>Hammer price</dt><dd>{formatMinorUnits(order.hammerPriceMinor, currency)}</dd>
          <dt>Fees</dt><dd>{formatMinorUnits(order.feeTotalMinor, currency)}</dd>
          <dt>Total</dt><dd>{formatMinorUnits(order.totalMinor, currency)}</dd>
          <dt>Placed</dt><dd>{String(order.createdAt)}</dd>
          <dt>Updated</dt><dd>{String(order.updatedAt)}</dd>
          <dt>Shipping estimate</dt>
          <dd>
            {formatMinorUnits(order.estimatedShippingMinor, currency)}
            {" "}<span className="muted">(display-only placeholder, not part of the total)</span>
          </dd>
        </dl>
      </section>

      <section className="card ui-card">
        <h2>Fulfilment</h2>
        {shipments.length === 0 ? (
          <ScreenState state="empty" />
        ) : (
          <Table
            headings={["Method", "Carrier", "Tracking"]}
            rows={shipments.map((shipment) => [
              String(shipment.method),
              shipment.carrier ? String(shipment.carrier) : "—",
              shipment.trackingNumber ? String(shipment.trackingNumber) : "—",
            ])}
          />
        )}
        {order.shippingAddressSnapshot ? (
          <p className="muted">A saved address snapshot is available to the order participants only.</p>
        ) : null}
      </section>
    </PageShell>
  );
}
