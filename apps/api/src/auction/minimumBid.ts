/**
 * Minimum-bid calculation (Slice 4a).
 *
 * Placeholder rule (TODO docs/16 §3 #2, §3 #3):
 * - The client submits the NEXT bid amount (not an increment).
 * - With no accepted bids, the minimum is the auction's starting price.
 * - After the first accepted bid, the minimum is current price + one configured increment.
 *
 * The increment is a placeholder (config.auction.bidIncrementMinor, default 100 minor units / CAD $1.00).
 * The approved increment schedule by price band/category is OPEN (docs/16 §3 #3) - do not hardcode.
 */

export type MinimumBidParams = {
  /** Number of accepted bids on the auction. */
  bidCount: number;
  /** starting_price_minor (minor units, CAD). */
  startingPriceMinor: number;
  /** current_price_minor (minor units, CAD). */
  currentPriceMinor: number;
  /** Placeholder increment in minor units (docs/16 §3 #3). */
  incrementMinor: number;
};

/** Returns the minimum acceptable next bid amount in minor units. */
export function minimumBidMinor(params: MinimumBidParams): number {
  const { bidCount, startingPriceMinor, currentPriceMinor, incrementMinor } = params;
  if (bidCount > 0) {
    return currentPriceMinor + incrementMinor;
  }
  return startingPriceMinor;
}
