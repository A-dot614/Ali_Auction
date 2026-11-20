import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Shared button styling. Native element and explicit type are always retained. */
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "quiet" | "aloe";
};

export default function Button({
  children,
  variant = "primary",
  type = "button",
  className = "",
  ...rest
}: Props) {
  return (
    <button type={type} className={`ui-button ui-button--${variant} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}
