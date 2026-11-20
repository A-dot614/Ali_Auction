/**
 * In-memory demo catalogue. Build-time demo builds only; no API call, no real
 * bids, no payment provider, no decision encoded as a rule. Values are fixed so
 * screenshots and route smoke tests are reproducible.
 */

export type DemoMoney = { minorUnits: number; currency: "CAD" };
export type DemoBid = { id: string; bidderLabel: string; amount: DemoMoney };
export type DemoListing = {
  slug: string;
  title: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  condition: string;
  photos: string[];
  seller: { displayName: string; provinceCode: string; verificationLabel: string };
  startingPrice: DemoMoney;
  currentPrice: DemoMoney;
  bidCount: number;
  bids: DemoBid[];
  endsAtIso: string;
  serverTimeIso: string;
};

export const DEMO_LISTINGS: DemoListing[] = [
  {
    slug: "vintage-desk-lamp",
    title: "Vintage desk lamp",
    description: "A pre-owned desk lamp in working order. Demo item; no sale is made.",
    categorySlug: "home",
    categoryName: "Home and garden",
    condition: "used",
    photos: ["Front view", "Shade detail", "Power cord"],
    seller: { displayName: "Demo seller", provinceCode: "AB", verificationLabel: "Demo verification state" },
    startingPrice: { minorUnits: 2500, currency: "CAD" },
    currentPrice: { minorUnits: 4100, currency: "CAD" },
    bidCount: 3,
    bids: [
      { id: "demo-bid-1", bidderLabel: "Demo bidder A", amount: { minorUnits: 2500, currency: "CAD" } },
      { id: "demo-bid-2", bidderLabel: "Demo bidder B", amount: { minorUnits: 3300, currency: "CAD" } },
      { id: "demo-bid-3", bidderLabel: "Demo bidder C", amount: { minorUnits: 4100, currency: "CAD" } },
    ],
    endsAtIso: "2026-12-01T18:00:00.000Z",
    serverTimeIso: "2026-11-20T12:00:00.000Z",
  },
  {
    slug: "ceramic-mug-set",
    title: "Ceramic mug set",
    description: "Four matching mugs. Demo item; no sale is made.",
    categorySlug: "home",
    categoryName: "Home and garden",
    condition: "used",
    photos: ["Set view", "Handle detail"],
    seller: { displayName: "Demo seller", provinceCode: "BC", verificationLabel: "Demo verification state" },
    startingPrice: { minorUnits: 1200, currency: "CAD" },
    currentPrice: { minorUnits: 1200, currency: "CAD" },
    bidCount: 0,
    bids: [],
    endsAtIso: "2026-12-02T18:00:00.000Z",
    serverTimeIso: "2026-11-20T12:00:00.000Z",
  },
  {
    slug: "commuter-bicycle",
    title: "Commuter bicycle",
    description: "A bicycle for city commuting. Demo item; no sale is made.",
    categorySlug: "sports",
    categoryName: "Sports and outdoors",
    condition: "used",
    photos: ["Side view", "Drivetrain", "Handlebars"],
    seller: { displayName: "Demo seller", provinceCode: "ON", verificationLabel: "Demo verification state" },
    startingPrice: { minorUnits: 18000, currency: "CAD" },
    currentPrice: { minorUnits: 22500, currency: "CAD" },
    bidCount: 2,
    bids: [
      { id: "demo-bid-4", bidderLabel: "Demo bidder D", amount: { minorUnits: 18000, currency: "CAD" } },
      { id: "demo-bid-5", bidderLabel: "Demo bidder E", amount: { minorUnits: 22500, currency: "CAD" } },
    ],
    endsAtIso: "2026-12-03T18:00:00.000Z",
    serverTimeIso: "2026-11-20T12:00:00.000Z",
  },
];

export function findDemoListing(slug: string): DemoListing | undefined {
  return DEMO_LISTINGS.find((listing) => listing.slug === slug);
}

export function filterDemoListings(options: {
  query?: string;
  category?: string;
  sort?: string;
}): DemoListing[] {
  const query = (options.query ?? "").trim().toLowerCase();
  const category = (options.category ?? "").trim().toLowerCase();
  const matches = DEMO_LISTINGS.filter((listing) => {
    const matchesQuery =
      query.length === 0 ||
      `${listing.title} ${listing.description} ${listing.categoryName}`.toLowerCase().includes(query);
    const matchesCategory = category.length === 0 || listing.categorySlug === category;
    return matchesQuery && matchesCategory;
  });
  if (options.sort === "price-asc") {
    return [...matches].sort((a, b) => a.currentPrice.minorUnits - b.currentPrice.minorUnits);
  }
  if (options.sort === "price-desc") {
    return [...matches].sort((a, b) => b.currentPrice.minorUnits - a.currentPrice.minorUnits);
  }
  return matches;
}

export function formatMinor(money: DemoMoney): string {
  return `${(money.minorUnits / 100).toFixed(2)} ${money.currency}`;
}
