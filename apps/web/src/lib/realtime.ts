import { webConfig } from "./config";

/**
 * Real-time flag fallback (D4). Socket.io/gateway delivery is a later slice
 * (docs/03 §5). When the flag is ON there is still no gateway, so we log a TODO
 * and fall back to the same refetch path used when the flag is OFF.
 */

export type Refetch = () => Promise<void> | void;

export function realtimeEnabled(config: Pick<typeof webConfig, "realtimeEnabled"> = webConfig): boolean {
  return config.realtimeEnabled === true;
}

export async function subscribeOrFallback(
  refetch: Refetch,
  config: Pick<typeof webConfig, "realtimeEnabled"> = webConfig,
  logger: (message: string) => void = () => undefined
): Promise<"refetch"> {
  if (realtimeEnabled(config)) {
    // TODO(later slice, docs/03 §5): subscribe to authorized auction rooms once a gateway exists.
    logger("TODO: real-time subscription unavailable; using refetch fallback.");
  }
  await refetch();
  return "refetch";
}
