/** In-memory staff review examples for demo builds only. No API call is made. */

export const DEMO_PENDING_REVIEWS = [
  {
    id: "demo-review-1",
    title: "Demo wooden shelf",
    slug: "demo-wooden-shelf",
    condition: "used",
    status: "pending_review",
    summary: "In-memory example of a listing awaiting review.",
  },
  {
    id: "demo-review-2",
    title: "Demo camping stove",
    slug: "demo-camping-stove",
    condition: "like_new",
    status: "pending_review",
    summary: "Second in-memory example; no decision is attached.",
  },
] as const;
