import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { graphql } from "graphql";
import { schema } from "../src/graphql/schema.js";
import { query } from "../src/db.js";
import { consumeNotifications } from "../src/notifications/consumer.js";
import {
  assignDispute,
  closeDispute,
  dispute as getDispute,
  disputeForStaff,
  disputesQueue,
  openDispute,
  postDisputeMessage,
  resolveDispute,
} from "../src/disputes/service.js";
import {
  gql,
  grantDisputeRole,
  insertDisputeDirect,
  makePaidOrder,
  registerVerifyLogin,
  resetDisputeDb,
} from "./dispute-helpers.js";

/**
 * Slice 12 integration tests. Times sent through GraphQL are runtime-relative;
 * timestamp-sensitive service paths use the injected clock (no fixed calendar dates).
 */

function opts(overrides: Record<string, unknown> = {}) {
  return { clock: () => new Date(), moneyEnabled: true, ...overrides } as any;
}
function viewer(u: { userId: string; roles: string[] }) {
  return { id: u.userId, roles: u.roles };
}
async function countDisputes() {
  return (await query(`SELECT count(*)::int AS c FROM disputes`)).rows[0].c as number;
}
async function auditCount(action: string) {
  return (await query(`SELECT count(*)::int AS c FROM audit_logs WHERE action=$1`, [action])).rows[0].c as number;
}
function openInput(orderId: string, description = "A dispute description.") {
  return { orderId, reasonCode: "damaged", description, requestId: randomUUID() };
}

