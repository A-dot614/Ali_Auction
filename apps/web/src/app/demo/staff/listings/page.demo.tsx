import Link from "next/link";
import PageShell from "../../../../components/PageShell";
import Table from "../../../../components/ui/Table";
import { DEMO_PENDING_REVIEWS } from "../../../../lib/demo-staff";

export const dynamic = "force-dynamic";

export default function DemoStaffListingsPage() {
  return (
    <PageShell
      title="Demo listing review"
      description="In-memory moderation queue. No approval decision is executed."
    >
      <section className="card ui-card">
        <p><strong>Simulation only: no review action is sent and no listing state changes.</strong></p>
        <Table
          headings={["Demo listing", "Condition", "Demo status"]}
          rows={DEMO_PENDING_REVIEWS.map((item) => [item.title, item.condition, item.status])}
        />
        <p className="muted">{DEMO_PENDING_REVIEWS[0].summary} Approved outcomes remain an undecided policy question.</p>
      </section>
      <Link href="/demo">Back to demo hub</Link>
    </PageShell>
  );
}
