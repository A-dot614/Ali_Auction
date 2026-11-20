import PageShell from "../../components/PageShell";
import NotEnabled from "../../components/NotEnabled";

export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return (
    <PageShell title="Checkout" description="Checkout is not available in this Phase 1 build.">
      <NotEnabled
        message="Payments not enabled"
        detail="Real-money payments stay OFF. No payment endpoint is called from this screen."
      />
    </PageShell>
  );
}
