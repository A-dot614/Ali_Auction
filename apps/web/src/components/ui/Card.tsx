import type { ReactNode } from "react";

/** Consistent surface panel. Variants follow the light-track card vocabulary. */
export default function Card({
  children,
  title,
  variant = "default",
}: {
  children: ReactNode;
  title?: string;
  variant?: "default" | "featured" | "band";
}) {
  const variantClass = variant === "default" ? "" : ` ui-card--${variant}`;
  return (
    <section className={`card ui-card${variantClass}`}>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}
