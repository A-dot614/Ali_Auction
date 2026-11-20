import type { Metadata } from "next";
import PageShell from "../../components/PageShell";

// D8: neutral offline fallback — no account data is rendered here.
// PLACEHOLDER COPY (docs/16 §8 #6)
export const metadata: Metadata = {
  title: "Offline — AliAuction.ca",
  description: "Offline fallback notice.",
};

export default function OfflinePage() {
  return (
    <PageShell title="Offline" description="You appear to be offline.">
      <section className="card" role="status">
        <p>
          You are offline. Reconnect to continue browsing. No account information is shown here.
        </p> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
      </section>
    </PageShell>
  );
}
