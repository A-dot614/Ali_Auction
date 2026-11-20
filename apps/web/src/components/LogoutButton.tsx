"use client";

import { useState } from "react";
import { gql } from "../lib/graphql";
import { messageForError } from "../lib/errors";
import Button from "./ui/Button";

/** Calls the existing logout mutation; session cookies stay HttpOnly. */
export default function LogoutButton() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      const result = await gql(`mutation { logout { ok } }`);
      setStatus(result.errors?.length ? messageForError(result.errors[0].message) : "Signed out.");
    } catch {
      setStatus("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button variant="secondary" onClick={() => void logout()} disabled={busy}>
        Sign out
      </Button>
      {status ? <p role="status">{status}</p> : null}
    </div>
  );
}
