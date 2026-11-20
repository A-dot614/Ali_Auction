"use client";

import PageShell from "../components/PageShell";
import Button from "../components/ui/Button";

/** Neutral 500 state. Raw error text is never rendered to the user. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;
  return (
    <PageShell title="Something went wrong" description="This page could not be shown.">
      <section className="card ui-card" role="alert">
        <p><strong>Something went wrong. Please try again.</strong></p>
        <p className="muted">No payment was taken and no bid was placed.</p>
        <Button onClick={reset}>Try again</Button>
      </section>
    </PageShell>
  );
}
