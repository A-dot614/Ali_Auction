import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared semantic layout (D1/D6/D7): header, labelled primary nav, one main
 * landmark with a single h1, and a footer. Mobile-first, 320px-safe.
 * PLACEHOLDER COPY (docs/16 §8 #6) on all user-visible strings.
 *
 * This is a real-mode module: it imports no demo component, data or copy. The
 * demo build adds its banner and demo navigation from a demo-only layout that
 * is excluded from non-demo builds by the pageExtensions setting.
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

export default function PageShell({ title, description, children }: Props) {
  return (
    <>
      <a href="#main-content" className="button">Skip to main content</a> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
      <header>
        <p><strong>AliAuction.ca</strong></p> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        <nav aria-label="Primary">
          <ul className="nav-list">
            {PRIMARY_LINKS.map((link) => (
              <li key={link.href}><Link href={link.href}>{link.label}</Link></li>
            ))}
          </ul>
        </nav>
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
