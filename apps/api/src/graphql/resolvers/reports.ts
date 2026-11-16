import { requireAuth, requireVerified, type GraphQLContext } from "../../auth/authz.js";
import { assertCanPerform, type PrivilegedOperation } from "../../reports/permissions.js";
import {
  getReportForStaff,
  pendingReports,
  reportListing,
  reportUser,
  resolveReport,
  type ReportRow,
} from "../../reports/service.js";
import { reinstateUser, suspendUser } from "../../accounts/service.js";

function requireStaffRole(ctx: GraphQLContext, op: PrivilegedOperation) {
  const user = requireAuth(ctx);
  // Resolver-side role check; the service repeats the same check (rule 5).
  assertCanPerform(user, op);
  return user;
}

function toIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function serializeReport(r: ReportRow) {
  return {
    id: r.id,
    reporterUserId: r.reporterUserId,
    targetType: r.targetType,
    targetId: r.targetId,
    category: r.category,
    details: r.details,
    status: r.status,
    resolutionReason: r.resolutionReason,
    resolvedByUserId: r.resolvedByUserId,
    resolvedAt: toIso(r.resolvedAt),
    createdAt: toIso(r.createdAt),
    updatedAt: toIso(r.updatedAt),
  };
}

// Reporter receipt is deliberately minimal: no reporter identity and no reported-party data.
function serializeReceipt(report: ReportRow) {
  return { id: report.id, status: report.status };
}

export const reportsResolvers = {
  Query: {
    pendingReports: async (_: any, args: any, ctx: GraphQLContext) => {
      const staff = requireStaffRole(ctx, "pendingReports");
      const result = await pendingReports(staff, { first: args.first, after: args.after ?? null });
      return { ...result, items: result.items.map(serializeReport) };
    },
    reportForStaff: async (_: any, args: { id: string }, ctx: GraphQLContext) => {
      const staff = requireStaffRole(ctx, "reportForStaff");
      return serializeReport(await getReportForStaff(staff, args.id));
    },
  },
  Mutation: {
    reportListing: async (_: any, args: any, ctx: GraphQLContext) => {
      const user = requireVerified(ctx);
      const { report } = await reportListing(user, args.listingId, args.category, args.details ?? null);
      return serializeReceipt(report);
    },
    reportUser: async (_: any, args: any, ctx: GraphQLContext) => {
      const user = requireVerified(ctx);
      const { report } = await reportUser(user, args.userId, args.category, args.details ?? null);
      return serializeReceipt(report);
    },
    resolveReport: async (_: any, args: any, ctx: GraphQLContext) => {
      const staff = requireStaffRole(ctx, "resolveReport");
      return serializeReport(
        await resolveReport(args.reportId, staff, args.decision, args.reason, args.action)
      );
    },
    suspendUser: async (_: any, args: any, ctx: GraphQLContext) => {
      const staff = requireStaffRole(ctx, "suspendUser");
      const outcome = await suspendUser(args.userId, staff, args.reason);
      return { userId: outcome.userId, status: outcome.after };
    },
    reinstateUser: async (_: any, args: any, ctx: GraphQLContext) => {
      const staff = requireStaffRole(ctx, "reinstateUser");
      const outcome = await reinstateUser(args.userId, staff, args.reason);
      return { userId: outcome.userId, status: outcome.after };
    },
  },
};
