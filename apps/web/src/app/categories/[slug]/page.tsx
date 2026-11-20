import Link from "next/link";
import ScaffoldPage from "../../../components/ScaffoldPage";
import PageShell from "../../../components/PageShell";
import ScreenState from "../../../components/ScreenState";
import { demoMode } from "../../../lib/demo";
import { filterDemoListings, formatMinor } from "../../../lib/demo-data";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!demoMode) {
    return (
      <ScaffoldPage
        title="Category" // PLACEHOLDER COPY (docs/16 §8 #6)
        description={`Category: ${slug}`} // PLACEHOLDER COPY (docs/16 §8 #6)
        state="empty"
      />
    );
  }
  const listings = filterDemoListings({ category: slug });
  return (
    <PageShell title="Demo category" description={`Demo category: ${slug}`}>
      <section className="grid" aria-label="Demo category listings">
        {listings.length === 0 ? <ScreenState state="empty" /> : null}
        {listings.map((listing) => (
          <article className="card" key={listing.slug}>
            <h2>{listing.title}</h2>
            <p>Current demo price: {formatMinor(listing.currentPrice)}</p>
            <Link className="button" href={`/demo/listings/${listing.slug}`}>Open demo listing</Link>
          </article>
        ))}
      </section>
    </PageShell>
  );
}
