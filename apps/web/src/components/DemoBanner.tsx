import { DEMO_BANNER_TEXT, demoMode } from "../lib/demo";

/** Visible on every screen while the build-time demo setting is on. */
export default function DemoBanner({ force }: { force?: boolean } = {}) {
  if (!(force ?? demoMode)) return null;
  return (
    <p className="demo-banner" role="note" data-demo-banner="true">
      {DEMO_BANNER_TEXT}
    </p>
  );
}
