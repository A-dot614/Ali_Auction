import PageShell from "../../components/PageShell";
import ScreenState from "../../components/ScreenState";
import Skeleton from "../../components/ui/Skeleton";

export default function SearchLoading() {
  return (
    <PageShell title="Search" description="Preparing search results.">
      <ScreenState state="loading" />
      <Skeleton lines={6} />
    </PageShell>
  );
}
