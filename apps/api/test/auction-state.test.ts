import { describe, expect, it } from "vitest";
import {
  ALL_AUCTION_STATUSES,
  InvalidAuctionTransitionError,
  assertCancel,
  assertTransition,
  canCancel,
  canTransition,
  getAllowedTransitions,
  type AuctionStatus,
} from "../src/auction/auctionStateMachine.js";
import { minimumBidMinor } from "../src/auction/minimumBid.js";
import { determineAuctionOutcome } from "../src/auction/service.js";
import { config } from "../src/config.js";

describe("auction state machine (Slice 4a)", () => {
  const allowedPairs: Array<[AuctionStatus, AuctionStatus]> = [
    ["scheduled", "active"],
    ["scheduled", "closed_unsold"],
    ["active", "closed_sold"],
    ["active", "closed_unsold"],
  ];

  it("exposes allowed transitions per state", () => {
    expect(getAllowedTransitions("scheduled")).toEqual(["active", "closed_unsold"]);
    expect(getAllowedTransitions("active")).toEqual(["closed_sold", "closed_unsold"]);
    expect(getAllowedTransitions("closed_sold")).toEqual([]);
    expect(getAllowedTransitions("closed_unsold")).toEqual([]);
    expect(getAllowedTransitions("cancelled")).toEqual([]);
  });

  it("allows scheduled → closed_unsold and active → closed_sold/closed_unsold (Slice 4b)", () => {
    // D2 and D1 proposed placeholders (docs/16 §3), NOT FOR PRODUCTION.
    for (const from of ["scheduled", "active"] as AuctionStatus[]) {
      const expected = from === "scheduled" ? ["closed_unsold"] : ["closed_sold", "closed_unsold"];
      for (const to of expected as AuctionStatus[]) {
        expect(canTransition(from, to)).toBe(true);
        expect(() => assertTransition(from, to)).not.toThrow();
      }
    }
  });

  it("allows every allowed pair", () => {
    for (const [from, to] of allowedPairs) {
      expect(canTransition(from, to)).toBe(true);
      expect(() => assertTransition(from, to)).not.toThrow();
    }
  });

  it("disallows every disallowed pair", () => {
    const allowedSet = new Set(allowedPairs.map(([f, t]) => `${f}->${t}`));
    for (const from of ALL_AUCTION_STATUSES) {
      for (const to of ALL_AUCTION_STATUSES) {
        if (allowedSet.has(`${from}->${to}`)) continue;
        expect(canTransition(from, to)).toBe(false);
        expect(() => assertTransition(from, to)).toThrow(InvalidAuctionTransitionError);
        try {
          assertTransition(from, to);
        } catch (e: any) {
          expect(e.code).toBe("INVALID_AUCTION_TRANSITION");
        }
      }
    }
  });

  it("allows cancel only when the auction has no bids", () => {
    // No bids -> scheduled -> cancelled allowed.
    expect(canCancel("scheduled", false)).toBe(true);
    expect(() => assertCancel("scheduled", false)).not.toThrow();
    // Cancel with bids is OPEN per docs/16 §3 #9 and not implemented in Slice 4a.
    expect(canCancel("scheduled", true)).toBe(false);
    expect(() => assertCancel("scheduled", true)).toThrow(InvalidAuctionTransitionError);
    // Cancel only applies to scheduled auctions in Slice 4a.
    expect(canCancel("active", false)).toBe(false);
    expect(canCancel("closed_sold", false)).toBe(false);
    expect(canCancel("cancelled", false)).toBe(false);
  });
});

describe("minimum bid calculation (Slice 4a)", () => {
  it("uses the starting price for the first bid and current price + placeholder increment afterwards", () => {
    const incrementMinor = config.auction.bidIncrementMinor;
    // Placeholder increment (docs/16 §3 #3): default 100 minor units = CAD $1.00.
    expect(incrementMinor).toBe(100);

    // No accepted bids yet: the minimum is the starting price.
    expect(
      minimumBidMinor({
        bidCount: 0,
        startingPriceMinor: 2500,
        currentPriceMinor: 2500,
        incrementMinor,
      })
    ).toBe(2500);

    // After at least one accepted bid: minimum = current price + increment.
    expect(
      minimumBidMinor({
        bidCount: 1,
        startingPriceMinor: 2500,
        currentPriceMinor: 2500,
        incrementMinor,
      })
    ).toBe(2600);
    expect(
      minimumBidMinor({
        bidCount: 4,
        startingPriceMinor: 2500,
        currentPriceMinor: 2900,
        incrementMinor,
      })
    ).toBe(3000);

    // A custom injected increment is respected (not hardcoded).
    expect(
      minimumBidMinor({
        bidCount: 2,
        startingPriceMinor: 1000,
        currentPriceMinor: 1100,
        incrementMinor: 500,
      })
    ).toBe(1600);
  });
});

describe("auction close outcome (Slice 4b)", () => {
  it("no bids → closed_unsold with no winner", () => {
    expect(determineAuctionOutcome([])).toEqual({
      status: "closed_unsold",
      winningBidId: null,
      winningAmountMinor: null,
      winnerBidderLabel: null,
    });
  });

  it("one bid → closed_sold with that bid as winner", () => {
    const outcome = determineAuctionOutcome([
      { id: "bid-1", amountMinor: 2500, bidderUserId: "user-1" },
    ]);
    expect(outcome.status).toBe("closed_sold");
    expect(outcome.winningBidId).toBe("bid-1");
    expect(outcome.winningAmountMinor).toBe("2500");
    expect(outcome.winnerBidderLabel).toMatch(/^bidder-[0-9a-f]{16}$/);
    expect(outcome.winnerBidderLabel).not.toContain("user-1");
  });

  it("several bids → highest amount wins", () => {
    const outcome = determineAuctionOutcome([
      { id: "bid-1", amountMinor: 2500, bidderUserId: "user-1" },
      { id: "bid-2", amountMinor: "2900", bidderUserId: "user-2" },
      { id: "bid-3", amountMinor: 2700, bidderUserId: "user-3" },
    ]);
    expect(outcome.status).toBe("closed_sold");
    expect(outcome.winningAmountMinor).toBe("2900");
  });

  it("winning bid id is the max even when amounts are bigint strings", () => {
    const outcome = determineAuctionOutcome([
      { id: "small", amountMinor: "9007199254740993", bidderUserId: "user-1" },
      { id: "large", amountMinor: "9007199254740994", bidderUserId: "user-2" },
    ]);
    expect(outcome.winningBidId).toBe("large");
    expect(outcome.winningAmountMinor).toBe("9007199254740994");
  });
});
