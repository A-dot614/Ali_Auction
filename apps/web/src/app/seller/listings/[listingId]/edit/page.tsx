import ScaffoldPage from "../../../../../components/ScaffoldPage";

export const dynamic = "force-dynamic";

export default async function EditListingPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  return <ScaffoldPage title="Edit listing" description={`Listing ${listingId}`} state="empty" />;
}
