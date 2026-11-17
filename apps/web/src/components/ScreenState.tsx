import { stateCopy, type ScreenStateName } from "../lib/states";

/** Accessible status text for loading/empty/error/permission-denied/stale/offline states (D2). */
export default function ScreenState({ state }: { state: ScreenStateName }) {
  return (
    <p className="card" role="status">
      {stateCopy(state)}
    </p>
  );
}
