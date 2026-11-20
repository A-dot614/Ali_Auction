"use client";

import { useState } from "react";
import { gql } from "../lib/graphql";
import { messageForError } from "../lib/errors";
import Button from "./ui/Button";

/** Marks one notification read for the signed-in recipient; no token is handled here. */
export default function MarkNotificationReadButton({ id }: { id: string }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function markRead() {
    setBusy(true);
    try {
      const result = await gql(`mutation($id: ID!) { markNotificationRead(id: $id) { id } }`, { id });
      setStatus(result.errors?.length ? messageForError(result.errors[0].message) : "Marked as read.");
    } catch {
      setStatus("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <Button variant="quiet" onClick={() => void markRead()} disabled={busy}>Mark as read</Button>
      {status ? <span role="status" className="muted"> {status}</span> : null}
    </span>
  );
}
