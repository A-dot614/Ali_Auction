import type { Metadata } from "next";
import Link from "next/link";
import PageShell from "../../../components/PageShell";
import ScreenState from "../../../components/ScreenState";
import MarkNotificationReadButton from "../../../components/MarkNotificationReadButton";
import { gql } from "../../../lib/graphql";
import { stateForFailure } from "../../../lib/error-state";

export const metadata: Metadata = {
  title: "Notifications — AliAuction.ca",
  description: "Updates addressed to your account.",
};
export const dynamic = "force-dynamic";

const QUERY = `query {
  unreadCount
  myNotifications(first: 50) {
    items { id category title body createdAt readAt link }
  }
}`;

export default async function NotificationsPage() {
  const result = await gql(QUERY);
  if (result.errors?.length) {
    const failure = stateForFailure(result.errors[0].message);
    return (
      <PageShell title="Notifications" description="Updates addressed to your account.">
        <ScreenState state={failure.state === "not-enabled" ? "empty" : failure.state} />
      </PageShell>
    );
  }

  const items: any[] = result.data?.myNotifications?.items ?? [];
  const unread = Number(result.data?.unreadCount ?? 0);
  return (
    <PageShell title="Notifications" description="Updates addressed to your account.">
      <section className="card ui-card">
        <h2>Inbox</h2>
        <p role="status">{unread} unread</p>
        {items.length === 0 ? (
          <ScreenState state="empty" />
        ) : (
          <ul className="notification-list">
            {items.map((item) => {
              // API links are relative paths resolved for the recipient (D5).
              const link = typeof item.link === "string" && item.link.startsWith("/") && !item.link.startsWith("//")
                ? item.link
                : null;
              return (
                <li key={String(item.id)} className="card ui-card">
                  <h3>{String(item.title)}</h3>
                  <p className="muted">{String(item.category)} · {String(item.createdAt)}</p>
                  <p>{String(item.body)}</p>
                  <p>
                    {link ? <Link href={link}>Open related item</Link> : null}
                    {" "}
                    {item.readAt ? null : <MarkNotificationReadButton id={String(item.id)} />}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
