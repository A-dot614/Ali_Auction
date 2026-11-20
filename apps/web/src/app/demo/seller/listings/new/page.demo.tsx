import PageShell from "../../../../../components/PageShell";
import DemoSellerForm from "../../../../../components/DemoSellerForm";

export const dynamic = "force-dynamic";

export default function DemoNewListingPage() {
  return (
    <PageShell title="New demo listing draft" description="Demo form only: no draft is stored and no request is sent.">
      <DemoSellerForm />
    </PageShell>
  );
}
