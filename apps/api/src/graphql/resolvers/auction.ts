import { requireVerified, type GraphQLContext } from "../../auth/authz.js";
import { config } from "../../config.js";
import {
  auctionBids,
  auctionForListing,
  createAuction,
  getAuction,
  placeBid,
  setProxyBid,
  type Auction,
  type BidPublic,
} from "../../auction/service.js";

function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function serializeBid(bid: BidPublic) {
  return {
    id: bid.id,
    amount: bid.amount,
    acceptedAt: toIso(bid.acceptedAt),
    bidderLabel: bid.bidderLabel,
  };
}

function serializeAuction(a: Auction) {
  return {
    id: a.id,
    listingId: a.listingId,
    status: a.status,
    currentPrice: { minorUnits: Number(a.currentPriceMinor), currency: a.currency },
    startingPriceMinor: Number(a.startingPriceMinor),
    startsAt: toIso(a.startsAt),
    endsAt: toIso(a.endsAt),
    createdAt: toIso(a.createdAt),
    updatedAt: toIso(a.updatedAt),
  };
}

function serializeBidResult(result: {
  accepted: boolean;
  bid: BidPublic | null;
  auction: Auction | null;
  error: { code: string; message: string } | null;
}) {
  return {
    accepted: result.accepted,
    bid: result.bid ? serializeBid(result.bid) : null,
    auction: result.auction ? serializeAuction(result.auction) : null,
    error: result.error ? { code: result.error.code, message: result.error.message } : null,
  };
}

export const auctionResolvers = {
  Auction: {
    bids: async (parent: { id: string }, args: { first?: number | null; after?: string | null }) => {
      // Public users see accepted bid history but not proxy maximums (docs/16 §2).
      const connection = await auctionBids(parent.id, { first: args.first, after: args.after });
      return {
        items: connection.items.map(serializeBid),
        endCursor: connection.endCursor,
      };
    },
  },
  Query: {
    auction: async (_: any, { id }: { id: string }) => {
      const auction = await getAuction(id);
      return auction ? serializeAuction(auction) : null;
    },
    auctionForListing: async (_: any, { slug }: { slug: string }) => {
      const auction = await auctionForListing(slug);
      return auction ? serializeAuction(auction) : null;
    },
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
      const auctionConfig = ctx.auctionConfig ?? config;
      const result = await placeBid(
        user.id,
        {
          auctionId: input.auctionId,
          amountMinor: input.amountMinor,
          requestId: input.requestId,
        },
        {
          now: () => new Date(),
          bidIncrementMinor: auctionConfig.auction.bidIncrementMinor,
          liveBiddingEnabled: auctionConfig.features.liveBiddingEnabled,
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
