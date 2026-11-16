import type pg from "pg";
import { query, withTransaction } from "../db.js";
import { recordAudit } from "../audit.js";
import { config } from "../config.js";
import { assertCanPerform } from "./permissions.js";
import { assertTransition, type ReportDecision } from "./reportStateMachine.js";
import { pauseListing } from "../catalogue/service.js";
import { applySuspension } from "../accounts/service.js";
import type { AppUser } from "../auth/service.js";

/**
 * Reports and moderation (Slice 7).
 * D1 categories are a NOT FOR PRODUCTION placeholder; TODO(docs/16 §7 #5).
 * Moderation stays manual (docs/16 §8 #3). Reporter/reported-party notices are
 * produced by the outbox consumer (Slice 8, D2), never inline here.
 * All timestamps come from the injected clock; no SQL clock functions or
 * wall-clock reads outside the injected clock are used in this module.
 */

export const REPORT_CATEGORIES = [
  "prohibited_item",
  "counterfeit",
  "misleading_listing",
  "harassment",
  "spam",
  "other",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];
export type ReportTargetType = "listing" | "user";
export type ModerationAction = "none" | "hide_listing" | "suspend_user";

export type ServiceOptions = { clock?: () => Date; maxDetailsLength?: number };

export type ReportRow = {
  id: string;
  reporterUserId: string;
  targetType: ReportTargetType;
  targetId: string;
  category: ReportCategory;
  details: string | null;
  status: "open" | "actioned" | "dismissed";
  resolvedByUserId: string | null;
  resolutionReason: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ReportReceipt = { report: ReportRow; created: boolean };

function mapReport(row: any): ReportRow {
  return {
    id: row.id,
    reporterUserId: row.reporter_user_id,
    targetType: row.target_type,
    targetId: row.target_id,
    category: row.category,
    details: row.details,
    status: row.status,
    resolvedByUserId: row.resolved_by_user_id,
    resolutionReason: row.resolution_reason,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertReporterEligible(actor: AppUser): void {
  // D2: only active, verified users may report; denied calls write nothing.
  if (actor.status === "suspended") {
    throw new Error("ACCOUNT_SUSPENDED: Account is suspended.");
  }
  if (!actor.email_verified_at) {
    throw new Error("EMAIL_NOT_VERIFIED: Verify your email before reporting.");
  }
}

function validateCategory(category: string): ReportCategory {
  if (!REPORT_CATEGORIES.includes(category as ReportCategory)) {
    throw new Error("VALIDATION_ERROR: Invalid report category.");
  }
  return category as ReportCategory;
}

function validateDetails(details: string | null | undefined, opts?: ServiceOptions): string | null {
  if (details == null) return null;
  const trimmed = details.trim();
  const max = opts?.maxDetailsLength ?? config.moderation.maxReportDetailsLength;
  if (trimmed.length > max) {
    throw new Error("VALIDATION_ERROR: Report details are too long.");
  }
  return trimmed || null;
}

function validateDecision(decision: string): ReportDecision {
  if (decision !== "actioned" && decision !== "dismissed") {
    throw new Error("VALIDATION_ERROR: Invalid resolution decision.");
  }
  return decision;
}

function validateAction(action: string): ModerationAction {
  if (action !== "none" && action !== "hide_listing" && action !== "suspend_user") {
    throw new Error("VALIDATION_ERROR: Invalid moderation action.");
  }
  return action;
}

function requireReason(reason: string | null | undefined): string {
  const trimmed = (reason || "").trim();
  if (!trimmed) throw new Error("VALIDATION_ERROR: Reason is required and must not be empty.");
  return trimmed;
}

function clockFor(opts?: ServiceOptions): () => Date {
  return opts?.clock ?? (() => new Date());
}

async function insertReport(
  client: pg.PoolClient,
  actor: AppUser,
  targetType: ReportTargetType,
  targetId: string,
  category: ReportCategory,
  details: string | null,
  at: Date
): Promise<ReportReceipt> {
  // D4: partial unique index + ON CONFLICT makes dedup atomic. No second row, no audit row.
  const inserted = await client.query(
    `INSERT INTO reports (reporter_user_id, target_type, target_id, category, details, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'open', $6, $6)
     ON CONFLICT (reporter_user_id, target_type, target_id) WHERE status = 'open' DO NOTHING
     RETURNING *`,
    [actor.id, targetType, targetId, category, details, at]
  );
  if (inserted.rowCount === 0) {
    const existing = await client.query(
      `SELECT * FROM reports
       WHERE reporter_user_id = $1 AND target_type = $2 AND target_id = $3 AND status = 'open'`,
      [actor.id, targetType, targetId]
    );
    return { report: mapReport(existing.rows[0]), created: false };
  }
  const report = mapReport(inserted.rows[0]);
  await recordAudit(
    {
      actorUserId: actor.id,
      action: "report.created",
      targetType: "report",
      targetId: report.id,
      reason: null,
      metadata: { targetType, targetId, category },
      createdAt: at,
    },
    client
  );
  return { report, created: true };
}

/** D2/D3/D4: report a listing. Never records the reported party's response or exposes the reporter. */
export async function reportListing(
  actor: AppUser,
  listingId: string,
  category: string,
  details: string | null | undefined,
  opts?: ServiceOptions
): Promise<ReportReceipt> {
  assertReporterEligible(actor);
  const cat = validateCategory(category);
  const det = validateDetails(details, opts);
  const at = clockFor(opts)();
  return withTransaction(async (client) => {
    const listing = await client.query(`SELECT seller_profile_id FROM listings WHERE id = $1`, [listingId]);
    if ((listing.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: Listing not found.");
    const owner = await client.query(`SELECT user_id FROM seller_profiles WHERE id = $1`, [listing.rows[0].seller_profile_id]);
    if (owner.rows[0]?.user_id === actor.id) {
      throw new Error("FORBIDDEN: You cannot report your own listing.");
    }
    return insertReport(client, actor, "listing", listingId, cat, det, at);
  });
}

/** D2/D3/D4: report a user. Self-report is forbidden. */
export async function reportUser(
  actor: AppUser,
  userId: string,
  category: string,
  details: string | null | undefined,
  opts?: ServiceOptions
): Promise<ReportReceipt> {
  assertReporterEligible(actor);
  const cat = validateCategory(category);
  const det = validateDetails(details, opts);
  const at = clockFor(opts)();
  if (userId === actor.id) throw new Error("FORBIDDEN: You cannot report yourself.");
  return withTransaction(async (client) => {
    const target = await client.query(`SELECT id FROM users WHERE id = $1`, [userId]);
    if ((target.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: User not found.");
    return insertReport(client, actor, "user", userId, cat, det, at);
  });
}

export function parseReportCursor(cursor: string): { createdAt: Date; id: string } {
  const sep = cursor.lastIndexOf("|");
  const ts = sep > 0 ? cursor.slice(0, sep) : "";
  const id = sep > 0 ? cursor.slice(sep + 1) : "";
  const createdAt = new Date(ts);
  if (!ts || !id || Number.isNaN(createdAt.getTime())) {
    throw new Error("VALIDATION_ERROR: Invalid report cursor.");
  }
  return { createdAt, id };
}

function encodeReportCursor(r: ReportRow): string {
  return `${r.createdAt.toISOString()}|${r.id}`;
}

/** D5: staff-only, open reports, cursor-paginated by created_at, id (1-100). */
export async function pendingReports(
  actor: AppUser,
  opts: { first?: number | null; after?: string | null } = {}
): Promise<{ items: ReportRow[]; endCursor: string | null }> {
  assertCanPerform(actor, "pendingReports");
  const limit = Math.min(Math.max(opts.first || 20, 1), 100);
  const params: any[] = [];
  let where = `WHERE status = 'open'`;
  if (opts.after) {
    const c = parseReportCursor(opts.after);
    params.push(c.createdAt, c.id);
    where += ` AND (created_at < $${params.length - 1} OR (created_at = $${params.length - 1} AND id < $${params.length}))`;
  }
  params.push(limit);
  const res = await query(`SELECT * FROM reports ${where} ORDER BY created_at DESC, id DESC LIMIT $${params.length}`, params);
  const items = res.rows.map(mapReport);
  return { items, endCursor: items.length ? encodeReportCursor(items[items.length - 1]) : null };
}

/** D5: staff-only report detail; reporter identity is included only in this staff response. */
export async function getReportForStaff(actor: AppUser, reportId: string): Promise<ReportRow> {
  assertCanPerform(actor, "reportForStaff");
  const res = await query(`SELECT * FROM reports WHERE id = $1`, [reportId]);
  if ((res.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: Report not found.");
  return mapReport(res.rows[0]);
}

/**
 * D10: resolve once. The target action (hide listing / suspend user) shares the
 * resolution transaction. Invalid transitions and validation failures write nothing.
 */
export async function resolveReport(
  reportId: string,
  actor: AppUser,
  decision: string,
  reason: string | null | undefined,
  action: string,
  opts?: ServiceOptions
): Promise<ReportRow> {
  assertCanPerform(actor, "resolveReport");
  const resolvedDecision = validateDecision(decision);
  const resolvedAction = validateAction(action);
  const trimmedReason = requireReason(reason);
  const at = clockFor(opts)();
  return withTransaction(async (client) => {
    const res = await client.query(`SELECT * FROM reports WHERE id = $1 FOR UPDATE`, [reportId]);
    if ((res.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: Report not found.");
    const report = mapReport(res.rows[0]);
    // Second resolution throws INVALID_REPORT_TRANSITION before any write.
    assertTransition(report.status, resolvedDecision);

    if (resolvedAction === "hide_listing" && report.targetType !== "listing") {
      throw new Error("VALIDATION_ERROR: hide_listing applies only to listing reports.");
    }
    if (resolvedAction === "suspend_user" && report.targetType !== "user") {
      throw new Error("VALIDATION_ERROR: suspend_user applies only to user reports.");
    }
    if (resolvedAction !== "none" && resolvedDecision !== "actioned") {
      throw new Error("VALIDATION_ERROR: A target action requires an actioned decision.");
    }
    if (resolvedDecision === "dismissed" && resolvedAction !== "none") {
      throw new Error("VALIDATION_ERROR: Dismissed reports cannot carry a target action.");
    }

    // Target action within this same transaction (D7 / D8).
    if (resolvedAction === "hide_listing") {
      await pauseListing(report.targetId, actor.id, trimmedReason, client);
    } else if (resolvedAction === "suspend_user") {
      await applySuspension(client, report.targetId, actor, trimmedReason, at);
    }

    const updated = await client.query(
      `UPDATE reports SET status = $2, resolved_by_user_id = $3, resolved_at = $4,
        resolution_reason = $5, updated_at = $4 WHERE id = $1 RETURNING *`,
      [reportId, resolvedDecision, actor.id, at, trimmedReason]
    );
    await recordAudit(
      {
        actorUserId: actor.id,
        action: `report.${resolvedDecision}`,
        targetType: "report",
        targetId: reportId,
        reason: trimmedReason,
        metadata: {
          before: "open",
          after: resolvedDecision,
          action: resolvedAction,
          targetType: report.targetType,
          targetId: report.targetId,
        },
        createdAt: at,
      },
      client
    );
    // Slice 8 (D2): outcome-only notice for the reporter, neutral notice for the
    // reported party only when an action was taken. No reporter id in either body.
    await client.query(
      `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, created_at)
       VALUES ('report', $1, 'report.resolved', $2::jsonb, $3)`,
      [
        reportId,
        JSON.stringify({
          reportId,
          reporterUserId: report.reporterUserId,
          targetType: report.targetType,
          targetId: report.targetId,
          decision: resolvedDecision,
          action: resolvedAction,
        }),
        at,
      ]
    );
    return mapReport(updated.rows[0]);
  });
}
