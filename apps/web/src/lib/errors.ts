/**
 * Stable API error code -> neutral placeholder copy (D2).
 * PLACEHOLDER COPY (docs/16 §8 #6): pending copy review.
 * Raw server messages are never returned or rendered.
 */

export const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Please sign in to continue.", // PLACEHOLDER COPY (docs/16 §8 #6)
  FORBIDDEN: "You do not have permission to do that.", // PLACEHOLDER COPY (docs/16 §8 #6)
  EMAIL_NOT_VERIFIED: "Please verify your email before continuing.", // PLACEHOLDER COPY (docs/16 §8 #6)
  ACCOUNT_SUSPENDED: "This account is not available.", // PLACEHOLDER COPY (docs/16 §8 #6)
  NOT_FOUND: "We could not find that item.", // PLACEHOLDER COPY (docs/16 §8 #6)
  VALIDATION_ERROR: "Please check the information you entered.", // PLACEHOLDER COPY (docs/16 §8 #6)
  RATE_LIMITED: "Too many requests. Please try again shortly.", // PLACEHOLDER COPY (docs/16 §8 #6)
  LIVE_BIDDING_DISABLED: "Bidding is not available yet.", // PLACEHOLDER COPY (docs/16 §8 #6)
  AUCTION_NOT_OPEN: "This auction is not open for bids.", // PLACEHOLDER COPY (docs/16 §8 #6)
  BID_TOO_LOW: "Your bid is below the minimum.", // PLACEHOLDER COPY (docs/16 §8 #6)
  SELLER_CANNOT_BID: "Sellers cannot bid on their own listing.", // PLACEHOLDER COPY (docs/16 §8 #6)
  REQUEST_ID_CONFLICT: "That request was already used.", // PLACEHOLDER COPY (docs/16 §8 #6)
  REAL_MONEY_DISABLED: "Payments are not available yet.", // PLACEHOLDER COPY (docs/16 §8 #6)
  TOTAL_MISMATCH: "The total has changed. Please review it again.", // PLACEHOLDER COPY (docs/16 §8 #6)
  INVALID_ACCOUNT_TRANSITION: "This account status cannot be changed.", // PLACEHOLDER COPY (docs/16 §8 #6)
  INVALID_REPORT_TRANSITION: "This report was already resolved.", // PLACEHOLDER COPY (docs/16 §8 #6)
  INVALID_LISTING_TRANSITION: "This listing cannot be changed right now.", // PLACEHOLDER COPY (docs/16 §8 #6)
};

const GENERIC_MESSAGE = "Something went wrong. Please try again."; // PLACEHOLDER COPY (docs/16 §8 #6)

/** Extract the stable code before the first colon in a GraphQL error message. */
export function errorCode(message: string | undefined): string | null {
  if (!message) return null;
  const code = message.split(":")[0].trim();
  return /^[A-Z][A-Z0-9_]*$/.test(code) ? code : null;
}

/** Map a raw GraphQL error message to neutral copy; never echo the server text. */
export function messageForError(message: string | undefined): string {
  const code = errorCode(message);
  return (code && ERROR_MESSAGES[code]) || GENERIC_MESSAGE;
}
