import type { Metadata } from "next";
import ScaffoldPage from "../../../components/ScaffoldPage";

export const metadata: Metadata = {
  title: "Seller orders — AliAuction.ca",
  description: "Orders for your listings.",
};

export const dynamic = "force-dynamic";

export default function SellerOrdersPage() {
  return <ScaffoldPage title="Seller orders" description="Orders for your listings." state="empty" />;
}
