"use client";

import { useEffect, useState } from "react";
import { formatCountdown, remainingFromServer } from "../lib/countdown";
import NotEnabled from "./NotEnabled";

/**
 * Auction status UI (D3/D4). Countdown is derived from a server-provided
 * instant; the client never decides state or bid validity. Live bidding stays
 * OFF: this component never sends a bid request and never calls a bidding
 * endpoint. Demo bidding lives in a separate, labeled client component.
 * PLACEHOLDER COPY (docs/16 §8 #6) on all user-visible strings.
 */

type BidView = { id: string; bidderLabel: string; amount: { minorUnits: number } };
type Props = {
  auctionId: string;
  endsAtIso: string;
  initialServerTimeIso: string;
  currentPriceMinor: number;
  bidCount: number;
  bids: BidView[];
};

export default function AuctionPanel({
  endsAtIso,
  initialServerTimeIso,
  currentPriceMinor,
  bidCount,
  bids,
}: Props) {
  const [countdown, setCountdown] = useState(() =>
    formatCountdown(remainingFromServer(Date.parse(endsAtIso), initialServerTimeIso))
  );

  useEffect(() => {
    let active = true;
    const tick = () => {
      if (active) setCountdown(formatCountdown(remainingFromServer(Date.parse(endsAtIso), initialServerTimeIso)));
    };
    const timer = setInterval(tick, 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [endsAtIso, initialServerTimeIso]);

  return (
    <section className="card ui-card" aria-labelledby="auction-heading">
      <h2 id="auction-heading">Auction status</h2> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
      <dl>
        <dt>Current price (minor units)</dt> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        <dd>{currentPriceMinor}</dd>
        <dt>Bid count</dt> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        <dd>{bidCount}</dd>
        <dt>Time remaining</dt> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        <dd><span role="timer">{countdown}</span></dd>
      </dl>
      <NotEnabled
        message="Bidding is not enabled"
        detail="Live bidding remains OFF. No bid is submitted from this screen."
      />
      <h2>Bid history</h2> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
      <table className="responsive-table">
        <thead>
          <tr><th scope="col">Bidder</th><th scope="col">Amount</th></tr> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        </thead>
        <tbody>
          {bids.map((bid) => (
            <tr key={bid.id}>
              <td>{bid.bidderLabel}</td>
              <td>{bid.amount.minorUnits}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
