import Link from "next/link";
import PageShell from "../../components/PageShell";

export const dynamic = "force-dynamic";

const DEMO_PAGES = [
  { href: "/demo/listings", label: "Browse, search and filter demo listings", proves: "In-memory catalogue and listing cards" },
  { href: "/demo/listings/vintage-desk-lamp", label: "Demo listing detail", proves: "Photos, seller information and auction timer" },
  { href: "/demo/bidding", label: "Demo bidding simulation", proves: "Local mock bid state; no bidding endpoint is used" },
  { href: "/demo/checkout", label: "Demo checkout", proves: "Provider-neutral fake hosted session, success, failure and refund states" },
  { href: "/demo/orders", label: "Demo orders", proves: "Order list from in-memory data" },
  { href: "/demo/orders/demo-order-1", label: "Demo order detail", proves: "Status, payment events and timeline" },
  { href: "/demo/shipping", label: "Demo shipping quote", proves: "Fake quoter response shape with required inputs" },
  { href: "/demo/disputes", label: "Demo disputes", proves: "Buyer dispute, evidence list and status" },
  { href: "/demo/staff/disputes", label: "Demo staff review", proves: "Labeled review simulation with no decision made" },
  { href: "/demo/account", label: "Demo account", proves: "Profile allowlist and email change not enabled" },
  { href: "/admin/status", label: "Admin status", proves: "All flags OFF and read-only decision-log status" },
] as const;

export default function DemoHubPage() {
  return (
    <PageShell
      title="Demo hub"
      description="Every screen below is a local simulation. No decision is made and nothing is charged."
    >
      <table className="status-table responsive-table">
        <thead>
          <tr><th scope="col">Screen</th><th scope="col">What it proves</th></tr>
        </thead>
        <tbody>
          {DEMO_PAGES.map((page) => (
            <tr key={page.href}>
              <td><Link href={page.href}>{page.label}</Link></td>
              <td>{page.proves}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">Set NEXT_PUBLIC_DEMO_MODE=true at build time to see these screens. A production build with demo mode on fails.</p>
    </PageShell>
  );
}
