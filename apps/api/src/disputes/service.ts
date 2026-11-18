import type pg from "pg";
import { query, withTransaction } from "../db.js";
import { recordAudit } from "../audit.js";
import { config } from "../config.js";
import { transitionOrder, type OrderRow } from "../orders/service.js";
import { refundPayment, type PaymentServiceOptions } from "../payments/service.js";
import { assertCanPerform, canAccessAssigned, isFinance } from "./permissions.js";
import { assertTransition, type DisputeStatus } from "./disputeStateMachine.js";

/**
 * Order disputes (Slice 12). FR-072 (open a dispute tied to an order) and FR-073
 * (staff review/resolution with audit). All state changes go through disputeStateMachine;
 * resolvers never write status. Every successful state change writes exactly one audit row.
 *
 * Reason codes, evidence window and resolution outcomes are NOT FOR PRODUCTION placeholders.
 * TODO(docs/16 §8 #4): approved dispute policy and evidence window.
 * TODO(docs/16 §5 #8): provider-level chargebacks/refunds remain OPEN (FR-044).
 * TODO(docs/13, docs/16 §8 #4): evidence attachments need object storage; none added here.
 */

// D2: placeholder reason codes, NOT FOR PRODUCTION. TODO(docs/16 §8 #4).
export const DISPUTE_REASON_CODES = [
  "item_not_as_described",
  "item_not_received",
  "damaged",
  "other",
] as const;
export type DisputeReasonCode = (typeof DISPUTE_REASON_CODES)[number];

// D8: placeholder outcomes, NOT FOR PRODUCTION. TODO(docs/16 §8 #4, §5 #8).
export const DISPUTE_OUTCOMES = ["no_action", "refund_full", "refund_partial", "order_cancelled"] as const;
export type DisputeOutcome = (typeof DISPUTE_OUTCOMES)[number];

export type DisputeMessageRole = "buyer" | "seller" | "staff";

export type ServiceOptions = {
  clock?: () => Date;
  moneyEnabled?: boolean;
  maxDescriptionLength?: number;
  evidenceWindowDays?: number;
};

export type Actor = { id: string; roles: string[] };

