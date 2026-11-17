import PageShell from "../components/PageShell";

// PLACEHOLDER COPY (docs/16 §8 #6): homepage copy is pending copy/design review.
export default function HomePage() {
  return (
    <PageShell
      title="AliAuction.ca"
      description="Canadian C2C and B2C auction marketplace (Phase 1 scaffold)."
    >
      <div className="grid">
        <section className="card">
          <h2>Browse</h2> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
          <p className="muted">Discover listings by category or search.</p> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        </section>
        <section className="card">
          <h2>Sell</h2> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
          <p className="muted">Create a seller profile and list an item.</p> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        </section>
      </div>
      <section className="card">
        <h2>Before launch</h2> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        <p className="muted">
          Copy, visual design and open policy decisions are pending review (docs/16 §8 #6).
        </p> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
      </section>
    </PageShell>
  );
}
