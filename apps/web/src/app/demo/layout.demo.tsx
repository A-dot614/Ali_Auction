import Link from "next/link";
import type { ReactNode } from "react";
import DemoBanner from "../../components/DemoBanner";

/**
 * Demo-only layout. The `.demo.tsx` extension means Next only discovers this
 * file when the demo page extension is enabled, so no demo banner, route name
 * or catalogue string reaches a non-demo build.
 */

const DEMO_LINKS = [
  { href: "/demo", label: "Demo hub" },
  { href: "/demo/checkout", label: "Demo checkout" },
  { href: "/demo/orders", label: "Demo orders" },
  { href: "/demo/shipping", label: "Demo shipping" },
  { href: "/demo/disputes", label: "Demo disputes" },
  { href: "/demo/staff/disputes", label: "Demo staff review" },
  { href: "/demo/account", label: "Demo account" },
] as const;

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DemoBanner />
      <nav aria-label="Demo screens">
        <ul className="nav-list">
          {DEMO_LINKS.map((link) => (
            <li key={link.href}><Link href={link.href}>{link.label}</Link></li>
          ))}
        </ul>
      </nav>
      {children}
    </>
  );
}
