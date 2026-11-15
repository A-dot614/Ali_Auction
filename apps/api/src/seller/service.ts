import type pg from "pg";
import { query, withTransaction } from "../db.js";
import { recordAudit } from "../audit.js";
import {
  assertTransition,
  SELLER_REAPPLICATION_AFTER_REJECTION_ENABLED,
  type SellerVerificationStatus,
} from "./verificationStateMachine.js";

export type SellerType = "individual" | "business" | "institutional";

export type SellerProfile = {
  id: string;
  userId: string;
  sellerType: SellerType;
  displayName: string;
  publicStoreName: string | null;
  // legalName is restricted; never exposed to owner/public via GraphQL in this slice.
  provinceCode: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SellerVerification = {
  id: string;
  sellerProfileId: string;
  status: SellerVerificationStatus;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  // reviewedBy / documentStorageKey never exposed to seller/public.
  decisionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const VALID_SELLER_TYPES: SellerType[] = ["individual", "business", "institutional"];
const PROVINCE_RE = /^[A-Z]{2}$/;

function normalizeProvince(code: string): string {
  return code.trim().toUpperCase();
}

function validateSellerProfileInput(input: {
  sellerType: string;
  displayName: string;
  provinceCode: string;
}): { sellerType: SellerType; displayName: string; provinceCode: string } {
  if (!VALID_SELLER_TYPES.includes(input.sellerType as SellerType)) {
    throw new Error("VALIDATION_ERROR: Invalid seller_type.");
  }
  const displayName = input.displayName?.trim();
  if (!displayName) throw new Error("VALIDATION_ERROR: display_name is required.");
  const provinceCode = normalizeProvince(input.provinceCode || "");
  if (!PROVINCE_RE.test(provinceCode)) {
    throw new Error("VALIDATION_ERROR: province_code must be a 2-letter code.");
  }
  return { sellerType: input.sellerType as SellerType, displayName, provinceCode };
}

function mapProfile(row: any): SellerProfile {
  return {
    id: row.id,
    userId: row.user_id,
    sellerType: row.seller_type,
    displayName: row.display_name,
    publicStoreName: row.public_store_name,
    provinceCode: row.province_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVerification(row: any): SellerVerification {
  return {
    id: row.id,
    sellerProfileId: row.seller_profile_id,
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    decisionReason: row.decision_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getProfileByUserId(userId: string, client?: pg.PoolClient): Promise<SellerProfile | null> {
  const runner: any = client || { query };
  const res = await runner.query(`SELECT * FROM seller_profiles WHERE user_id = $1`, [userId]);
  if ((res.rowCount ?? 0) === 0) return null;
  return mapProfile(res.rows[0]);
}

export async function getMySellerProfile(userId: string): Promise<SellerProfile | null> {
  return getProfileByUserId(userId);
}

export async function createSellerProfile(input: {
  userId: string;
  sellerType: string;
  displayName: string;
  publicStoreName?: string | null;
  legalName?: string | null;
  provinceCode: string;
}): Promise<SellerProfile> {
  const v = validateSellerProfileInput(input);
  return withTransaction(async (client) => {
    const existing = await client.query(`SELECT id FROM seller_profiles WHERE user_id = $1`, [input.userId]);
    if ((existing.rowCount ?? 0) > 0) {
      throw new Error("VALIDATION_ERROR: Seller profile already exists.");
    }
    const profileRes = await client.query(
      `INSERT INTO seller_profiles (user_id, seller_type, display_name, public_store_name, legal_name, province_code)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        input.userId,
        v.sellerType,
        v.displayName,
        input.publicStoreName?.trim() || null,
        input.legalName?.trim() || null,
        v.provinceCode,
      ]
    );
    const profile = mapProfile(profileRes.rows[0]);
    const verRes = await client.query(
      `INSERT INTO seller_verifications (seller_profile_id, status)
       VALUES ($1, 'not_submitted') RETURNING *`,
      [profile.id]
    );
    await recordAudit(
      {
        actorUserId: input.userId,
        action: "seller.profile_created",
        targetType: "seller_profile",
        targetId: profile.id,
        metadata: { sellerType: profile.sellerType, provinceCode: profile.provinceCode },
      },
      client
    );
    await recordAudit(
      {
        actorUserId: input.userId,
        action: "seller.verification_status_changed",
        targetType: "seller_verification",
        targetId: verRes.rows[0].id,
        metadata: { before: null, after: "not_submitted" },
      },
      client
    );
    return profile;
  });
}

export async function updateSellerProfile(input: {
  userId: string;
  sellerType: string;
  displayName: string;
  publicStoreName?: string | null;
  legalName?: string | null;
  provinceCode: string;
}): Promise<SellerProfile> {
  const v = validateSellerProfileInput(input);
  return withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT * FROM seller_profiles WHERE user_id = $1 FOR UPDATE`,
      [input.userId]
    );
    if ((existing.rowCount ?? 0) === 0) {
      throw new Error("NOT_FOUND: Seller profile not found.");
    }
    const res = await client.query(
      `UPDATE seller_profiles
       SET seller_type=$2, display_name=$3, public_store_name=$4, legal_name=$5, province_code=$6, updated_at=now()
       WHERE user_id=$1
       RETURNING *`,
      [
        input.userId,
        v.sellerType,
        v.displayName,
        input.publicStoreName?.trim() || null,
        input.legalName?.trim() || null,
        v.provinceCode,
      ]
    );
    await recordAudit(
      {
        actorUserId: input.userId,
        action: "seller.profile_updated",
        targetType: "seller_profile",
        targetId: res.rows[0].id,
        metadata: { sellerType: v.sellerType, provinceCode: v.provinceCode },
      },
      client
    );
    return mapProfile(res.rows[0]);
  });
}

export async function getMySellerVerification(userId: string): Promise<SellerVerification | null> {
  const profile = await getProfileByUserId(userId);
  if (!profile) return null;
  const res = await query(
    `SELECT * FROM seller_verifications WHERE seller_profile_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [profile.id]
  );
  if ((res.rowCount ?? 0) === 0) return null;
  return mapVerification(res.rows[0]);
}

export async function submitSellerVerification(userId: string): Promise<SellerVerification> {
  return withTransaction(async (client) => {
    const profile = await getProfileByUserId(userId, client);
    if (!profile) throw new Error("NOT_FOUND: Seller profile required before verification submission.");
    const verRes = await client.query(
      `SELECT * FROM seller_verifications WHERE seller_profile_id = $1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [profile.id]
    );
    if ((verRes.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: Seller verification record not found.");
    const current = verRes.rows[0];
    const from = current.status as SellerVerificationStatus;
    if (from === "submitted") {
      throw new Error("VALIDATION_ERROR: Verification is already submitted.");
    }
    assertTransition(from, "submitted", {
      allowReapplyAfterRejection: SELLER_REAPPLICATION_AFTER_REJECTION_ENABLED,
    });
    const updated = await client.query(
      `UPDATE seller_verifications
       SET status='submitted', submitted_at=now(), updated_at=now(), reviewed_at=NULL, reviewed_by=NULL, decision_reason=NULL
       WHERE id=$1
       RETURNING *`,
      [current.id]
    );
    await recordAudit(
      {
        actorUserId: userId,
        action: "seller.verification_submitted",
        targetType: "seller_verification",
        targetId: current.id,
        metadata: { before: from, after: "submitted" },
      },
      client
    );
    return mapVerification(updated.rows[0]);
  });
}

export type ReviewDecision = "under_review" | "approved" | "rejected" | "more_info_requested";

export async function reviewSellerVerification(input: {
  verificationId: string;
  reviewerUserId: string;
  decision: ReviewDecision;
  reason?: string | null;
}): Promise<SellerVerification> {
  const reason = input.reason?.trim() || null;
  if ((input.decision === "rejected" || input.decision === "more_info_requested") && !reason) {
    throw new Error("VALIDATION_ERROR: Reason is required for this decision.");
  }
  return withTransaction(async (client) => {
    const verRes = await client.query(
      `SELECT sv.*, sp.user_id AS seller_user_id
       FROM seller_verifications sv
       JOIN seller_profiles sp ON sp.id = sv.seller_profile_id
       WHERE sv.id = $1
       FOR UPDATE`,
      [input.verificationId]
    );
    if ((verRes.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: Seller verification not found.");
    const current = verRes.rows[0];
    if (current.seller_user_id === input.reviewerUserId) {
      throw new Error("FORBIDDEN: Reviewer may not review their own verification.");
    }
    const from = current.status as SellerVerificationStatus;
    assertTransition(from, input.decision, {
      allowReapplyAfterRejection: SELLER_REAPPLICATION_AFTER_REJECTION_ENABLED,
    });
    const updated = await client.query(
      `UPDATE seller_verifications
       SET status=$2, reviewed_at=now(), reviewed_by=$3, decision_reason=$4, updated_at=now()
       WHERE id=$1
       RETURNING *`,
      [current.id, input.decision, input.reviewerUserId, reason]
    );
    await recordAudit(
      {
        actorUserId: input.reviewerUserId,
        action: "seller.verification_reviewed",
        targetType: "seller_verification",
        targetId: current.id,
        reason,
        metadata: { before: from, after: input.decision },
      },
      client
    );
    return mapVerification(updated.rows[0]);
  });
}

export async function listPendingSellerVerifications(input: {
  first?: number;
  afterCreatedAt?: string | null;
}): Promise<SellerVerification[]> {
  // Cursor pagination by created_at DESC (simple baseline). Pending = submitted or under_review.
  const limit = Math.min(Math.max(input.first || 20, 1), 100);
  const params: any[] = [limit];
  let where = `WHERE status IN ('submitted','under_review')`;
  if (input.afterCreatedAt) {
    params.push(input.afterCreatedAt);
    where += ` AND created_at < $2`;
  }
  const res = await query(
    `SELECT * FROM seller_verifications ${where} ORDER BY created_at DESC LIMIT $1`,
    params
  );
  return res.rows.map(mapVerification);
}

export async function requireApprovedSellerForUser(userId: string): Promise<void> {
  const ver = await getMySellerVerification(userId);
  if (!ver || ver.status !== "approved") {
    throw new Error("SELLER_NOT_APPROVED: Seller verification approval is required for this action.");
  }
}
