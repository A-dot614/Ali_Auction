import type { ReactNode } from "react";

/** Status badge: tone is always paired with readable text. */
export default function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "error";
}) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}
