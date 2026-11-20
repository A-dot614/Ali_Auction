"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { gql } from "../lib/graphql";
import { messageForError } from "../lib/errors";
import Button from "./ui/Button";
import Field from "./ui/Field";

const ACTIONS = {
  approve: `mutation($id: ID!) { approveListing(id: $id) { id status } }`,
  reject: `mutation($id: ID!, $reason: String) { rejectListing(id: $id, reason: $reason) { id status } }`,
  pause: `mutation($id: ID!, $reason: String) { pauseListing(id: $id, reason: $reason) { id status } }`,
  remove: `mutation($id: ID!, $reason: String) { removeListing(id: $id, reason: $reason) { id status } }`,
} as const;

type Action = keyof typeof ACTIONS;

/**
 * Uses only the moderation mutations that already exist. No approval outcome is
 * assumed: the staff member submits an explicit action and the API decides.
 */
export default function ListingReviewActions({ id }: { id: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(action: Action) {
    setBusy(true);
    setStatus("");
    try {
      const variables = action === "approve" ? { id } : { id, reason: reason || null };
      const result = await gql(ACTIONS[action], variables);
      setStatus(result.errors?.length ? messageForError(result.errors[0].message) : `Action sent: ${action}.`);
      if (!result.errors?.length) router.refresh();
    } catch {
      setStatus("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="review-actions">
      <Field
        id={`review-reason-${id}`}
        label="Reason (required for reject, pause and remove)"
        value={reason}
        onChange={setReason}
      />
      <p className="review-buttons">
        <Button onClick={() => void act("approve")} disabled={busy}>Approve</Button>{" "}
        <Button variant="secondary" onClick={() => void act("reject")} disabled={busy}>Reject</Button>{" "}
        <Button variant="secondary" onClick={() => void act("pause")} disabled={busy}>Pause</Button>{" "}
        <Button variant="quiet" onClick={() => void act("remove")} disabled={busy}>Remove</Button>
      </p>
      {status ? <p role="status">{status}</p> : null}
    </div>
  );
}
