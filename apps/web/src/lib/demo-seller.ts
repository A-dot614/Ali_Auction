/** In-memory seller/staff examples for demo builds only. No API request is made. */

export const DEMO_SELLER_CATEGORIES = [
  { id: "demo-category-home", name: "Home and garden", slug: "home", isPlaceholder: true },
  { id: "demo-category-sports", name: "Sports and outdoors", slug: "sports", isPlaceholder: true },
];

export type DemoListingDraft = {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  condition: string;
  fulfilmentOption: string;
  startingPriceMinor: string;
  status: string;
};

export const DEMO_SELLER_LISTINGS: DemoListingDraft[] = [
  {
    id: "demo-listing-1",
    title: "Demo wooden shelf",
    description: "In-memory draft used to show the seller workflow.",
    categoryId: "demo-category-home",
    condition: "used",
    fulfilmentOption: "local_pickup",
    startingPriceMinor: "1500",
    status: "draft",
  },
  {
    id: "demo-listing-2",
    title: "Demo camping stove",
    description: "In-memory draft used to show review states.",
    categoryId: "demo-category-sports",
    condition: "like_new",
    fulfilmentOption: "shipping",
    startingPriceMinor: "4200",
    status: "pending_review",
  },
];

export function findDemoSellerListing(id: string): DemoListingDraft | undefined {
  return DEMO_SELLER_LISTINGS.find((listing) => listing.id === id);
}
