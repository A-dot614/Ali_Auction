import Link from "next/link";
import DemoBanner from "./DemoBanner";

/**
 * Demo-only shell additions. This module is dynamically imported by PageShell
 * only when NEXT_PUBLIC_DEMO_MODE is true, so non-demo builds never contain the
 * demo navigation paths or banner copy.
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

export function DemoNavLinks() {
  return (
    <>
      {DEMO_LINKS.map((link) => (
        <li key={link.href}><Link href={link.href}>{link.label}</Link></li>
      ))}
    </>
  );
}

export function DemoNotice() {
  return <DemoBanner />;
}
