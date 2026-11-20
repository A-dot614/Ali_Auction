import PageShell from "../../../components/PageShell";
import ScreenState from "../../../components/ScreenState";
import Skeleton from "../../../components/ui/Skeleton";

export default function SellerLoading() {
  return (
    <PageShell title="Seller dashboard" description="Loading your seller workspace.">
      <ScreenState state="loading" />
      <Skeleton lines={4} />
    </PageShell>
  );
}
