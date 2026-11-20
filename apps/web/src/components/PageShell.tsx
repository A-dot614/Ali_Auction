import Link from "next/link";
import type { ReactNode } from "react";
import DemoBanner from "./DemoBanner";
import { demoMode } from "../lib/demo";

/**
 * Shared semantic layout (D1/D6/D7): header, labelled primary nav, one main
 * landmark with a single h1, and a footer. Mobile-first, 320px-safe.
 * PLACEHOLDER COPY (docs/16 §8 #6) on all user-visible strings.
 *
 * The demo banner is rendered globally in demo builds, so every screen that
 * touches bidding, payments, shipping rates, disputes or email change carries
 * the same visible notice.
 */

type Props = { title: string; description?: string; children: ReactNode };

const PRIMARY_LINKS = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
  { href: "/buyer/bids", label: "My bids" },
  { href: "/buyer/orders", label: "Orders" },
  { href: "/buyer/notifications", label: "Notifications" },
  { href: "/seller/dashboard", label: "Seller" },
  { href: "/checkout", label: "Checkout" },
  { href: "/shipping", label: "Shipping" },
  { href: "/disputes", label: "Disputes" },
  { href: "/staff/disputes", label: "Staff review" },
  { href: "/admin/status", label: "Admin status" },
  { href: "/auth/login", label: "Sign in" },
  { href: "/auth/register", label: "Register" },
] as const;

const DEMO_LINKS = [
  { href: "/demo", label: "Demo hub" },
  { href: "/demo/checkout", label: "Demo checkout" },
  { href: "/demo/orders", label: "Demo orders" },
  { href: "/demo/shipping", label: "Demo shipping" },
  { href: "/demo/disputes", label: "Demo disputes" },
  { href: "/demo/staff/disputes", label: "Demo staff review" },
  { href: "/demo/account", label: "Demo account" },
] as const;

export default function PageShell({ title, description, children }: Props) {
  const links = demoMode ? [...PRIMARY_LINKS, ...DEMO_LINKS] : PRIMARY_LINKS;
  return (
    <>
      <a href="#main-content" className="button">Skip to main content</a> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
      <header>
        <p><strong>AliAuction.ca</strong></p> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        <nav aria-label="Primary">
          <ul className="nav-list">
            {links.map((link) => (
              <li key={link.href}><Link href={link.href}>{link.label}</Link></li>
            ))}
          </ul>
        </nav>
        <DemoBanner />
      </header>
      <main id="main-content">
        <h1>{title}</h1>
        {description ? <p className="muted">{description}</p> : null}
        {children}
      </main>
      <footer>
        <p className="muted">AliAuction.ca — Phase 1 scaffold. Not a launch-ready marketplace.</p> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
      </footer>
    </>
  );
}
