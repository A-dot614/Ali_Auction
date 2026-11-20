import PageShell from "../../../components/PageShell";
import ScreenState from "../../../components/ScreenState";
import Skeleton from "../../../components/ui/Skeleton";

export default function ListingLoading() {
  return (
    <PageShell title="Listing" description="Loading listing details.">
      <ScreenState state="loading" />
      <Skeleton lines={6} />
    </PageShell>
  );
}
