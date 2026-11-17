import PageShell from "./PageShell";
import ScreenState from "./ScreenState";
import type { ScreenStateName } from "../lib/states";

/**
 * Scaffold-level data-driven screen (D1/D2). All five states are provided by
 * ScreenState; the page selects one from its fetch result. Scaffold routes start
 * in the given placeholder state until their data wiring is completed.
 * PLACEHOLDER COPY (docs/16 §8 #6).
 */
export default function ScaffoldPage({
  title,
  description,
  state = "empty",
}: {
  title: string;
  description?: string;
  state?: ScreenStateName;
}) {
  return (
    <PageShell title={title} description={description}>
      <section className="card" aria-labelledby="screen-status-heading">
        <h2 id="screen-status-heading">Screen status</h2> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        <ScreenState state={state} />
      </section>
    </PageShell>
  );
}
