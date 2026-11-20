import type { Metadata } from "next";
import PageShell from "../components/PageShell";
import HomeSections, { type HomeCategory, type HomeListing } from "../components/HomeSections";
import { gql } from "../lib/graphql";

export const metadata: Metadata = {
  title: "AliAuction.ca — Browse published listings",
  description: "Browse published listings and categories on the Phase 1 marketplace foundation.",
};
export const dynamic = "force-dynamic";

const CATEGORIES = `query { categories { id slug name isPlaceholder } }`;
const LISTINGS = `query($input: SearchListingsInput!) {
  searchListings(input: $input) {
    items { slug title description startingPriceMinor category { slug name } }
  }
}`;
const AUCTION_TIME = `query($slug: String!) { auctionForListing(slug: $slug) { endsAt } }`;

function priceLabel(minor: unknown): string {
  const value = typeof minor === "string" || typeof minor === "number" ? Number(minor) : 0;
  return `${(Number.isFinite(value) ? value / 100 : 0).toFixed(2)} CAD`;
}

export default async function HomePage() {
  const [categoriesResult, listingsResult] = await Promise.allSettled([
    gql(CATEGORIES),
    gql(LISTINGS, { input: { sort: "NEWEST", first: 6 } }),
  ]);

  const categories: HomeCategory[] =
    categoriesResult.status === "fulfilled"
      ? (categoriesResult.value.data?.categories ?? []).map((category: any) => ({
          slug: String(category.slug),
          name: String(category.name),
          placeholder: Boolean(category.isPlaceholder),
          href: `/categories/${encodeURIComponent(String(category.slug))}`,
        }))
      : [];

  const items: any[] =
    listingsResult.status === "fulfilled" ? (listingsResult.value.data?.searchListings?.items ?? []) : [];

  const toListing = (item: any): HomeListing => ({
    slug: String(item.slug),
    title: String(item.title),
    summary: String(item.description ?? ""),
    priceLabel: priceLabel(item.startingPriceMinor),
    href: `/listings/${encodeURIComponent(String(item.slug))}`,
  });

  const featured = items.slice(0, 4).map(toListing);

  const auctionResults = await Promise.allSettled(
    items.slice(0, 6).map((item) => gql(AUCTION_TIME, { slug: String(item.slug) }))
  );
  const endingSoon = items
    .slice(0, 6)
    .map((item, index) => {
      const result = auctionResults[index];
      const endsAt =
        result.status === "fulfilled" ? result.value.data?.auctionForListing?.endsAt : null;
      return { listing: toListing(item), endsAt: endsAt ? String(endsAt) : null };
    })
    .filter((entry) => entry.endsAt !== null)
    .sort((a, b) => String(a.endsAt).localeCompare(String(b.endsAt)))
    .slice(0, 3)
    .map((entry) => entry.listing);

  return (
    <PageShell
      title="AliAuction.ca"
      description="Canadian C2C and B2C auction marketplace (Phase 1 foundation)."
      tone="cinematic"
    >
      <HomeSections
        featured={featured}
        endingSoon={endingSoon}
        categories={categories}
        browseHref="/search"
        sellHref="/seller/dashboard"
      />
    </PageShell>
  );
}
