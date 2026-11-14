import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AliAuction.ca",
  description: "Canadian C2C and B2C auction marketplace (Phase 1 foundation)",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-CA">
      <body>{children}</body>
    </html>
  );
}
