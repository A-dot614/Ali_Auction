import PageShell from "../../../components/PageShell";
import {
  BACKEND_FLAG_ROWS,
  countDecisionStatuses,
  loadDecisionLog,
} from "../../../lib/decision-log";

// Read-only snapshot parsed from the decision log at build time.
export const dynamic = "force-static";

export default function AdminStatusPage() {
  const rows = loadDecisionLog();
  const counts = countDecisionStatuses(rows);
  const summary = `${counts.decided} decided / ${counts.pending} pending`;
  return (
    <PageShell
      title="Admin status"
      description="Read-only build-time view of feature flags and owner decisions."
    >
      <section className="card">
        <h2>Feature flags</h2>
        <table className="status-table responsive-table">
          <thead>
            <tr><th scope="col">Flag</th><th scope="col">State</th><th scope="col">Gate</th></tr>
          </thead>
          <tbody>
            {BACKEND_FLAG_ROWS.map((row) => (
              <tr key={row.flag}>
                <td><code>{row.flag}</code></td>
                <td><strong>{row.state}</strong></td>
                <td>{row.gate}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">Real bidding and real-money payments stay OFF until every required decision-log row is filled and signed off.</p>
      </section>
      <section className="card">
        <h2>Owner decisions</h2>
        <p>
          Parsed from <code>docs-implementation/decision-log.md</code> at build time:
          <strong>{summary}</strong>.
        </p>
        <table className="status-table responsive-table">
          <thead>
            <tr>
              <th scope="col">Decision ID</th>
              <th scope="col">Owner role</th>
              <th scope="col">Status</th>
              <th scope="col">Decided by / date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.ownerRole}</td>
                <td className={`tone-${row.status === "decided" ? "success" : "pending"}`}>{row.status}</td>
                <td>{row.decidedBy ? `${row.decidedBy} / ${row.date}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">No row on this page is editable. No decision was inferred or pre-filled.</p>
      </section>
    </PageShell>
  );
}
