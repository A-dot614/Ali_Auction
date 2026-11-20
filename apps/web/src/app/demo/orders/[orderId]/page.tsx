import Link from "next/link";
import PageShell from "../../../../components/PageShell";
import ScreenState from "../../../../components/ScreenState";
import { findDemoOrder } from "../../../../lib/demo-orders";

export const dynamic = "force-dynamic";

export default async function DemoOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = findDemoOrder(orderId);
  if (!order) {
    return (
      <PageShell title="Demo order detail" description="Demo order detail.">
        <ScreenState state="empty" />
        <Link href="/demo/orders">Back to demo orders</Link>
      </PageShell>
    );
  }
  return (
    <PageShell title="Demo order detail" description={`${order.id} — ${order.listingTitle}`}>
      <section className="card">
        <h2>Order status</h2>
        <dl>
          <dt>Order</dt><dd>{order.id}</dd>
          <dt>Item</dt><dd>{order.listingTitle}</dd>
          <dt>Demo status</dt><dd>{order.status}</dd>
          <dt>Recorded total (minor units)</dt><dd>{order.totalMinor} {order.currency}</dd>
        </dl>
        <p className="muted">No charge, payout or fee rule is represented here.</p>
      </section>
      <section className="card">
        <h2>Payment events</h2>
        <table className="status-table responsive-table">
          <thead>
            <tr><th scope="col">Event</th><th scope="col">Recorded at</th><th scope="col">Demo note</th></tr>
          </thead>
          <tbody>
            {order.events.map((event) => (
              <tr key={event.id}>
                <td>{event.kind}</td>
                <td>{event.atIso}</td>
                <td>{event.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2>Timeline</h2>
        <ol className="timeline">
          {order.events.map((event) => (
            <li key={event.id}><strong>{event.kind}</strong> — {event.atIso}. {event.note}</li>
          ))}
        </ol>
      </section>
      <Link href="/demo/disputes">Open a demo dispute</Link>
      <Link href="/demo/orders">Back to demo orders</Link>
    </PageShell>
  );
}
