import Link from "next/link";
import PageShell from "../../../components/PageShell";
import { DEMO_LISTINGS, filterDemoListings, formatMinor } from "../../../lib/demo-data";

export const dynamic = "force-dynamic";

export default async function DemoListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const listings = filterDemoListings({
    query: params.q,
    category: params.category,
    sort: params.sort,
  });
  return (
    <PageShell title="Demo listings" description="Browse, search and filter the in-memory demo catalogue.">
      <form className="card ui-card" action="/demo/listings" method="get">
        <label htmlFor="demo-listings-query">Search demo listings</label>
        <input id="demo-listings-query" name="q" type="search" defaultValue={params.q ?? ""} />
        <label htmlFor="demo-listings-category">Category</label>
        <select id="demo-listings-category" name="category" defaultValue={params.category ?? ""}>
          <option value="">All categories</option>
          <option value="home">Home and garden</option>
          <option value="sports">Sports and outdoors</option>
        </select>
        <label htmlFor="demo-listings-sort">Sort</label>
        <select id="demo-listings-sort" name="sort" defaultValue={params.sort ?? ""}>
          <option value="">Default order</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
        <button type="submit">Apply</button>
      </form>
      <section className="grid" aria-label="Demo listings">
        {listings.map((listing) => (
          <article className="card ui-card" key={listing.slug}>
            <h2>{listing.title}</h2>
            <p className="muted">{listing.categoryName}</p>
            <p>Current demo price: {formatMinor(listing.currentPrice)}</p>
            <Link className="button" href={`/demo/listings/${listing.slug}`}>View demo listing</Link>
          </article>
        ))}
      </section>
      <p className="muted">{DEMO_LISTINGS.length} demo listings in memory.</p>
      <Link href="/demo">Back to demo hub</Link>
    </PageShell>
  );
}
