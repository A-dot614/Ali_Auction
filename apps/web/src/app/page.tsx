const workstreams = [
  "Identity and account management",
  "Seller profile and basic verification workflow",
  "Categories and listing management",
  "Timed auction engine",
  "Manual bidding and approved proxy-bidding baseline",
  "Search and browsing",
  "Checkout and selected payment provider",
  "Orders and basic fulfilment",
  "Admin moderation and audit trail",
  "Notifications",
  "Responsive web/PWA",
  "Security, privacy, support and observability",
];

const foundations = [
  "Monorepo scaffold: apps/web (Next.js), apps/api (Express+GraphQL), packages/shared",
  "Local infra: PostgreSQL + Redis via Docker Compose",
  "Starter DB bootstrap from docs/05-postgresql-starter-schema.sql.md",
  "Environment template and CI skeleton",
  "Implementation status tracker: docs-implementation/PHASE1_STATUS.md",
];

export default function HomePage() {
  return (
    <main>
      <h1>AliAuction.ca</h1>
      <p className="muted">
        Phase 1 (MVP) foundation scaffolded from <code>/docs</code>. This is a
        planning-aligned starting point, not a launch-ready marketplace.
      </p>

      <div className="grid">
        <section className="card">
          <h2>Phase 1 workstreams</h2>
          <ul>
            {workstreams.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>Foundation added in repo</h2>
          <ul>
            {foundations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="muted">
            API health: <code>GET http://localhost:4000/health</code> and GraphQL{" "}
            <code>/graphql</code> once dependencies are installed.
          </p>
        </section>
      </div>

      <section className="card">
        <h2>Important before building core flows</h2>
        <ul>
          <li>Resolve open decisions in <code>docs/16-assumptions-decisions-and-open-questions.md</code>.</li>
          <li>Approve auction, fee, payment, and payout rules before settlement/charging logic.</li>
          <li>Complete legal/privacy/payment/compliance review before real-money launch.</li>
          <li>Treat starter schema as a draft; split into reviewed migrations.</li>
        </ul>
      </section>
    </main>
  );
}
