import Link from "next/link";
import PageShell from "../../components/PageShell";
import HomeSections, { type HomeCategory, type HomeListing } from "../../components/HomeSections";
import { DEMO_LISTINGS, formatMinor } from "../../lib/demo-data";

export const dynamic = "force-dynamic";

const DEMO_PAGES = [
  { href: "/demo/listings", label: "Browse, search and filter demo listings", proves: "In-memory catalogue and listing cards" },
  { href: "/demo/listings/vintage-desk-lamp", label: "Demo listing detail", proves: "Photos, seller information and auction timer" },
  { href: "/demo/bidding", label: "Demo bidding simulation", proves: "Local mock bid state; no bidding endpoint is used" },
  { href: "/demo/checkout", label: "Demo checkout", proves: "Provider-neutral fake hosted session, success, failure and refund states" },
  { href: "/demo/orders", label: "Demo orders", proves: "Order list from in-memory data" },
  { href: "/demo/orders/demo-order-1", label: "Demo order detail", proves: "Status, payment events and timeline" },
  { href: "/demo/shipping", label: "Demo shipping quote", proves: "Fake quoter response shape with required inputs" },
  { href: "/demo/disputes", label: "Demo disputes", proves: "Buyer dispute, evidence list and status" },
  { href: "/demo/staff/disputes", label: "Demo staff review", proves: "Labeled review simulation with no decision made" },
  { href: "/demo/staff/listings", label: "Demo listing review", proves: "Mock queue; no approval decision is executed" },
  { href: "/demo/seller/dashboard", label: "Demo seller dashboard", proves: "Mock draft status and listing links" },
  { href: "/demo/seller/listings", label: "Demo my listings", proves: "Mock listing statuses in a responsive table" },
  { href: "/demo/account", label: "Demo account", proves: "Profile allowlist and email change not enabled" },
  { href: "/admin/status", label: "Admin status", proves: "All flags OFF and read-only decision-log status" },
] as const;

function toListing(slug: string, title: string, description: string, minorUnits: number): HomeListing {
  return {
    slug,
    title,
    summary: description,
    priceLabel: formatMinor({ minorUnits, currency: "CAD" }),
    href: `/demo/listings/${slug}`,
  };
}

const featured = DEMO_LISTINGS.slice(0, 3).map((listing) =>
  toListing(listing.slug, listing.title, listing.description, listing.currentPrice.minorUnits)
);
const endingSoon = [...DEMO_LISTINGS]
  .sort((a, b) => a.endsAtIso.localeCompare(b.endsAtIso))
  .slice(0, 2)
  .map((listing) =>
    toListing(listing.slug, listing.title, listing.description, listing.currentPrice.minorUnits)
  );
const categories: HomeCategory[] = [...new Set(DEMO_LISTINGS.map((listing) => listing.categorySlug))].map(
  (slug) => ({
    slug,
    name: DEMO_LISTINGS.find((listing) => listing.categorySlug === slug)!.categoryName,
    placeholder: true,
    href: `/demo/listings?category=${encodeURIComponent(slug)}`,
  })
);

export default function DemoHubPage() {
  return (
    <PageShell
      title="Demo hub"
      description="Every screen below is a local simulation. No decision is made and nothing is charged."
    >
      <HomeSections
        featured={featured}
        endingSoon={endingSoon}
        categories={categories}
        browseHref="/demo/listings"
        sellHref="/demo/seller/dashboard"
      />
      <section className="card ui-card">
        <h2>Demo screens</h2>
        <table className="status-table responsive-table ui-table">
          <thead>
            <tr><th scope="col">Screen</th><th scope="col">What it proves</th></tr>
          </thead>
          <tbody>
            {DEMO_PAGES.map((page) => (
              <tr key={page.href}>
                <td><Link href={page.href}>{page.label}</Link></td>
                <td>{page.proves}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">Set the build-time demo setting to see these screens. A production build with demo mode on fails.</p>
      </section>
    </PageShell>
  );
}
