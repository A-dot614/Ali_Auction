"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { formatCountdown, remainingFromServer } from "../lib/countdown";
import { bidStatus, type BidStatus } from "../lib/bid-status";
import { messageForError } from "../lib/errors";
import { gql } from "../lib/graphql";
import { subscribeOrFallback } from "../lib/realtime";
import { webConfig } from "../lib/config";

/**
 * Auction detail UI (D3/D4). Countdown is derived from server time; the client
 * never decides state or bid validity. Bid status is text, never colour alone.
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
  auctionId,
  endsAtIso,
  initialServerTimeIso,
  currentPriceMinor,
  bidCount,
  bids,
}: Props) {
  const [serverTimeIso, setServerTimeIso] = useState(initialServerTimeIso);
  const [countdown, setCountdown] = useState(() => formatCountdown(remainingFromServer(Date.parse(endsAtIso), initialServerTimeIso)));
  const [status, setStatus] = useState<BidStatus | null>(null);
  const [amount, setAmount] = useState("");

  const refetch = useCallback(async () => {
    const result = await gql<{ serverTime: string }>(`query { serverTime }`);
    if (result.data?.serverTime) setServerTimeIso(result.data.serverTime);
  }, []);

  useEffect(() => {
    let active = true;
    const tick = () => {
      if (active) setCountdown(formatCountdown(remainingFromServer(Date.parse(endsAtIso), serverTimeIso)));
    };
    tick();
    const timer = setInterval(() => {
      void subscribeOrFallback(async () => {
        await refetch();
        tick();
      }, webConfig);
    }, webConfig.refetchIntervalMs);
    const onFocus = () => { void subscribeOrFallback(refetch, webConfig); };
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [auctionId, endsAtIso, refetch, serverTimeIso]);

  async function submitBid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(bidStatus("submitted")); // PLACEHOLDER COPY (docs/16 §8 #6)
    const requestId = crypto.randomUUID();
    const result = await gql<{
      placeBid: { accepted: boolean; error: { code: string; message: string } | null };
    }>(
      `mutation($input: PlaceBidInput!) {
        placeBid(input: $input) { accepted error { code message } }
      }`,
      { input: { auctionId, amountMinor: Number(amount), requestId } }
    );
    const payload = result.data?.placeBid;
    if (payload?.accepted) {
      setStatus(bidStatus("accepted")); // PLACEHOLDER COPY (docs/16 §8 #6)
    } else {
      const raw = payload?.error?.message ?? result.errors?.[0]?.message;
      setStatus(bidStatus("rejected", raw)); // PLACEHOLDER COPY (docs/16 §8 #6)
      void messageForError(raw); // mapped copy comes from bidStatus(); no raw text is rendered
    }
    await subscribeOrFallback(refetch, webConfig);
  }

  return (
    <section className="card" aria-labelledby="auction-heading">
      <h2 id="auction-heading">Auction status</h2> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
      <dl>
        <dt>Current price (minor units)</dt> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        <dd>{currentPriceMinor}</dd>
        <dt>Bid count</dt> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        <dd>{bidCount}</dd>
        <dt>Time remaining</dt> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        <dd><span role="timer">{countdown}</span></dd>
      </dl>
      <form onSubmit={submitBid}>
        <label htmlFor="bid-amount">Your bid (minor units)</label> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        <input
          id="bid-amount"
          name="bid-amount"
          type="number"
          min={1}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button type="submit">Place bid</button> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
      </form>
      {status ? (
        <p role="status" className={`tone-${status.tone}`}>{status.text}</p>
      ) : null}
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
