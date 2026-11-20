import PageShell from "../../../components/PageShell";
import ScreenState from "../../../components/ScreenState";
import Skeleton from "../../../components/ui/Skeleton";

export default function ReviewLoading() {
  return (
    <PageShell title="Listing review queue" description="Loading pending reviews.">
      <ScreenState state="loading" />
      <Skeleton lines={5} />
    </PageShell>
  );
}
