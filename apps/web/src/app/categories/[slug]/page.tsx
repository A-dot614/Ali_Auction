import ScaffoldPage from "../../../components/ScaffoldPage";

// Demo category listings live on demo-only routes, excluded from non-demo builds.
export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <ScaffoldPage
      title="Category" // PLACEHOLDER COPY (docs/16 §8 #6)
      description={`Category: ${slug}`} // PLACEHOLDER COPY (docs/16 §8 #6)
      state="empty"
    />
  );
}
