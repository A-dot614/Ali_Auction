import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared semantic layout (D1/D6/D7): header, labelled primary nav, one main
 * landmark with a single h1, and a footer. Mobile-first, 320px-safe.
 * PLACEHOLDER COPY (docs/16 §8 #6) on all user-visible strings.
 *
 * Two design tracks share this shell: `light` for transactional screens and
 * `cinematic` for marketing surfaces. The track sets canvas polarity only; it
 * never changes data, flags, copy rules or behaviour.
 *
 * This is a real-mode module: it imports no demo component, data or copy. The
 * demo build adds its banner and demo navigation from a demo-only layout that
 * is excluded from non-demo builds by the pageExtensions setting.
 */

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
  tone?: "light" | "cinematic";
};

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

const FOOTER_LINKS = [
  { href: "/about", label: "About" },
  { href: "/help", label: "Help" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refunds", label: "Refunds" },
  { href: "/contact", label: "Contact" },
] as const;

export default function PageShell({ title, description, children, tone = "light" }: Props) {
  return (
    <div className="app-shell" data-track={tone}>
      <a href="#main-content" className="ui-button ui-button--secondary">Skip to main content</a> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
      <header className="shell-header">
        <div className="shell-header__inner">
          <p className="wordmark"><strong>AliAuction.ca</strong></p> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
          <nav aria-label="Primary">
            <ul className="nav-list">
              {PRIMARY_LINKS.map((link) => (
                <li key={link.href}><Link href={link.href}>{link.label}</Link></li>
              ))}
            </ul>
          </nav>
          <div className="shell-actions">
            <Link className="ui-button ui-button--secondary" href="/auth/login">Sign in</Link> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
            <Link className="ui-button ui-button--primary" href="/auth/register">Register</Link> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
          </div>
        </div>
      </header>
      <main id="main-content">
        <section className={tone === "cinematic" ? "cinema-hero" : "page-intro"}>
          <div className="section-inner">
            <h1 className="page-title">{title}</h1>
            {description ? <p className="page-lead muted">{description}</p> : null}
          </div>
        </section>
        <div className="page-content">{children}</div>
      </main>
      <footer className="shell-footer">
        <div className="shell-footer__inner">
          <p className="muted">AliAuction.ca — Phase 1 scaffold. Not a launch-ready marketplace.</p> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
          <nav aria-label="Footer">
            <ul className="footer-links">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}><Link href={link.href}>{link.label}</Link></li>
              ))}
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
