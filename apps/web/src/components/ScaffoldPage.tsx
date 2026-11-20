import PageShell from "./PageShell";
import ScreenState from "./ScreenState";
import Card from "./ui/Card";
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
      <Card title="Screen status"> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        <ScreenState state={state} />
      </Card>
    </PageShell>
  );
}
