import { DEMO_BANNER_TEXT } from "../lib/demo-copy";

/** Demo-only notice. Rendered by the shell only when the demo build is active. */
export default function DemoBanner() {
  return (
    <p className="demo-banner" role="note" data-demo-banner="true">
      {DEMO_BANNER_TEXT}
    </p>
  );
}
