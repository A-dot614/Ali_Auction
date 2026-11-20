import Link from "next/link";
import Badge from "./ui/Badge";
import Card from "./ui/Card";
import ScreenState from "./ScreenState";

export type HomeListing = {
  slug: string;
  title: string;
  summary: string;
  priceLabel: string;
  href: string;
};

export type HomeCategory = {
  slug: string;
  name: string;
  placeholder: boolean;
  href: string;
};

/**
 * Presentational home sections shared by real and demo modes. All data and
 * destination URLs are supplied by the caller; this module contains no mock
 * catalogue and no mode-specific route text.
 */
export default function HomeSections({
  featured,
  endingSoon,
  categories,
  browseHref,
  sellHref,
  auctionOutcomeAvailable = true,
}: {
  featured: HomeListing[];
  endingSoon: HomeListing[];
  categories: HomeCategory[];
  browseHref: string;
  sellHref: string;
  auctionOutcomeAvailable?: boolean;
}) {
  return (
    <>
      <section className="hero-panel" aria-labelledby="home-hero-heading">
        <p className="eyebrow">Phase 1 foundation</p> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        <h2 id="home-hero-heading" className="section-display">A marketplace built in the open</h2>
        <p className="muted">
          Browse published listings, follow their status and create seller drafts. Rules that are
          still open are labelled, not guessed.
        </p>
        <p className="hero-actions">
          <Link className="ui-button ui-button--primary" href={browseHref}>Browse listings</Link>
          <Link className="ui-button ui-button--quiet" href={sellHref}>Start selling</Link>
        </p>
      </section>

      <Card title="Featured listings">
        {featured.length === 0 ? (
          <ScreenState state="empty" />
        ) : (
          <ul className="listing-grid">
            {featured.map((listing) => (
              <li key={listing.slug} className="card ui-card">
                <h3><Link href={listing.href}>{listing.title}</Link></h3>
                <p className="muted">{listing.summary}</p>
                <p><strong>{listing.priceLabel}</strong></p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Ending soon">
        {!auctionOutcomeAvailable ? (
          <p className="muted" role="status">Not enabled yet. No auction end times are available in this mode.</p>
        ) : endingSoon.length === 0 ? (
          <ScreenState state="empty" />
        ) : (
          <ul>
            {endingSoon.map((listing) => (
              <li key={listing.slug}>
                <Link href={listing.href}>{listing.title}</Link> <span className="muted">— {listing.priceLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Categories">
        {categories.length === 0 ? (
          <ScreenState state="empty" />
        ) : (
          <ul className="category-list">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link href={category.href}>{category.name}</Link>{" "}
                {category.placeholder ? <Badge tone="warning">PLACEHOLDER - NOT APPROVED</Badge> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="How it works">
        <ol className="how-steps">
          <li>Create an account and confirm your email address.</li>
          <li>Set up a seller profile and submit it for review.</li>
          <li>Create a listing draft and submit it for staff review.</li>
          <li>Published listings can be browsed by category and search.</li>
        </ol>
        <p className="muted">Live bidding and real-money payments are not enabled.</p>
      </Card>
    </>
  );
}