describe("order disputes (Slice 12)", () => {
  beforeEach(async () => {
    await resetDisputeDb();
  });

  it("buyer and seller can open a dispute on a paid order; non-participant gets NOT_FOUND and writes nothing", async () => {
    const first = await makePaidOrder();
    const buyerDispute = await openDispute(viewer(first.buyer), openInput(first.order.id), opts());
    expect(buyerDispute.created).toBe(true);
    expect(buyerDispute.dispute.status).toBe("open");
    expect(buyerDispute.dispute.description).toBe("A dispute description.");

    const second = await makePaidOrder();
    const sellerDispute = await openDispute(viewer(second.seller), openInput(second.order.id), opts());
    expect(sellerDispute.created).toBe(true);

    const outsider = await registerVerifyLogin("outsider");
    await expect(openDispute(viewer(outsider), openInput(first.order.id), opts())).rejects.toThrow(/NOT_FOUND/);
    expect(await countDisputes()).toBe(2);
  });

  it("dispute on an awaiting_payment order returns INVALID_DISPUTE_STATE and writes nothing", async () => {
    const { buyer, order } = await makePaidOrder(false);
    expect(order.status).toBe("awaiting_payment");
    await expect(openDispute(viewer(buyer), openInput(order.id), opts())).rejects.toThrow(/INVALID_DISPUTE_STATE/);
    expect(await countDisputes()).toBe(0);
    expect(await auditCount("dispute.opened")).toBe(0);
  });

  it("outside the evidence window returns INVALID_DISPUTE_STATE and writes nothing", async () => {
    const { buyer, order } = await makePaidOrder();
    await expect(
      openDispute(viewer(buyer), openInput(order.id), opts({ clock: () => new Date(Date.now() + 31 * 86_400_000) }))
    ).rejects.toThrow(/INVALID_DISPUTE_STATE/);
    expect(await countDisputes()).toBe(0);
    expect(await auditCount("dispute.opened")).toBe(0);
  });

  it("a second open dispute on the same order returns the existing id and writes nothing new", async () => {
    const { buyer, seller, order } = await makePaidOrder();
    const first = await openDispute(viewer(buyer), openInput(order.id), opts());
    const second = await openDispute(viewer(seller), openInput(order.id, "A different description."), opts());
    expect(second.created).toBe(false);
    expect(second.dispute.id).toBe(first.dispute.id);
    expect(await countDisputes()).toBe(1);
    expect(await auditCount("dispute.opened")).toBe(1);
  });

  it("openDispute replayed with the same requestId creates no second row", async () => {
    const { buyer, order } = await makePaidOrder();
    const input = openInput(order.id);
    const first = await openDispute(viewer(buyer), input, opts());
    const replay = await openDispute(viewer(buyer), input, opts());
    expect(replay.created).toBe(false);
    expect(replay.dispute.id).toBe(first.dispute.id);
    expect(await countDisputes()).toBe(1);
    expect(await auditCount("dispute.opened")).toBe(1);
  });

  it("participant messages are visible to both participants; internal_only staff notes are not visible to participants", async () => {
    const { buyer, seller, moderator, order } = await makePaidOrder();
    const opened = await openDispute(viewer(buyer), openInput(order.id), opts());
    const id = opened.dispute.id;
    await postDisputeMessage(id, viewer(buyer), "Buyer message", false, opts());
    await postDisputeMessage(id, viewer(seller), "Seller message", false, opts());
    await postDisputeMessage(id, viewer(moderator), "Internal staff note", true, opts());

    const buyerView = await getDispute(id, viewer(buyer));
    expect(buyerView.messages.map((m) => m.body)).toEqual(["Buyer message", "Seller message"]);
    expect(buyerView.messages.some((m: any) => m.internalOnly !== undefined)).toBe(false);
    expect(buyerView.messages.some((m: any) => m.authorUserId !== undefined)).toBe(false);

    const sellerView = await getDispute(id, viewer(seller));
    expect(sellerView.messages.map((m) => m.body)).toEqual(["Buyer message", "Seller message"]);

    const staffView = (await disputeForStaff(id, viewer(moderator))) as any;
    expect(staffView.messages.map((m: any) => m.body)).toEqual([
      "Buyer message",
      "Seller message",
      "Internal staff note",
    ]);
    expect(staffView.messages.find((m: any) => m.body === "Internal staff note").internalOnly).toBe(true);
  });

  it("support sees only assigned disputes; unassigned dispute returns NOT_FOUND to support", async () => {
    const { buyer, moderator, order } = await makePaidOrder();
    const opened = await openDispute(viewer(buyer), openInput(order.id), opts());
    const support = await registerVerifyLogin("support");
    await grantDisputeRole(support.userId, "support");
    const supportViewer = { id: support.userId, roles: ["buyer", "seller", "support"] };

    await expect(disputeForStaff(opened.dispute.id, supportViewer)).rejects.toThrow(/NOT_FOUND/);
    expect((await disputesQueue(supportViewer, {})).items).toHaveLength(0);

    await assignDispute(opened.dispute.id, support.userId, viewer(moderator), opts());
    const visible = await disputeForStaff(opened.dispute.id, supportViewer);
    expect(visible.id).toBe(opened.dispute.id);
    expect((await disputesQueue(supportViewer, {})).items).toHaveLength(1);
  });

  it("finance sees payment and refund fields only, with no description or messages", async () => {
    const { buyer, order } = await makePaidOrder();
    const opened = await openDispute(viewer(buyer), openInput(order.id), opts());
    const finance = await registerVerifyLogin("finance");
    await grantDisputeRole(finance.userId, "finance");

    const view = await disputeForStaff(opened.dispute.id, { id: finance.userId, roles: ["finance"] });
    expect(view).toMatchObject({
      id: opened.dispute.id,
      orderTotalMinor: String(order.total_minor),
      paymentStatus: "captured",
    });
    expect(view).not.toHaveProperty("description");
    expect(view).not.toHaveProperty("messages");

    const result = await graphql({
      schema,
      source: `query($id:ID!){ disputeForStaff(id:$id){ __typename
        ... on DisputeFinanceType { orderTotalMinor refundedAmountMinor paymentStatus }
        ... on DisputeStaffType { description } } }`,
      variableValues: { id: opened.dispute.id },
      contextValue: {
        user: {
          id: finance.userId,
          roles: ["finance"],
          email: finance.email,
          status: "active",
          email_verified_at: new Date(),
        },
      },
    });
    expect(result.errors).toBeUndefined();
    const staff = (result.data as any).disputeForStaff;
    expect(staff.__typename).toBe("DisputeFinanceType");
    expect(staff.description).toBeUndefined();
  });

  it("resolveDispute with no_action, order_cancelled (awaiting_payment only), and refund outcomes behaves as specified", async () => {
    // no_action
    const first = await makePaidOrder();
    const d1 = await openDispute(viewer(first.buyer), openInput(first.order.id), opts());
    const noAction = await resolveDispute(d1.dispute.id, viewer(first.moderator), "no_action", "No action needed.", {}, opts());
    expect(noAction.status).toBe("resolved");
    expect(noAction.outcome).toBe("no_action");
    expect((await query(`SELECT status FROM orders WHERE id=$1`, [first.order.id])).rows[0].status).toBe("paid");

    // order_cancelled, only from awaiting_payment (D1 forbids opening there, so the fixture inserts directly)
    const second = await makePaidOrder(false);
    const direct = await insertDisputeDirect(second.order.id, second.buyer.userId);
    const cancelled = await resolveDispute(
      direct.id,
      viewer(second.moderator),
      "order_cancelled",
      "Order cancelled after review.",
      {},
      opts()
    );
    expect(cancelled.status).toBe("resolved");
    expect((await query(`SELECT status FROM orders WHERE id=$1`, [second.order.id])).rows[0].status).toBe("cancelled");

    // refund_full through the existing Slice 6 refund path
    const third = await makePaidOrder();
    const d3 = await openDispute(viewer(third.buyer), openInput(third.order.id), opts());
    const refunded = await resolveDispute(d3.dispute.id, viewer(third.moderator), "refund_full", "Full refund approved.", {}, opts());
    expect(refunded.status).toBe("resolved");
    expect(refunded.outcome).toBe("refund_full");
    expect((await query(`SELECT count(*)::int AS c FROM refunds`)).rows[0].c).toBe(1);
    expect(
      (await query(`SELECT status FROM payment_transactions WHERE order_id=$1`, [third.order.id])).rows[0].status
    ).toBe("refunded");
  });

  it("refund outcome with the money flag OFF returns REAL_MONEY_DISABLED and writes nothing", async () => {
    const { buyer, moderator, order } = await makePaidOrder();
    const opened = await openDispute(viewer(buyer), openInput(order.id), opts());
    await expect(
      resolveDispute(opened.dispute.id, viewer(moderator), "refund_full", "Refund", {}, opts({ moneyEnabled: false }))
    ).rejects.toThrow(/REAL_MONEY_DISABLED/);
    expect((await query(`SELECT status FROM disputes WHERE id=$1`, [opened.dispute.id])).rows[0].status).toBe("open");
    expect((await query(`SELECT count(*)::int AS c FROM refunds`)).rows[0].c).toBe(0);
    expect(await auditCount("dispute.resolved")).toBe(0);

    // Non-money outcomes still work with the flag OFF.
    const noAction = await resolveDispute(opened.dispute.id, viewer(moderator), "no_action", "No action", {}, opts({ moneyEnabled: false }));
    expect(noAction.status).toBe("resolved");
  });

  it("second resolution returns INVALID_DISPUTE_TRANSITION and writes nothing", async () => {
    const { buyer, moderator, order } = await makePaidOrder();
    const opened = await openDispute(viewer(buyer), openInput(order.id), opts());
    await resolveDispute(opened.dispute.id, viewer(moderator), "no_action", "First resolution", {}, opts());
    await expect(
      resolveDispute(opened.dispute.id, viewer(moderator), "no_action", "Second resolution", {}, opts())
    ).rejects.toThrow(/INVALID_DISPUTE_TRANSITION/);
    expect(await auditCount("dispute.resolved")).toBe(1);
  });

  it("closeDispute requires a reason and writes one audit row", async () => {
    const { buyer, moderator, order } = await makePaidOrder();
    const opened = await openDispute(viewer(buyer), openInput(order.id), opts());
    await resolveDispute(opened.dispute.id, viewer(moderator), "no_action", "No action", {}, opts());
    await expect(closeDispute(opened.dispute.id, viewer(moderator), "  ", opts())).rejects.toThrow(/VALIDATION_ERROR/);
    const closed = await closeDispute(opened.dispute.id, viewer(moderator), "Case closed.", opts());
    expect(closed.status).toBe("closed");
    expect(await auditCount("dispute.closed")).toBe(1);
  });

  it("every privileged dispute mutation writes exactly one audit row on success (enumerated list)", async () => {
    const { buyer, moderator, order } = await makePaidOrder();
    const opened = await openDispute(viewer(buyer), openInput(order.id), opts());
    expect(await auditCount("dispute.opened")).toBe(1);
    await postDisputeMessage(opened.dispute.id, viewer(buyer), "Message", false, opts());
    expect(await auditCount("dispute.message_posted")).toBe(1);
    await assignDispute(opened.dispute.id, moderator.userId, viewer(moderator), opts());
    expect(await auditCount("dispute.assigned")).toBe(1);
    await resolveDispute(opened.dispute.id, viewer(moderator), "no_action", "No action", {}, opts());
    expect(await auditCount("dispute.resolved")).toBe(1);
    await closeDispute(opened.dispute.id, viewer(moderator), "Closed", opts());
    expect(await auditCount("dispute.closed")).toBe(1);
  });

  it("a dispute notification event is emitted for open, message, and resolve, and the consumer produces the expected notifications", async () => {
    const { buyer, seller, moderator, order } = await makePaidOrder();
    const opened = await openDispute(viewer(buyer), openInput(order.id), opts());
    await postDisputeMessage(opened.dispute.id, viewer(buyer), "Message", false, opts());
    await resolveDispute(opened.dispute.id, viewer(moderator), "no_action", "No action", {}, opts());

    for (const eventType of ["dispute.opened", "dispute.message_posted", "dispute.resolved"]) {
      const row = await query(`SELECT payload FROM outbox_events WHERE event_type=$1`, [eventType]);
      expect(row.rowCount).toBeGreaterThan(0);
      const payload = row.rows[0].payload as Record<string, unknown>;
      expect(payload.disputeId).toBe(opened.dispute.id);
      expect(JSON.stringify(payload)).not.toContain("A dispute description.");
      expect(JSON.stringify(payload)).not.toContain("Message");
    }
    const consumed = await consumeNotifications({ now: () => new Date() });
    expect(consumed.processed).toBeGreaterThan(0);
    const notes = await query(`SELECT user_id, title, category FROM notifications ORDER BY created_at ASC, id ASC`);
    const titles = notes.rows.map((r: any) => r.title);
    expect(titles).toContain("Dispute opened");
    expect(titles).toContain("Dispute message");
    expect(titles.filter((t: string) => t === "Dispute resolved").length).toBe(2);
    const sellerNotes = notes.rows.filter((r: any) => r.user_id === seller.userId);
    expect(sellerNotes.length).toBeGreaterThan(0);
  });

  it("participant-facing types contain no internal_only messages, staff IDs, or provider IDs (schema test and runtime check)", async () => {
    const disputeFields = await graphql({ schema, source: `{ __type(name:"Dispute"){ fields { name } } }` });
    const names: string[] = (disputeFields.data as any).__type.fields.map((f: any) => f.name);
    expect(names.some((n) => /internal|staffUserId|assignedTo|resolvedBy|openedBy|provider/i.test(n))).toBe(false);

    const messageFields = await graphql({ schema, source: `{ __type(name:"DisputeMessage"){ fields { name } } }` });
    const messageNames: string[] = (messageFields.data as any).__type.fields.map((f: any) => f.name);
    expect(messageNames).not.toContain("internalOnly");
    expect(messageNames).not.toContain("authorUserId");

    const { buyer, moderator, order } = await makePaidOrder();
    const opened = await openDispute(viewer(buyer), openInput(order.id), opts());
    await postDisputeMessage(opened.dispute.id, viewer(moderator), "Internal note", true, opts());
    const res = await gql({
      query: `query($id:ID!){ dispute(id:$id){ id description messages { authorRole body createdAt } } }`,
      variables: { id: opened.dispute.id },
      cookie: buyer.cookie,
    });
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.dispute.messages).toHaveLength(0);
    expect(JSON.stringify(res.body.data.dispute)).not.toContain("Internal note");
  });
});
