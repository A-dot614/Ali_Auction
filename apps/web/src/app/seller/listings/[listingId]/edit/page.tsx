import type { Metadata } from "next";
import PageShell from "../../../../../components/PageShell";
import ScreenState from "../../../../../components/ScreenState";
import SellerListingForm from "../../../../../components/SellerListingForm";
import { gql } from "../../../../../lib/graphql";

export const metadata: Metadata = {
  title: "Edit listing draft — AliAuction.ca",
  description: "Edit a listing draft that is still open for changes.",
};
export const dynamic = "force-dynamic";

const QUERY = `query {
  categories { id name slug isPlaceholder }
  myListings(first: 100) {
    items { id title description categoryId condition fulfilmentOption startingPriceMinor status }
  }
}`;

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  const result = await gql(QUERY);
  const categories = (result.data?.categories ?? []).map((category: any) => ({
    id: String(category.id),
    name: String(category.name),
    slug: String(category.slug),
    isPlaceholder: Boolean(category.isPlaceholder),
  }));
  const items: any[] = result.data?.myListings?.items ?? [];
  const found = items.find((item) => String(item.id) === listingId);

  return (
    <PageShell title={`Edit listing ${listingId}`} description="Only draft and rejected listings can be edited.">
      {categories.length === 0 ? <ScreenState state="empty" /> : null}
      <SellerListingForm
        categories={categories}
        initial={
          found
            ? {
                id: String(found.id),
                title: String(found.title),
                description: String(found.description),
                categoryId: String(found.categoryId),
                condition: String(found.condition),
                fulfilmentOption: String(found.fulfilmentOption),
                startingPriceMinor: String(found.startingPriceMinor),
                status: String(found.status),
              }
            : undefined
        }
      />
      {!found ? <ScreenState state="empty" /> : null}
    </PageShell>
  );
}
