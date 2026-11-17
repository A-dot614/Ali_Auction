/**
 * Data-driven screen states (D2, docs/08 §7). Error copy is mapped from stable
 * API codes; raw server messages are never rendered.
 * PLACEHOLDER COPY (docs/16 §8 #6) on every string below.
 */

export type ScreenStateName = "loading" | "empty" | "error" | "permission-denied" | "stale" | "offline";

export const SCREEN_STATE_COPY: Record<ScreenStateName, string> = {
  loading: "Loading…", // PLACEHOLDER COPY (docs/16 §8 #6)
  empty: "Nothing here yet.", // PLACEHOLDER COPY (docs/16 §8 #6)
  error: "Something went wrong. Please try again.", // PLACEHOLDER COPY (docs/16 §8 #6)
  "permission-denied": "You do not have permission to view this page.", // PLACEHOLDER COPY (docs/16 §8 #6)
  stale: "This information may be out of date. Refreshing…", // PLACEHOLDER COPY (docs/16 §8 #6)
  offline: "You are offline. Showing the last available information.", // PLACEHOLDER COPY (docs/16 §8 #6)
};

export function stateCopy(state: ScreenStateName): string {
  return SCREEN_STATE_COPY[state];
}

export function isPermissionDenied(errorCode: string | null): boolean {
  return errorCode === "FORBIDDEN" || errorCode === "UNAUTHENTICATED";
}
