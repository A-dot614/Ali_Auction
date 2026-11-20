import Link from "next/link";
import PageShell from "../components/PageShell";

export default function NotFound() {
  return (
    <PageShell title="Page not found" description="The page you requested is not available.">
      <section className="card ui-card" role="status">
        <p><strong>Page not found</strong></p>
        <p className="muted">The address may have changed. Nothing was charged and no action was taken.</p>
        <p><Link href="/">Go to the home page</Link></p>
      </section>
    </PageShell>
  );
}
