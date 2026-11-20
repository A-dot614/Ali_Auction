import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared semantic layout (D1/D6/D7): header, labelled primary nav, one main
 * landmark with a single h1, and a footer. Mobile-first, 320px-safe.
 * PLACEHOLDER COPY (docs/16 §8 #6) on all user-visible strings.
 *
 * Demo navigation and the demo notice are loaded only in a demo build. The
 * direct build-time env check lets the bundler remove that import entirely
 * from the non-demo bundle.
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

export default async function PageShell({ title, description, children }: Props) {
  let demoNav: ReactNode = null;
  let demoNotice: ReactNode = null;
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    const { DemoNavLinks, DemoNotice } = await import("./DemoShellExtras");
    demoNav = <DemoNavLinks />;
    demoNotice = <DemoNotice />;
  }

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
            {demoNav}
          </ul>
        </nav>
        {demoNotice}
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
