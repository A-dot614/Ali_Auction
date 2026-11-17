import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared semantic layout (D1/D6/D7): header, labelled primary nav, one main
 * landmark with a single h1, and a footer. Mobile-first, 320px-safe.
 * PLACEHOLDER COPY (docs/16 §8 #6) on all user-visible strings.
 */

type Props = { title: string; description?: string; children: ReactNode };

export default function PageShell({ title, description, children }: Props) {
  return (
    <>
      <a href="#main-content" className="button">Skip to main content</a> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
      <header>
        <p><strong>AliAuction.ca</strong></p> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        <nav aria-label="Primary">
          <ul className="flex flex-wrap gap-4 list-none p-0">
            <li><Link href="/">Home</Link></li> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
            <li><Link href="/search">Search</Link></li> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
            <li><Link href="/buyer/bids">My bids</Link></li> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
            <li><Link href="/buyer/orders">Orders</Link></li> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
            <li><Link href="/buyer/notifications">Notifications</Link></li> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
            <li><Link href="/seller/dashboard">Seller</Link></li> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
            <li><Link href="/auth/login">Sign in</Link></li> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
            <li><Link href="/auth/register">Register</Link></li> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
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
