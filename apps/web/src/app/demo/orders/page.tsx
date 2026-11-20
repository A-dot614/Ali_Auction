import Link from "next/link";
import PageShell from "../../../components/PageShell";
import { DEMO_ORDERS } from "../../../lib/demo-orders";

export const dynamic = "force-dynamic";

export default function DemoOrdersPage() {
  return (
    <PageShell title="Demo orders" description="In-memory orders with provider-neutral event records.">
      <table className="status-table responsive-table">
        <thead>
          <tr><th scope="col">Order</th><th scope="col">Item</th><th scope="col">Demo status</th></tr>
        </thead>
        <tbody>
          {DEMO_ORDERS.map((order) => (
            <tr key={order.id}>
              <td><Link href={`/demo/orders/${order.id}`}>{order.id}</Link></td>
              <td>{order.listingTitle}</td>
              <td>{order.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Link href="/demo">Back to demo hub</Link>
    </PageShell>
  );
}
