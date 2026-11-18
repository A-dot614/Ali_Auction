import { beforeEach, describe, expect, it } from "vitest";
import { createAuction, closeAuction } from "../src/auction/service.js";
import { getSellerListingOutcome } from "../src/catalogue/service.js";
import { gql, makePaidOrder, makePublishedListing, registerVerifyLogin, resetDisputeDb } from "./dispute-helpers.js";

/** A2 (FR-060): seller sees only their own listing's auction outcome. */

describe("seller listing outcome (FR-060)", () => {
  beforeEach(async () => {
    await resetDisputeDb();
  });

  it("seller sees own closed_sold outcome; another seller gets NOT_FOUND", async () => {
    const { seller, order } = await makePaidOrder();
    const res = await gql({
      query: `query{ myListings { items { id title auctionOutcome { status finalPriceMinor } } } }`,
      cookie: seller.cookie,
    });
    expect(res.body.errors).toBeUndefined();
    const listing = res.body.data.myListings.items.find((l: any) => l.auctionOutcome != null);
    expect(listing).toBeDefined();
    expect(listing.auctionOutcome.status).toBe("closed_sold");
    expect(Number(listing.auctionOutcome.finalPriceMinor)).toBe(Number(order.hammer_price_minor));

    const otherSeller = await registerVerifyLogin("other-seller");
    await expect(getSellerListingOutcome(listing.id, otherSeller.userId)).rejects.toThrow(/NOT_FOUND/);
  });

  it("seller sees own closed_unsold outcome with final price", async () => {
    const seller = await registerVerifyLogin("unsold-seller");
    const { listingId } = await makePublishedListing(seller);
    const base = Date.now();
    const auction = await createAuction(
      seller.userId,
      {
        listingId,
        startsAt: new Date(base - 60_000),
        endsAt: new Date(base + 3_600_000),
        startingPriceMinor: 2500,
      },
      { now: () => new Date(base - 120_000) }
    );
    await closeAuction(auction.id, { now: () => new Date(base + 3_600_000) });

    const outcome = await getSellerListingOutcome(listingId, seller.userId);
    expect(outcome?.status).toBe("closed_unsold");
    expect(Number(outcome?.finalPriceMinor)).toBe(0);
  });
});
