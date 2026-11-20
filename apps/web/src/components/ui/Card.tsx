import type { ReactNode } from "react";

/** Consistent surface panel used by every screen. */
export default function Card({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <section className="card ui-card">
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}
