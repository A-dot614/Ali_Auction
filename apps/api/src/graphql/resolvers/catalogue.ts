import { requireAuth, requireVerified, type GraphQLContext } from "../../auth/authz.js";
import {
  listPublishedByCategory,
  searchListings,
  type SearchListingsInput,
  type SearchResult,
} from "../../catalogue/search.js";
import {
  approveListing,
  createListingDraft,
  getPublicListingBySlug,
  listActiveCategories,
  myListings,
  getSellerListingOutcome,
  pendingListingReviews,
  rejectListing,
  resumeListing,
  removeListing,
  pauseListing,
  submitListingForReview,
  updateListingDraft,
  type Listing,
} from "../../catalogue/service.js";

function requireStaffReviewer(ctx: GraphQLContext) {
  const user = requireAuth(ctx);
  // Moderation (listing actions) is staff-only: Moderator/Trust & Safety or admin (docs/09).
  if (user.roles.includes("admin") || user.roles.includes("moderator")) {
    return user;
  }
  throw new Error("FORBIDDEN: Insufficient permissions.");
}

function toIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function serializeListing(l: Listing) {
  return {
    ...l,
    requestedStartsAt: toIso(l.requestedStartsAt),
    requestedEndsAt: toIso(l.requestedEndsAt),
    publishedAt: toIso(l.publishedAt),
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

function serializeSearchResult(result: SearchResult) {
  // Items are already public-safe (no seller ids, legal names, verification, rejection reason, storage keys).
  return result;
}

export const catalogueResolvers = {
  Query: {
    categories: async () => {
      return listActiveCategories();
    },
    searchListings: async (_: any, { input }: { input: SearchListingsInput }) => {
      return serializeSearchResult(await searchListings(input));
    },
    categoryListings: async (_: any, { slug, input }: { slug: string; input?: SearchListingsInput }) => {
      return serializeSearchResult(await listPublishedByCategory(slug, input ?? {}));
    },
    myListings: async (_: any, args: any, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      const result = await myListings(user.id, {
        status: args.status ?? null,
        first: args.first,
        after: args.after ?? null,
      });
      return { ...result, items: result.items.map(serializeListing) };
    },
    listing: async (_: any, args: { slug: string }) => {
      const result = await getPublicListingBySlug(args.slug);
      if (!result) {
        throw new Error("NOT_FOUND: Listing not found.");
      }
      const { listing, category, media } = result;
      // Public fields only; never expose seller legal/verification/rejection reason/internal IDs beyond allowed.
      return {
        slug: listing.slug,
        title: listing.title,
        description: listing.description,
        condition: listing.condition,
        fulfilmentOption: listing.fulfilmentOption,
        currency: listing.currency,
        startingPriceMinor: listing.startingPriceMinor,
        publishedAt: toIso(listing.publishedAt),
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          isPlaceholder: category.isPlaceholder,
        },
        media: media.map((m) => ({ altText: m.altText, sortOrder: m.sortOrder })),
      };
    },
    pendingListingReviews: async (_: any, args: any, ctx: GraphQLContext) => {
      requireStaffReviewer(ctx);
      const result = await pendingListingReviews({ first: args.first, after: args.after ?? null });
      // Minimal cursor: createdAt of last item.
      return { ...result, items: result.items.map(serializeListing) };
    },
  },
  Mutation: {
    createListingDraft: async (_: any, { input }: any, ctx: GraphQLContext) => {
      const user = requireVerified(ctx);
      return serializeListing(await createListingDraft(user.id, input));
    },
    updateListingDraft: async (_: any, { id, input }: any, ctx: GraphQLContext) => {
      const user = requireVerified(ctx);
      return serializeListing(await updateListingDraft(user.id, id, input));
    },
    submitListingForReview: async (_: any, { id }: any, ctx: GraphQLContext) => {
      const user = requireVerified(ctx);
      return serializeListing(await submitListingForReview(user.id, id));
    },
    approveListing: async (_: any, { id }: any, ctx: GraphQLContext) => {
      const reviewer = requireStaffReviewer(ctx);
      return serializeListing(await approveListing(id, reviewer.id));
    },
    rejectListing: async (_: any, { id, reason }: any, ctx: GraphQLContext) => {
      const reviewer = requireStaffReviewer(ctx);
      return serializeListing(await rejectListing(id, reviewer.id, reason));
    },
    pauseListing: async (_: any, { id, reason }: any, ctx: GraphQLContext) => {
      const reviewer = requireStaffReviewer(ctx);
      return serializeListing(await pauseListing(id, reviewer.id, reason));
    },
    resumeListing: async (_: any, { id }: any, ctx: GraphQLContext) => {
      const reviewer = requireStaffReviewer(ctx);
      return serializeListing(await resumeListing(id, reviewer.id));
    },
    removeListing: async (_: any, { id, reason }: any, ctx: GraphQLContext) => {
      const reviewer = requireStaffReviewer(ctx);
      return serializeListing(await removeListing(id, reviewer.id, reason));
    },
  },
  // A2 (FR-060): read-only, owner-scoped auction status + final price on the seller's listing.
  Listing: {
    auctionOutcome: async (parent: Listing, _args: any, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      return getSellerListingOutcome(parent.id, user.id);
    },
  },
};
