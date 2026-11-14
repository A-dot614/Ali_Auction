// Shared domain types/constants placeholder for Phase 1.
// Keep server-authoritative business rules in backend services; share DTOs/enums only where safe.

export const CURRENCY_CAD = "CAD" as const;

export type MoneyMinor = {
  amountMinor: number;
  currency: typeof CURRENCY_CAD;
};

export type Phase1Workstream =
  | "identity"
  | "seller-verification"
  | "catalogue-listings"
  | "timed-auction-engine"
  | "bidding-proxy"
  | "search-browsing"
  | "checkout-payments"
  | "orders-fulfilment"
  | "admin-moderation-audit"
  | "notifications"
  | "responsive-web-pwa"
  | "security-privacy-observability";

export const PHASE1_WORKSTREAMS: Phase1Workstream[] = [
  "identity",
  "seller-verification",
  "catalogue-listings",
  "timed-auction-engine",
  "bidding-proxy",
  "search-browsing",
  "checkout-payments",
  "orders-fulfilment",
  "admin-moderation-audit",
  "notifications",
  "responsive-web-pwa",
  "security-privacy-observability",
];
