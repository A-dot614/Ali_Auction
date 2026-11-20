import Link from "next/link";
import PageShell from "./PageShell";
import ScreenState from "./ScreenState";
import { filterDemoListings, formatMinor } from "../lib/demo-data";

/** Demo-only category view; imported by /categories/[slug] only in a demo build. */
export default async function DemoCategoryListings({ slug }: { slug: string }) {
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
