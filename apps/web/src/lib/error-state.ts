import { errorCode, messageForError } from "./errors";
import { isNotEnabled, isPermissionDenied, type ScreenStateName } from "./states";

/**
 * Maps a failed request to a neutral, testable screen state. Server text is
 * never rendered: only a message looked up from the stable code. A transport
 * failure is labelled NETWORK_ERROR by the caller.
 */
export type FailureState = { state: ScreenStateName | "not-enabled"; detail: string };

export function stateForFailure(failure: string | undefined): FailureState {
  const code = errorCode(failure) ?? failure ?? "NETWORK_ERROR";
  const detail = messageForError(failure);
  if (isNotEnabled(code)) return { state: "not-enabled", detail };
  if (isPermissionDenied(code)) return { state: "permission-denied", detail };
  return { state: "error", detail };
}
