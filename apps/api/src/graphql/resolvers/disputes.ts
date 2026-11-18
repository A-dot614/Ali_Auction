import { config } from "../../config.js";
import { requireAuth, requireVerified, type GraphQLContext } from "../../auth/authz.js";
import { isFinance } from "../../disputes/permissions.js";
import {
  assignDispute,
  closeDispute,
  dispute as getDisputeForParticipant,
  disputeForStaff as getDisputeForStaff,
  disputesQueue,
  myDisputes,
  openDispute,
  postDisputeMessage,
  resolveDispute,
  type DisputeFinanceView,
  type DisputeMessageView,
  type DisputeStaffMessageView,
  type DisputeStaffView,
  type DisputeView,
} from "../../disputes/service.js";

/** Slice 12 resolvers: role checks here and again in the service (rule 5). */

function serviceOpts(ctx: GraphQLContext) {
  return {
    clock: ctx.disputeConfig?.clock ?? ctx.serverClock,
    moneyEnabled: ctx.disputeConfig?.moneyEnabled ?? config.features.realMoneyPaymentsEnabled,
    maxDescriptionLength: ctx.disputeConfig?.maxDescriptionLength,
    evidenceWindowDays: ctx.disputeConfig?.evidenceWindowDays,
  };
}

function toIso(d: Date | null | undefined): string | null {
  return d ? new Date(d).toISOString() : null;
}

function serializeMessage(m: DisputeMessageView) {
  return { id: m.id, authorRole: m.authorRole, body: m.body, createdAt: toIso(m.createdAt) };
}

function serializeStaffMessage(m: DisputeStaffMessageView) {
  return {
    ...serializeMessage(m),
    authorUserId: m.authorUserId,
    internalOnly: m.internalOnly,
  };
}

/** D5: participant shape never carries internal_only notes, staff user ids or provider ids. */
function serializeParticipant(d: DisputeView) {
  return {
    id: d.id,
    orderId: d.orderId,
    reasonCode: d.reasonCode,
    description: d.description,
    status: d.status,
    outcome: d.outcome,
    resolutionReason: d.resolutionReason,
    resolvedAt: toIso(d.resolvedAt),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
    messages: d.messages.map(serializeMessage),
  };
}

function serializeFinance(d: DisputeFinanceView) {
  return {
    __typename: "DisputeFinanceType" as const,
    id: d.id,
    orderId: d.orderId,
    status: d.status,
    orderTotalMinor: d.orderTotalMinor,
    refundedAmountMinor: d.refundedAmountMinor,
    paymentStatus: d.paymentStatus,
  };
}

function serializeStaff(d: DisputeStaffView) {
  return {
    __typename: "DisputeStaffType" as const,
    id: d.id,
    orderId: d.orderId,
    openedByUserId: d.openedByUserId,
    reasonCode: d.reasonCode,
    description: d.description,
    status: d.status,
    assignedToUserId: d.assignedToUserId,
    outcome: d.outcome,
    resolutionReason: d.resolutionReason,
    resolvedByUserId: d.resolvedByUserId,
    resolvedAt: toIso(d.resolvedAt),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
    messages: d.messages.map(serializeStaffMessage),
    financial: serializeFinance(d.financial),
  };
}

function serializeStaffResult(d: DisputeStaffView | DisputeFinanceView, finance: boolean) {
  return finance ? serializeFinance(d as DisputeFinanceView) : serializeStaff(d as DisputeStaffView);
}

export const disputesResolvers = {
  Query: {
    myDisputes: async (_: any, args: any, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      const result = await myDisputes({ id: user.id, roles: user.roles }, { first: args.first, after: args.after ?? null });
      return { ...result, items: result.items.map(serializeParticipant) };
    },
    dispute: async (_: any, args: { id: string }, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      return serializeParticipant(await getDisputeForParticipant(args.id, { id: user.id, roles: user.roles }));
    },
    disputesQueue: async (_: any, args: any, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      const result = await disputesQueue(
        { id: user.id, roles: user.roles },
        { first: args.first, after: args.after ?? null }
      );
      const finance = isFinance({ roles: user.roles });
      return { ...result, items: result.items.map((d) => serializeStaffResult(d, finance)) };
    },
    disputeForStaff: async (_: any, args: { id: string }, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      const result = await getDisputeForStaff(args.id, { id: user.id, roles: user.roles });
      return serializeStaffResult(result, isFinance({ roles: user.roles }));
    },
  },
  Mutation: {
    openDispute: async (_: any, { input }: any, ctx: GraphQLContext) => {
      const user = requireVerified(ctx);
      const { dispute } = await openDispute(
        { id: user.id, roles: user.roles },
        {
          orderId: input.orderId,
          reasonCode: input.reasonCode,
          description: input.description,
          requestId: input.requestId,
        },
        serviceOpts(ctx)
      );
      return serializeParticipant(dispute);
    },
    postDisputeMessage: async (_: any, { input }: any, ctx: GraphQLContext) => {
      const user = requireVerified(ctx);
      const message = await postDisputeMessage(
        input.disputeId,
        { id: user.id, roles: user.roles },
        input.body,
        input.internalOnly === true,
        serviceOpts(ctx)
      );
      return "internalOnly" in message ? serializeStaffMessage(message) : serializeMessage(message);
    },
    assignDispute: async (_: any, args: any, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      return serializeStaff(
        await assignDispute(args.disputeId, args.staffUserId, { id: user.id, roles: user.roles }, serviceOpts(ctx))
      );
    },
    resolveDispute: async (_: any, { input }: any, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      const staff = serializeStaff(
        await resolveDispute(
          input.disputeId,
          { id: user.id, roles: user.roles },
          input.outcome,
          input.reason,
          { amountMinor: input.amountMinor == null ? undefined : Number(input.amountMinor) },
          serviceOpts(ctx)
        )
      );
      return staff;
    },
    closeDispute: async (_: any, args: any, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      return serializeStaff(
        await closeDispute(args.disputeId, { id: user.id, roles: user.roles }, args.reason, serviceOpts(ctx))
      );
    },
  },
};
