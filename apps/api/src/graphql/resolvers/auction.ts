import { requireVerified, type GraphQLContext } from "../../auth/authz.js";
import { config } from "../../config.js";
import {
  auctionForListing,
  createAuction,
  getAuction,
  placeBid,
  setProxyBid,
  type Auction,
} from "../../auction/service.js";

function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function serializeAuction(a: Auction) {
  return {
    id: a.id,
    listingId: a.listingId,
    status: a.status,
    currentPrice: { minorUnits: Number(a.currentPriceMinor), currency: a.currency },
    startingPriceMinor: Number(a.startingPriceMinor),
    endsAt: toIso(a.endsAt),
    createdAt: toIso(a.createdAt),
    updatedAt: toIso(a.updatedAt),
  };
}

function serializeBidResult(result: {
  accepted: boolean;
  bid: { id: string; amount: { minorUnits: number; currency: string }; acceptedAt: Date; bidderLabel: string } | null;
  auction: Auction | null;
  error: { code: string; message: string } | null;
}) {
  return {
    accepted: result.accepted,
    bid: result.bid
      ? {
          id: result.bid.id,
          amount: result.bid.amount,
          acceptedAt: toIso(result.bid.acceptedAt),
          bidderLabel: result.bid.bidderLabel,
        }
      : null,
    auction: result.auction ? serializeAuction(result.auction) : null,
    error: result.error ? { code: result.error.code, message: result.error.message } : null,
  };
}

export const auctionResolvers = {
  Query: {
    auction: async (_: any, { id }: { id: string }) => getAuction(id),
    auctionForListing: async (_: any, { slug }: { slug: string }) => auctionForListing(slug),
  },
  Mutation: {
    createAuction: async (_: any, { input }: any, ctx: GraphQLContext) => {
      const user = requireVerified(ctx);
      const auction = await createAuction(
        user.id,
        {
          listingId: input.listingId,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          startingPriceMinor: input.startingPriceMinor,
        },
        { now: () => new Date() }
      );
      return serializeAuction(auction);
    },
    placeBid: async (_: any, { input }: any, ctx: GraphQLContext) => {
      const user = requireVerified(ctx);
      const result = await placeBid(
        user.id,
        {
          auctionId: input.auctionId,
          amountMinor: input.amountMinor,
          requestId: input.requestId,
        },
        {
          now: () => new Date(),
          bidIncrementMinor: config.auction.bidIncrementMinor,
          liveBiddingEnabled: config.features.liveBiddingEnabled,
        }
      );
      return serializeBidResult(result);
    },
    setProxyBid: async (_: any, { input: _input }: any) => {
      // Slice 4a: proxy path reserved; throws NOT_IMPLEMENTED_PENDING_DECISION (docs/16 §3 #4).
      return setProxyBid();
    },
  },
};