export type DisputeRow = {
  id: string;
  orderId: string;
  openedByUserId: string;
  reasonCode: DisputeReasonCode;
  description: string;
  status: DisputeStatus;
  assignedToUserId: string | null;
  outcome: DisputeOutcome | null;
  resolutionReason: string | null;
  resolvedByUserId: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DisputeMessageView = { id: string; authorRole: DisputeMessageRole; body: string; createdAt: Date };
export type DisputeStaffMessageView = DisputeMessageView & { authorUserId: string; internalOnly: boolean };

export type DisputeView = DisputeRow & { messages: DisputeMessageView[] };
export type DisputeStaffView = DisputeRow & {
  messages: DisputeStaffMessageView[];
  financial: DisputeFinanceView;
};
export type DisputeFinanceView = {
  id: string;
  orderId: string;
  status: DisputeStatus;
  orderTotalMinor: string;
  refundedAmountMinor: string;
  paymentStatus: string;
};
export type DisputePage<T> = { items: T[]; endCursor: string | null };

function clockFor(opts?: ServiceOptions): () => Date {
  return opts?.clock ?? (() => new Date());
}

function validateReasonCode(code: string): DisputeReasonCode {
  if (!DISPUTE_REASON_CODES.includes(code as DisputeReasonCode)) {
    throw new Error("VALIDATION_ERROR: Invalid dispute reason code.");
  }
  return code as DisputeReasonCode;
}

function validateOutcome(outcome: string): DisputeOutcome {
  if (!DISPUTE_OUTCOMES.includes(outcome as DisputeOutcome)) {
    throw new Error("VALIDATION_ERROR: Invalid dispute outcome.");
  }
  return outcome as DisputeOutcome;
}

function validateDescription(description: string | null | undefined, opts?: ServiceOptions): string {
  const trimmed = (description || "").trim();
  if (!trimmed) throw new Error("VALIDATION_ERROR: Description is required.");
  const max = opts?.maxDescriptionLength ?? config.disputes.maxDescriptionLength;
  if (trimmed.length > max) throw new Error("VALIDATION_ERROR: Description is too long.");
  return trimmed;
}

function requireReason(reason: string | null | undefined): string {
  const trimmed = (reason || "").trim();
  if (!trimmed) throw new Error("VALIDATION_ERROR: Reason is required and must not be empty.");
  return trimmed;
}

function mapDispute(row: any): DisputeRow {
  return {
    id: row.id,
    orderId: row.order_id,
    openedByUserId: row.opened_by_user_id,
    reasonCode: row.reason_code,
    description: row.description,
    status: row.status,
    assignedToUserId: row.assigned_to_user_id,
    outcome: row.outcome,
    resolutionReason: row.resolution_reason,
    resolvedByUserId: row.resolved_by_user_id,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function participantsFor(client: pg.PoolClient, orderId: string): Promise<{ order: OrderRow; buyerUserId: string; sellerUserId: string | null }> {
  const res = await client.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  if ((res.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: Order not found.");
  const order = res.rows[0] as OrderRow;
  const sp = await client.query(`SELECT user_id FROM seller_profiles WHERE id = $1`, [order.seller_profile_id]);
  return { order, buyerUserId: order.buyer_user_id, sellerUserId: (sp.rows[0]?.user_id as string) ?? null };
}

function assertParticipant(actor: Actor, buyerUserId: string, sellerUserId: string | null): "buyer" | "seller" {
  if (actor.id === buyerUserId) return "buyer";
  if (sellerUserId && actor.id === sellerUserId) return "seller";
  // D1/D5: non-participants get NOT_FOUND (no existence leak).
  throw new Error("NOT_FOUND: Dispute not found.");
}

async function messagesFor(
  client: pg.PoolClient,
  disputeId: string,
  includeInternal: boolean
): Promise<DisputeMessageView[] | DisputeStaffMessageView[]> {
  const res = await client.query(
    `SELECT id, author_user_id, author_role, internal_only, body, created_at
     FROM dispute_messages WHERE dispute_id = $1 ${includeInternal ? "" : "AND internal_only = false"}
     ORDER BY created_at ASC, id ASC`,
    [disputeId]
  );
  return res.rows.map((r: any) => ({
    id: r.id,
    authorRole: r.author_role,
    body: r.body,
    createdAt: r.created_at,
    ...(includeInternal ? { authorUserId: r.author_user_id, internalOnly: r.internal_only } : {}),
  })) as DisputeMessageView[] | DisputeStaffMessageView[];
}

async function financialFor(client: pg.PoolClient, orderId: string): Promise<DisputeFinanceView> {
  const order = await client.query(`SELECT total_minor FROM orders WHERE id = $1`, [orderId]);
  const payment = await client.query(
    `SELECT status, refunded_amount_minor FROM payment_transactions WHERE order_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
    [orderId]
  );
  return {
    id: "", // filled by caller
    orderId,
    status: "open", // filled by caller
    orderTotalMinor: String(order.rows[0]?.total_minor ?? "0"),
    refundedAmountMinor: String(payment.rows[0]?.refunded_amount_minor ?? "0"),
    paymentStatus: String(payment.rows[0]?.status ?? "none"),
  };
}

async function emit(client: pg.PoolClient, eventType: string, payload: Record<string, unknown>, at: Date): Promise<void> {
  await client.query(
    `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, created_at)
     VALUES ('dispute', $1, $2, $3::jsonb, $4)`,
    [String(payload.disputeId), eventType, JSON.stringify(payload), at]
  );
}

function parseCursor(cursor: string | null | undefined): { createdAt: string; id: string } | null {
  if (!cursor) return null;
  const sep = cursor.lastIndexOf("|");
  const createdAt = sep > 0 ? cursor.slice(0, sep) : "";
  const id = sep > 0 ? cursor.slice(sep + 1) : "";
  if (!createdAt || !id || Number.isNaN(new Date(createdAt).getTime())) {
    throw new Error("VALIDATION_ERROR: Invalid dispute cursor.");
  }
  return { createdAt, id };
}

function encodeCursor(d: DisputeRow): string {
  return `${d.createdAt.toISOString()}|${d.id}`;
}

const DISPUTE_OPEN_STATUSES: OrderRow["status"][] = ["paid", "processing", "shipped", "ready_for_pickup", "completed"];

/**
 * D1/D2/D3: open a dispute. Only an order participant, in an eligible order state, within
 * the placeholder evidence window. Idempotent on requestId; one open dispute per order.
 */
export async function openDispute(
  actor: Actor,
  input: { orderId: string; reasonCode: string; description: string; requestId: string },
  opts?: ServiceOptions
): Promise<{ dispute: DisputeView; created: boolean }> {
  assertCanPerform(actor, "openDispute");
  const reasonCode = validateReasonCode(input.reasonCode);
  const description = validateDescription(input.description, opts);
  if (!input.requestId) throw new Error("VALIDATION_ERROR: requestId is required.");
  const at = clockFor(opts)();

  return withTransaction(async (client) => {
    // Idempotency replay returns the original dispute and writes nothing (same pattern as placeBid).
    const prior = await client.query(
      `SELECT dispute_id FROM dispute_requests WHERE requester_user_id = $1 AND request_id = $2`,
      [actor.id, input.requestId]
    );
    if ((prior.rowCount ?? 0) > 0) {
      const row = await client.query(`SELECT * FROM disputes WHERE id = $1`, [prior.rows[0].dispute_id]);
      if ((row.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: Original dispute no longer exists.");
      const original = mapDispute(row.rows[0]);
      if (original.orderId !== input.orderId) throw new Error("REQUEST_ID_CONFLICT: requestId was used for another order.");
      return {
        dispute: {
          ...original,
          messages: (await messagesFor(client, original.id, false)) as DisputeMessageView[],
        },
        created: false,
      };
    }

    const { order, buyerUserId, sellerUserId } = await participantsFor(client, input.orderId);
    const role = assertParticipant(actor, buyerUserId, sellerUserId);
    if (!DISPUTE_OPEN_STATUSES.includes(order.status)) {
      throw new Error("INVALID_DISPUTE_STATE: Disputes require a paid or fulfilled order.");
    }
    // D3: evidence window measured from paid_at (order_events paid transition) or created_at.
    const paid = await client.query(
      `SELECT min(created_at) AS paid_at FROM order_events WHERE order_id = $1 AND to_status = 'paid'`,
      [input.orderId]
    );
    const base = paid.rows[0]?.paid_at ?? order.created_at;
    const days = opts?.evidenceWindowDays ?? config.disputes.evidenceWindowDays;
    const deadline = new Date(new Date(base).getTime() + days * 86_400_000);
    if (at.getTime() > deadline.getTime()) {
      throw new Error("INVALID_DISPUTE_STATE: Dispute evidence window has closed.");
    }

    // One open dispute per order: partial unique index plus this check; no second row is written.
    const openRes = await client.query(`SELECT * FROM disputes WHERE order_id = $1 AND status = 'open'`, [input.orderId]);
    if ((openRes.rowCount ?? 0) > 0) {
      const existing = mapDispute(openRes.rows[0]);
      return {
        dispute: { ...existing, messages: (await messagesFor(client, existing.id, false)) as DisputeMessageView[] },
        created: false,
      };
    }

    const inserted = await client.query(
      `INSERT INTO disputes (order_id, opened_by_user_id, reason_code, description, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'open',$5,$5) RETURNING *`,
      [input.orderId, actor.id, reasonCode, description, at]
    );
    const dispute = mapDispute(inserted.rows[0]);

    await client.query(
      `INSERT INTO dispute_requests (requester_user_id, request_id, dispute_id, created_at)
       VALUES ($1,$2,$3,$4) ON CONFLICT (requester_user_id, request_id) DO NOTHING`,
      [actor.id, input.requestId, dispute.id, at]
    );
    await recordAudit(
      {
        actorUserId: actor.id,
        action: "dispute.opened",
        targetType: "dispute",
        targetId: dispute.id,
        metadata: { orderId: input.orderId, reasonCode, actorRole: role },
        createdAt: at,
      },
      client
    );
    // D10: notify the other participant only; no description or message body in the payload.
    await emit(
      client,
      "dispute.opened",
      {
        disputeId: dispute.id,
        orderId: input.orderId,
        userId: role === "buyer" ? sellerUserId : buyerUserId,
        actorRole: role,
      },
      at
    );
    return { dispute: { ...dispute, messages: [] }, created: true };
  });
}

/** D4: post a message; internal-only staff notes are never returned to participants. */
export async function postDisputeMessage(
  disputeId: string,
  actor: Actor,
  body: string,
  internalOnly: boolean,
  opts?: ServiceOptions
): Promise<DisputeStaffMessageView | DisputeMessageView> {
  assertCanPerform(actor, "postDisputeMessage");
  const text = requireReason(body);
  const at = clockFor(opts)();

  return withTransaction(async (client) => {
    const res = await client.query(`SELECT * FROM disputes WHERE id = $1 FOR UPDATE`, [disputeId]);
    if ((res.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: Dispute not found.");
    const dispute = mapDispute(res.rows[0]);
    const { buyerUserId, sellerUserId } = await participantsFor(client, dispute.orderId);
    const isBuyer = actor.id === buyerUserId;
    const isSeller = sellerUserId != null && actor.id === sellerUserId;
    const staff = actor.roles.some((r) => r === "support" || r === "moderator" || r === "admin" || r === "finance");
    if (!isBuyer && !isSeller && !staff) throw new Error("NOT_FOUND: Dispute not found.");
    const authorRole: DisputeMessageRole = isBuyer ? "buyer" : isSeller ? "seller" : "staff";
    if (authorRole === "staff") {
      if (isFinance(actor) || !canAccessAssigned(actor, dispute.assignedToUserId)) {
        throw new Error("FORBIDDEN: Insufficient permissions for this dispute.");
      }
    } else {
      // Participants may post only while the dispute is open; they cannot write internal notes.
      if (dispute.status !== "open") throw new Error("INVALID_DISPUTE_STATE: Dispute is not open.");
      if (internalOnly) throw new Error("FORBIDDEN: Internal notes are staff-only.");
    }

    const inserted = await client.query(
      `INSERT INTO dispute_messages (dispute_id, author_user_id, author_role, internal_only, body, created_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [disputeId, actor.id, authorRole, internalOnly, text, at]
    );
    await recordAudit(
      {
        actorUserId: actor.id,
        action: "dispute.message_posted",
        targetType: "dispute",
        targetId: disputeId,
        metadata: { authorRole, internalOnly },
        createdAt: at,
      },
      client
    );
    // D10: no message body in the event payload. A staff message notifies both participants.
    const recipients = authorRole === "staff" ? [buyerUserId, sellerUserId] : [isBuyer ? sellerUserId : buyerUserId];
    for (const userId of recipients) {
      if (userId) await emit(client, "dispute.message_posted", { disputeId, orderId: dispute.orderId, userId }, at);
    }
    const row = inserted.rows[0];
    const view: DisputeStaffMessageView = {
      id: row.id,
      authorRole: row.author_role,
      body: row.body,
      createdAt: row.created_at,
      authorUserId: row.author_user_id,
      internalOnly: row.internal_only,
    };
    return internalOnly ? view : { id: view.id, authorRole: view.authorRole, body: view.body, createdAt: view.createdAt };
  });
}

/** D5: participant list, scoped by order buyer/seller. */
export async function myDisputes(
  actor: Actor,
  opts: { first?: number | null; after?: string | null } = {}
): Promise<DisputePage<DisputeView>> {
  assertCanPerform(actor, "myDisputes");
  const limit = Math.min(Math.max(opts.first ?? 20, 1), 100);
  const cursor = parseCursor(opts.after);
  const params: any[] = [actor.id];
  let clause = `WHERE (o.buyer_user_id = $1 OR sp.user_id = $1)`;
  if (cursor) {
    params.push(cursor.createdAt, cursor.id);
    clause += ` AND (d.created_at < $${params.length - 1}::timestamptz
      OR (d.created_at = $${params.length - 1}::timestamptz AND d.id < $${params.length}::uuid))`;
  }
  params.push(limit + 1);
  const res = await query(
    `SELECT d.* FROM disputes d
     JOIN orders o ON o.id = d.order_id
     LEFT JOIN seller_profiles sp ON sp.id = o.seller_profile_id
     ${clause} ORDER BY d.created_at DESC, d.id DESC LIMIT $${params.length}`,
    params
  );
  const rows = res.rows.slice(0, limit);
  const items: DisputeView[] = [];
  for (const row of rows) {
    const d = mapDispute(row);
    items.push({ ...d, messages: (await messagesFor({ query } as any, d.id, false)) as DisputeMessageView[] });
  }
  return { items, endCursor: items.length ? encodeCursor(items[items.length - 1]) : null };
}

/** D5: participant detail; never includes internal notes, staff user ids or provider ids. */
export async function dispute(id: string, actor: Actor): Promise<DisputeView> {
  assertCanPerform(actor, "dispute");
  const res = await query(`SELECT * FROM disputes WHERE id = $1`, [id]);
  if ((res.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: Dispute not found.");
  const d = mapDispute(res.rows[0]);
  const { buyerUserId, sellerUserId } = await participantsFor({ query } as any, d.orderId);
  assertParticipant(actor, buyerUserId, sellerUserId);
  return { ...d, messages: (await messagesFor({ query } as any, d.id, false)) as DisputeMessageView[] };
}

/** D6/D7: staff queue. Support sees assigned cases only; finance sees financial fields only. */
export async function disputesQueue(
  actor: Actor,
  opts: { first?: number | null; after?: string | null } = {}
): Promise<DisputePage<DisputeStaffView | DisputeFinanceView>> {
  assertCanPerform(actor, "disputesQueue");
  const limit = Math.min(Math.max(opts.first ?? 20, 1), 100);
  const cursor = parseCursor(opts.after);
  const params: any[] = [];
  let clause = `WHERE status = 'open'`;
  if (actor.roles.includes("support") && !actor.roles.includes("moderator") && !actor.roles.includes("admin")) {
    params.push(actor.id);
    clause += ` AND assigned_to_user_id = $${params.length}`;
  }
  if (cursor) {
    params.push(cursor.createdAt, cursor.id);
    clause += ` AND (created_at < $${params.length - 1}::timestamptz
      OR (created_at = $${params.length - 1}::timestamptz AND id < $${params.length}::uuid))`;
  }
  params.push(limit + 1);
  const res = await query(`SELECT * FROM disputes ${clause} ORDER BY created_at DESC, id DESC LIMIT $${params.length}`, params);
  const items: (DisputeStaffView | DisputeFinanceView)[] = [];
  for (const row of res.rows.slice(0, limit)) {
    const d = mapDispute(row);
    if (isFinance(actor)) {
      const fin = await financialFor({ query } as any, d.orderId);
      items.push({ ...fin, id: d.id, status: d.status });
    } else {
      const fin = await financialFor({ query } as any, d.orderId);
      items.push({
        ...d,
        messages: (await messagesFor({ query } as any, d.id, true)) as DisputeStaffMessageView[],
        financial: { ...fin, id: d.id, status: d.status },
      });
    }
  }
  const last = (res.rows as any[]).slice(0, limit).at(-1);
  return { items, endCursor: last ? encodeCursor(mapDispute(last)) : null };
}

/** D5/D6: staff detail; support restricted to assigned cases; finance gets a financial-only view. */
export async function disputeForStaff(id: string, actor: Actor): Promise<DisputeStaffView | DisputeFinanceView> {
  assertCanPerform(actor, "disputeForStaff");
  const res = await query(`SELECT * FROM disputes WHERE id = $1`, [id]);
  if ((res.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: Dispute not found.");
  const d = mapDispute(res.rows[0]);
  if (!isFinance(actor) && !canAccessAssigned(actor, d.assignedToUserId)) {
    throw new Error("NOT_FOUND: Dispute not found.");
  }
  const fin = await financialFor({ query } as any, d.orderId);
  if (isFinance(actor)) return { ...fin, id: d.id, status: d.status };
  return {
    ...d,
    messages: (await messagesFor({ query } as any, d.id, true)) as DisputeStaffMessageView[],
    financial: { ...fin, id: d.id, status: d.status },
  };
}

/** D7: only admin/moderator may assign; one audit row; unassigned cases are hidden from support. */
export async function assignDispute(
  disputeId: string,
  staffUserId: string,
  actor: Actor,
  opts?: ServiceOptions
): Promise<DisputeStaffView> {
  assertCanPerform(actor, "assignDispute");
  const at = clockFor(opts)();
  return withTransaction(async (client) => {
    const target = await client.query(
      `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND r.name IN ('support','moderator','admin') LIMIT 1`,
      [staffUserId]
    );
    if ((target.rowCount ?? 0) === 0) throw new Error("VALIDATION_ERROR: Assignee is not a dispute staff member.");
    const res = await client.query(`SELECT * FROM disputes WHERE id = $1 FOR UPDATE`, [disputeId]);
    if ((res.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: Dispute not found.");
    const d = mapDispute(res.rows[0]);
    if (d.status !== "open") throw new Error("INVALID_DISPUTE_STATE: Only open disputes can be assigned.");
    const updated = await client.query(
      `UPDATE disputes SET assigned_to_user_id = $2, updated_at = $3 WHERE id = $1 RETURNING *`,
      [disputeId, staffUserId, at]
    );
    await recordAudit(
      {
        actorUserId: actor.id,
        action: "dispute.assigned",
        targetType: "dispute",
        targetId: disputeId,
        metadata: { assignedToUserId: staffUserId },
        createdAt: at,
      },
      client
    );
    const fin = await financialFor(client, d.orderId);
    return {
      ...mapDispute(updated.rows[0]),
      messages: (await messagesFor(client, disputeId, true)) as DisputeStaffMessageView[],
      financial: { ...fin, id: disputeId, status: d.status },
    };
  });
}

/**
 * D8/D11: resolve. refund_* goes through the existing refundPayment path (no bypass) with the
 * money flag; no_action/order_cancelled work with the flag OFF. Second resolution -> INVALID_DISPUTE_TRANSITION.
 */
export async function resolveDispute(
  disputeId: string,
  actor: Actor,
  outcome: string,
  reason: string | null | undefined,
  input: { amountMinor?: number } = {},
  opts?: ServiceOptions & { client?: pg.PoolClient }
): Promise<DisputeStaffView> {
  assertCanPerform(actor, "resolveDispute");
  const resolvedOutcome = validateOutcome(outcome);
  const trimmedReason = requireReason(reason);
  const at = clockFor(opts)();
  const moneyEnabled = opts?.moneyEnabled ?? config.features.realMoneyPaymentsEnabled;

  const run = async (client: pg.PoolClient): Promise<DisputeStaffView> => {
    const res = await client.query(`SELECT * FROM disputes WHERE id = $1 FOR UPDATE`, [disputeId]);
    if ((res.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: Dispute not found.");
    const d = mapDispute(res.rows[0]);
    if (!canAccessAssigned(actor, d.assignedToUserId)) throw new Error("NOT_FOUND: Dispute not found.");
    assertTransition(d.status, "resolved");
    const { order } = await participantsFor(client, d.orderId);

    if (resolvedOutcome === "refund_full" || resolvedOutcome === "refund_partial") {
      // D11: never bypass the Slice 6 refund path; flag OFF -> REAL_MONEY_DISABLED, no writes.
      const pay = await client.query(
        `SELECT id, captured_amount_minor, refunded_amount_minor FROM payment_transactions
         WHERE order_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
        [d.orderId]
      );
      if ((pay.rowCount ?? 0) === 0) throw new Error("VALIDATION_ERROR: No payment to refund.");
      const remaining = Number(pay.rows[0].captured_amount_minor) - Number(pay.rows[0].refunded_amount_minor);
      const amount = resolvedOutcome === "refund_full" ? remaining : Number(input.amountMinor);
      if (!Number.isInteger(amount) || amount <= 0 || amount > remaining) {
        throw new Error("VALIDATION_ERROR: Refund amount is invalid or exceeds the refundable amount.");
      }
      const paymentOpts: PaymentServiceOptions & { client: pg.PoolClient } = { now: () => at, moneyEnabled, client };
      await refundPayment(pay.rows[0].id, actor, amount, trimmedReason, paymentOpts);
    } else if (resolvedOutcome === "order_cancelled") {
      if (order.status !== "awaiting_payment") {
        throw new Error("INVALID_DISPUTE_STATE: order_cancelled requires an awaiting_payment order.");
      }
      // Only the order state machine may write the order status.
      await transitionOrder(client, order, "cancelled", actor.id, trimmedReason, at);
    }

    const updated = await client.query(
      `UPDATE disputes SET status = 'resolved', outcome = $2, resolution_reason = $3,
        resolved_by_user_id = $4, resolved_at = $5, updated_at = $5 WHERE id = $1 RETURNING *`,
      [disputeId, resolvedOutcome, trimmedReason, actor.id, at]
    );
    await recordAudit(
      {
        actorUserId: actor.id,
        action: "dispute.resolved",
        targetType: "dispute",
        targetId: disputeId,
        reason: trimmedReason,
        metadata: { before: d.status, after: "resolved", outcome: resolvedOutcome },
        createdAt: at,
      },
      client
    );
    // D10: outcome code only, no description or message body; both participants are notified.
    await emit(client, "dispute.resolved", { disputeId, orderId: d.orderId, outcome: resolvedOutcome }, at);
    const fin = await financialFor(client, d.orderId);
    return {
      ...mapDispute(updated.rows[0]),
      messages: (await messagesFor(client, disputeId, true)) as DisputeStaffMessageView[],
      financial: { ...fin, id: disputeId, status: "resolved" },
    };
  };

  return opts?.client ? run(opts.client) : withTransaction(run);
}

/** D9: close a resolved no_action dispute with a reason; one audit row. */
export async function closeDispute(
  disputeId: string,
  actor: Actor,
  reason: string | null | undefined,
  opts?: ServiceOptions
): Promise<DisputeStaffView> {
  assertCanPerform(actor, "closeDispute");
  const trimmedReason = requireReason(reason);
  const at = clockFor(opts)();
  return withTransaction(async (client) => {
    const res = await client.query(`SELECT * FROM disputes WHERE id = $1 FOR UPDATE`, [disputeId]);
    if ((res.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: Dispute not found.");
    const d = mapDispute(res.rows[0]);
    if (!canAccessAssigned(actor, d.assignedToUserId)) throw new Error("NOT_FOUND: Dispute not found.");
    assertTransition(d.status, "closed");
    if (d.outcome !== "no_action") {
      throw new Error("INVALID_DISPUTE_STATE: Only no_action disputes can be closed.");
    }
    const updated = await client.query(
      `UPDATE disputes SET status = 'closed', updated_at = $2 WHERE id = $1 RETURNING *`,
      [disputeId, at]
    );
    await recordAudit(
      {
        actorUserId: actor.id,
        action: "dispute.closed",
        targetType: "dispute",
        targetId: disputeId,
        reason: trimmedReason,
        metadata: { before: d.status, after: "closed" },
        createdAt: at,
      },
      client
    );
    const fin = await financialFor(client, d.orderId);
    return {
      ...mapDispute(updated.rows[0]),
      messages: (await messagesFor(client, disputeId, true)) as DisputeStaffMessageView[],
      financial: { ...fin, id: disputeId, status: "closed" },
    };
  });
}
