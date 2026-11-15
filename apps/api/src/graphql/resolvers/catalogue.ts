import { requireAuth, requireVerified, type GraphQLContext } from "../../auth/authz.js";
import {
  createListingDraft,
  getPublicListingBySlug,
  listActiveCategories,
  myListings,
  submitListingForReview,
  updateListingDraft,
  type Listing,
} from "../../catalogue/service.js";

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

export const catalogueResolvers = {
  Query: {
    categories: async () => {
      return listActiveCategories();
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
  },
};
