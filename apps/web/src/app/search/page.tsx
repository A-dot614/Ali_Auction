import type { ReactNode } from "react";
import PageShell from "../../components/PageShell";
import ScreenState from "../../components/ScreenState";

// PLACEHOLDER COPY (docs/16 §8 #6): search form copy pending review.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; category?: string; sort?: string }>;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  let results: ReactNode = <ScreenState state="empty" />;
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    const { default: DemoSearchResults } = await import("../../components/DemoSearchResults");
    results = <DemoSearchResults params={params} />;
  }
  return (
    <PageShell title="Search" description="Find listings by keyword.">
      <form className="card" action="/search" method="get">
        <label htmlFor="search-query">Search listings</label> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        <input id="search-query" name="q" type="search" defaultValue={params.q ?? ""} />
        <label htmlFor="search-category">Category</label> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        <select id="search-category" name="category" defaultValue={params.category ?? ""}>
          <option value="">All categories</option> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
          <option value="home">Home and garden</option> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
          <option value="sports">Sports and outdoors</option> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        </select>
        <label htmlFor="search-sort">Sort</label> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        <select id="search-sort" name="sort" defaultValue={params.sort ?? ""}>
          <option value="">Default order</option> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
          <option value="price-asc">Price: low to high</option> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
          <option value="price-desc">Price: high to low</option> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        </select>
        <button type="submit">Search</button> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
      </form>
      {results}
    </PageShell>
  );
}
