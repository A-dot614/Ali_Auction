import type { Metadata } from "next";
import PageShell from "../../../../components/PageShell";
import ScreenState from "../../../../components/ScreenState";
import SellerListingForm from "../../../../components/SellerListingForm";
import { gql } from "../../../../lib/graphql";

export const metadata: Metadata = {
  title: "New listing draft — AliAuction.ca",
  description: "Create a listing draft for staff review.",
};
export const dynamic = "force-dynamic";

const CATEGORIES = `query { categories { id name slug isPlaceholder } }`;

export default async function NewListingPage() {
  const result = await gql(CATEGORIES);
  const categories = (result.data?.categories ?? []).map((category: any) => ({
    id: String(category.id),
    name: String(category.name),
    slug: String(category.slug),
    isPlaceholder: Boolean(category.isPlaceholder),
  }));

  return (
    <PageShell title="New listing draft" description="Drafts stay private until staff review.">
      {categories.length === 0 ? <ScreenState state="empty" /> : null}
      <SellerListingForm categories={categories} />
    </PageShell>
  );
}
