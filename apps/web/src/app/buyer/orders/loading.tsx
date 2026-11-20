import PageShell from "../../../components/PageShell";
import ScreenState from "../../../components/ScreenState";
import Skeleton from "../../../components/ui/Skeleton";

export default function OrdersLoading() {
  return (
    <PageShell title="My orders" description="Loading your orders.">
      <ScreenState state="loading" />
      <Skeleton lines={4} />
    </PageShell>
  );
}
