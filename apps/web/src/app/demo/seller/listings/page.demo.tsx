import Link from "next/link";
import PageShell from "../../../../components/PageShell";
import Table from "../../../../components/ui/Table";
import { DEMO_SELLER_LISTINGS } from "../../../../lib/demo-seller";

export const dynamic = "force-dynamic";

export default function DemoMyListingsPage() {
  return (
    <PageShell title="Demo my listings" description="In-memory draft statuses for the seller workflow.">
      <section className="card ui-card">
        <h2>Demo listing status</h2>
        <Table
          headings={["Title", "Status", "Edit"]}
          rows={DEMO_SELLER_LISTINGS.map((listing) => [
            listing.title,
            listing.status,
            <Link key={listing.id} href={`/demo/seller/listings/${listing.id}/edit`}>Edit</Link>,
          ])}
        />
      </section>
    </PageShell>
  );
}
