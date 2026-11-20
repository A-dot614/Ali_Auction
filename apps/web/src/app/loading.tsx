import PageShell from "../components/PageShell";
import ScreenState from "../components/ScreenState";
import Skeleton from "../components/ui/Skeleton";

export default function Loading() {
  return (
    <PageShell title="Loading" description="Preparing this page.">
      <ScreenState state="loading" />
      <Skeleton lines={5} />
    </PageShell>
  );
}
