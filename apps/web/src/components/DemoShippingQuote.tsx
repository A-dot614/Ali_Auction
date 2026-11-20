"use client";

import { useState, type FormEvent } from "react";
import { demoQuoteForRoute, type DemoShippingQuote } from "../lib/demo-shipping";

/** Demo-only quote display: local fake response, no network, no decision. */
export default function DemoShippingQuote() {
  const [fromProvince, setFromProvince] = useState("AB");
  const [toProvince, setToProvince] = useState("BC");
  const [quote, setQuote] = useState<DemoShippingQuote | null>(null);

  function requestQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuote(demoQuoteForRoute(fromProvince, toProvince));
  }

  return (
    <section className="card ui-card" aria-labelledby="demo-shipping-heading">
      <h2 id="demo-shipping-heading">Demo rate quote</h2>
      <p><strong>Fake quoter only. Carrier, scope and cost are placeholders; no decision is made.</strong></p>
      <form onSubmit={requestQuote}>
        <label htmlFor="demo-shipping-from">From province</label>
        <select id="demo-shipping-from" value={fromProvince} onChange={(e) => setFromProvince(e.target.value)}>
          <option value="AB">AB</option>
          <option value="BC">BC</option>
          <option value="ON">ON</option>
        </select>
        <label htmlFor="demo-shipping-to">To province</label>
        <select id="demo-shipping-to" value={toProvince} onChange={(e) => setToProvince(e.target.value)}>
          <option value="AB">AB</option>
          <option value="BC">BC</option>
          <option value="ON">ON</option>
        </select>
        <button type="submit">Get demo quote</button>
      </form>
      {quote ? (
        <dl>
          <dt>Mode</dt><dd>{quote.mode}</dd>
          <dt>Source</dt><dd>{quote.source}</dd>
          <dt>Amount (minor units)</dt><dd>{quote.amountMinor}</dd>
          <dt>Currency</dt><dd>{quote.currency}</dd>
          <dt>Carriers</dt><dd>{quote.carriers}</dd>
          <dt>Scope</dt><dd>{quote.scope}</dd>
        </dl>
      ) : null}
    </section>
  );
}
