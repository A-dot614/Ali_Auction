/**
 * Server-authoritative countdown (D3, rule 4). The client never decides auction
 * state or bid validity: it only formats time remaining from a server-provided
 * instant. The single clock read is the offset calculation below; the pure
 * helpers accept all timestamps as arguments.
 */

/** Offset of the server clock relative to the client clock, in milliseconds. */
export function serverOffsetMs(serverTimeIso: string, clientNowMs: number): number {
  return Date.parse(serverTimeIso) - clientNowMs;
}

/** Pure: remaining time = endsAt - (clientNow + serverOffset), clamped at zero. */
export function remainingMs(endsAtMs: number, clientNowMs: number, offsetMs: number): number {
  const adjustedNow = clientNowMs + offsetMs;
  return Math.max(0, endsAtMs - adjustedNow);
}

/** The only clock read in countdown logic: derive the offset from serverTime. */
export function remainingFromServer(endsAtMs: number, serverTimeIso: string): number {
  const clientNowMs = Date.now();
  return remainingMs(endsAtMs, clientNowMs, serverOffsetMs(serverTimeIso, clientNowMs));
}

/** PLACEHOLDER COPY (docs/16 §8 #6): neutral countdown text. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Auction ended"; // PLACEHOLDER COPY (docs/16 §8 #6)
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h remaining`; // PLACEHOLDER COPY (docs/16 §8 #6)
  if (hours > 0) return `${hours}h ${minutes}m remaining`; // PLACEHOLDER COPY (docs/16 §8 #6)
  return `${minutes}m ${seconds}s remaining`; // PLACEHOLDER COPY (docs/16 §8 #6)
}
