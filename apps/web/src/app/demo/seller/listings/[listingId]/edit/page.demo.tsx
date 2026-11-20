import PageShell from "../../../../../../components/PageShell";
import DemoSellerForm from "../../../../../../components/DemoSellerForm";
import { findDemoSellerListing } from "../../../../../../lib/demo-seller";

export const dynamic = "force-dynamic";

export default async function DemoEditListingPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  const found = findDemoSellerListing(listingId);
  return (
    <PageShell title={`Edit demo listing ${listingId}`} description="Demo form only: no edit is stored and no request is sent.">
      <DemoSellerForm
        initial={
          found
            ? {
                title: found.title,
                description: found.description,
                categoryId: found.categoryId,
                condition: found.condition,
                fulfilmentOption: found.fulfilmentOption,
                startingPriceMinor: found.startingPriceMinor,
              }
            : undefined
        }
      />
    </PageShell>
  );
}
