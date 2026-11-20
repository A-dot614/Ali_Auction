import type { Metadata } from "next";
import Link from "next/link";
import PageShell from "../../../components/PageShell";
import ScreenState from "../../../components/ScreenState";
import Table from "../../../components/ui/Table";
import { gql } from "../../../lib/graphql";
import { stateForFailure } from "../../../lib/error-state";
import { formatMinorUnits } from "../../../lib/money";

export const metadata: Metadata = {
  title: "My orders — AliAuction.ca",
  description: "Orders you have placed, with participant-only details.",
};
export const dynamic = "force-dynamic";

const QUERY = `query {
  myOrders(first: 100) {
    items { id status currency hammerPriceMinor feeTotalMinor totalMinor createdAt }
  }
}`;

export default async function BuyerOrdersPage() {
  const result = await gql(QUERY);
  if (result.errors?.length) {
    const failure = stateForFailure(result.errors[0].message);
    return (
      <PageShell title="My orders" description="Orders you have placed, with participant-only details.">
        <ScreenState state={failure.state === "not-enabled" ? "empty" : failure.state} />
      </PageShell>
    );
  }

  const items: any[] = result.data?.myOrders?.items ?? [];
  return (
    <PageShell title="My orders" description="Orders you have placed, with participant-only details.">
      <section className="card ui-card">
        <h2>Order history</h2>
        {items.length === 0 ? (
          <ScreenState state="empty" />
        ) : (
          <Table
            headings={["Order", "Status", "Total", "Placed"]}
            rows={items.map((item) => [
              <Link key={`order-${item.id}`} href={`/buyer/orders/${encodeURIComponent(String(item.id))}`}>
                {String(item.id)}
              </Link>,
              String(item.status),
              formatMinorUnits(item.totalMinor, item.currency),
              String(item.createdAt),
            ])}
          />
        )}
      </section>
    </PageShell>
  );
}
