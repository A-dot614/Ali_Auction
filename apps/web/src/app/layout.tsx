import type { Metadata } from "next";
import "./globals.css";
import ServiceWorkerRegistrar from "../components/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "AliAuction.ca",
  description: "Canadian C2C and B2C auction marketplace (Phase 1 foundation)",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-placeholder.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-CA">
      <body>
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
