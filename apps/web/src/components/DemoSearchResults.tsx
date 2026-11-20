import Link from "next/link";
import ScreenState from "./ScreenState";
import { filterDemoListings, formatMinor } from "../lib/demo-data";

/** Demo-only search results; imported by /search only in a demo build. */
export default function DemoSearchResults({
  params,
}: {
  params: { q?: string; category?: string; sort?: string };
}) {
  const results = filterDemoListings({
    query: params.q,
    category: params.category,
    sort: params.sort,
  });
  return (
    <section className="grid" aria-label="Demo search results">
      {results.length === 0 ? <ScreenState state="empty" /> : null}
      {results.map((listing) => (
        <article className="card" key={listing.slug}>
          <h2>{listing.title}</h2>
          <p className="muted">{listing.categoryName} — {listing.condition}</p>
          <p>Current demo price: {formatMinor(listing.currentPrice)}</p>
          <Link className="button" href={`/demo/listings/${listing.slug}`}>Open demo listing</Link>
        </article>
      ))}
    </section>
  );
}
