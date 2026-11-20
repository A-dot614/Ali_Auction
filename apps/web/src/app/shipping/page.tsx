import PageShell from "../../components/PageShell";
import NotEnabled from "../../components/NotEnabled";

export const dynamic = "force-dynamic";

export default function ShippingPage() {
  return (
    <PageShell title="Shipping" description="Shipping estimates are not available in this build.">
      <NotEnabled
        message="Not enabled yet"
        detail="Real shipping-rate inputs are unset and the feature flag is OFF. No rate request is made."
      />
    </PageShell>
  );
}
