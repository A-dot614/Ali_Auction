"use client";

import { useState, type FormEvent } from "react";

/**
 * Demo-only bidding simulation. All state is local to the browser component;
 * no endpoint is called, no price rule is implied, and no auction decision is
 * made. The global demo banner is rendered by PageShell on this screen too.
 */

type Bid = { id: string; bidderLabel: string; amountMinor: number };

export default function DemoBidPanel({
  startingPriceMinor,
  initialBids,
}: {
  startingPriceMinor: number;
  initialBids: Bid[];
}) {
  const [bids, setBids] = useState<Bid[]>(initialBids);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");

  function submitDemoBid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(amount);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setMessage("Enter a whole number greater than zero.");
      return;
    }
    // Simulation only: no validation rule is asserted as an approved auction rule.
    setBids((current) => [
      ...current,
      { id: `demo-local-${current.length + 1}`, bidderLabel: "You (local simulation)", amountMinor: parsed },
    ]);
    setMessage("Demo bid recorded in this browser session only. Nothing was sent.");
    setAmount("");
  }

  const currentPriceMinor = bids.length > 0 ? bids[bids.length - 1].amountMinor : startingPriceMinor;

  return (
    <section className="card ui-card" aria-labelledby="demo-bid-heading">
      <h2 id="demo-bid-heading">Bidding simulation</h2>
      <p><strong>Simulation only — no auction rule is decided and no bid is sent anywhere.</strong></p>
      <dl>
        <dt>Current local price (minor units)</dt><dd>{currentPriceMinor}</dd>
        <dt>Local bid count</dt><dd>{bids.length}</dd>
      </dl>
      <form onSubmit={submitDemoBid}>
        <label htmlFor="bid-amount">Your demo bid (minor units)</label>
        <input
          id="bid-amount"
          name="bid-amount"
          type="number"
          min={1}
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <button type="submit">Place demo bid</button>
      </form>
      {message ? <p role="status">{message}</p> : null}
      <h2>Local bid history</h2>
      <table className="responsive-table">
        <thead>
          <tr><th scope="col">Bidder</th><th scope="col">Amount (minor units)</th></tr>
        </thead>
        <tbody>
          {bids.map((bid) => (
            <tr key={bid.id}><td>{bid.bidderLabel}</td><td>{bid.amountMinor}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
