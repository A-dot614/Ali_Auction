import ScaffoldPage from "../../../components/ScaffoldPage";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    const { default: DemoCategoryListings } = await import("../../../components/DemoCategoryListings");
    return <DemoCategoryListings slug={slug} />;
  }
  return (
    <ScaffoldPage
      title="Category" // PLACEHOLDER COPY (docs/16 §8 #6)
      description={`Category: ${slug}`} // PLACEHOLDER COPY (docs/16 §8 #6)
      state="empty"
    />
  );
}
