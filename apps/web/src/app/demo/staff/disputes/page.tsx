import Link from "next/link";
import PageShell from "../../../../components/PageShell";
import { DEMO_DISPUTES } from "../../../../lib/demo-disputes";

export const dynamic = "force-dynamic";

export default function DemoStaffDisputesPage() {
  return (
    <PageShell
      title="Demo staff review"
      description="Labeled review simulation. No outcome, evidence window or staff action is decided."
    >
      <section className="card">
        <p><strong>Simulation only: no review decision is made and no data is written.</strong></p>
        <table className="status-table responsive-table">
          <thead>
            <tr><th scope="col">Demo dispute</th><th scope="col">Order</th><th scope="col">Demo status</th></tr>
          </thead>
          <tbody>
            {DEMO_DISPUTES.map((dispute) => (
              <tr key={dispute.id}>
                <td>{dispute.id}</td>
                <td>{dispute.orderId}</td>
                <td>{dispute.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">Approved outcome choices and evidence window are not shown because they are undecided.</p>
      </section>
      <Link href="/demo/disputes">Back to demo disputes</Link>
      <Link href="/demo">Back to demo hub</Link>
    </PageShell>
  );
}
