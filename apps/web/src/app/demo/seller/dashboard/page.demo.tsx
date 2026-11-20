import Link from "next/link";
import PageShell from "../../../../components/PageShell";
import Table from "../../../../components/ui/Table";
import { DEMO_SELLER_LISTINGS } from "../../../../lib/demo-seller";

export const dynamic = "force-dynamic";

export default function DemoSellerDashboardPage() {
  return (
    <PageShell title="Demo seller dashboard" description="In-memory seller status. Nothing is sent to the API.">
      <section className="card ui-card">
        <h2>Verification status</h2>
        <p role="status">Demo verification state (not an approval).</p>
      </section>
      <section className="card ui-card">
        <h2>Recent demo drafts</h2>
        <Table
          headings={["Title", "Status"]}
          rows={DEMO_SELLER_LISTINGS.map((listing) => [listing.title, listing.status])}
        />
        <p><Link href="/demo/seller/listings">All demo listings</Link> · <Link href="/demo/seller/listings/new">New demo draft</Link></p>
      </section>
    </PageShell>
  );
}
