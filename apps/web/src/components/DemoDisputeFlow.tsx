"use client";

import { useState, type FormEvent } from "react";
import {
  DEMO_DISPUTE_REASON_PLACEHOLDER,
  DEMO_DISPUTES,
  type DemoDispute,
} from "../lib/demo-disputes";

/** Demo-only buyer dispute flow: all records live in this component's state. */
export default function DemoDisputeFlow({ initialOrderId }: { initialOrderId?: string }) {
  const [disputes, setDisputes] = useState<DemoDispute[]>(DEMO_DISPUTES);
  const [orderId, setOrderId] = useState(initialOrderId ?? "demo-order-1");
  const [reason, setReason] = useState("");
  const [evidenceName, setEvidenceName] = useState("");
  const [message, setMessage] = useState("");

  function openDispute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = `demo-dispute-${disputes.length + 1}`;
    setDisputes((current) => [
      ...current,
      {
        id,
        orderId,
        reasonLabel: reason.trim() || DEMO_DISPUTE_REASON_PLACEHOLDER,
        status: "open (demo state)",
        evidence: [],
        openedAtIso: "2026-11-20T12:00:00.000Z",
      },
    ]);
    setMessage(`Demo dispute ${id} recorded locally. No policy or outcome was decided.`);
    setReason("");
  }

  function addEvidence(disputeId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const filename = evidenceName.trim() || "demo-attachment.txt";
    setDisputes((current) =>
      current.map((dispute) =>
        dispute.id === disputeId
          ? {
              ...dispute,
              evidence: [
                ...dispute.evidence,
                { id: `${disputeId}-evidence-${dispute.evidence.length + 1}`, filename, sizeBytes: 24 },
              ],
            }
          : dispute
      )
    );
    setEvidenceName("");
    setMessage("Demo evidence listed locally. No file was uploaded or stored.");
  }

  return (
    <>
      <section className="card ui-card" aria-labelledby="demo-dispute-open-heading">
        <h2 id="demo-dispute-open-heading">Open a demo dispute</h2>
        <p><strong>Simulation only. Evidence is not uploaded and no outcome is decided.</strong></p>
        <form onSubmit={openDispute}>
          <label htmlFor="demo-dispute-order">Demo order</label>
          <select id="demo-dispute-order" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
            <option value="demo-order-1">demo-order-1</option>
            <option value="demo-order-2">demo-order-2</option>
            <option value="demo-order-3">demo-order-3</option>
          </select>
          <label htmlFor="demo-dispute-reason">Reason label (free text)</label>
          <textarea id="demo-dispute-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button type="submit">Open demo dispute</button>
        </form>
        {message ? <p role="status">{message}</p> : null}
      </section>
      <section className="card ui-card">
        <h2>Demo dispute status and evidence</h2>
        {disputes.map((dispute) => (
          <article key={dispute.id}>
            <h3>{dispute.id}</h3>
            <dl>
              <dt>Order</dt><dd>{dispute.orderId}</dd>
              <dt>Reason label</dt><dd>{dispute.reasonLabel}</dd>
              <dt>Status</dt><dd>{dispute.status}</dd>
              <dt>Opened at</dt><dd>{dispute.openedAtIso}</dd>
            </dl>
            <h4>Evidence list (in-memory)</h4>
            <ul>
              {dispute.evidence.map((item) => (
                <li key={item.id}>{item.filename} — {item.sizeBytes} bytes (demo only)</li>
              ))}
            </ul>
            <form onSubmit={(event) => addEvidence(dispute.id, event)}>
              <label htmlFor={`demo-evidence-${dispute.id}`}>Demo evidence filename</label>
              <input
                id={`demo-evidence-${dispute.id}`}
                value={evidenceName}
                onChange={(e) => setEvidenceName(e.target.value)}
              />
              <button type="submit">Add demo evidence</button>
            </form>
          </article>
        ))}
      </section>
    </>
  );
}
