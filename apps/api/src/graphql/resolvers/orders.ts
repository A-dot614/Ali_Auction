import { config } from "../../config.js";
import { requireAuth, type GraphQLContext } from "../../auth/authz.js";
import type { AppUser } from "../../auth/service.js";
import {
  getMyOrders,
  getOrder,
  ordersAll,
  recordFulfilment as recordFulfilmentService,
  sellerOrders,
  type FulfilmentAction,
} from "../../orders/service.js";
import { createCheckout, refundPayment } from "../../payments/service.js";

function viewer(user: AppUser) {
  return { id: user.id, roles: user.roles };
}

function requireStaff(user: AppUser) {
  if (!user.roles.some((r) => r === "admin" || r === "moderator" || r === "support")) {
    throw new Error("FORBIDDEN: Insufficient permissions.");
  }
  return user;
}

function serializeOrder(order: Awaited<ReturnType<typeof getOrder>>) {
  return {
    ...order,
    shippingAddressSnapshot: order.shippingAddressSnapshot == null ? null : JSON.stringify(order.shippingAddressSnapshot),
  };
}

const moneyOpts = () => ({ moneyEnabled: config.features.realMoneyPaymentsEnabled });

export const ordersResolvers = {
  Query: {
    myOrders: async (_: any, args: any, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      const result = await getMyOrders(viewer(user), { first: args.first, after: args.after ?? null });
      return { ...result, items: result.items.map(serializeOrder) };
    },
    order: async (_: any, args: { id: string }, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      return serializeOrder(await getOrder(args.id, viewer(user)));
    },
    sellerOrders: async (_: any, args: any, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      const result = await sellerOrders(viewer(user), { first: args.first, after: args.after ?? null });
      return { ...result, items: result.items.map(serializeOrder) };
    },
    ordersAll: async (_: any, args: any, ctx: GraphQLContext) => {
      const user = requireStaff(requireAuth(ctx));
      const result = await ordersAll(viewer(user), { first: args.first, after: args.after ?? null });
      return { ...result, items: result.items.map(serializeOrder) };
    },
  },
  Mutation: {
    createCheckout: async (_: any, { input }: any, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      return createCheckout(
        input.orderId,
        user.id,
        { acceptedTotalMinor: input.acceptedTotalMinor, fulfilmentChoice: input.fulfilmentChoice, requestId: input.requestId },
        moneyOpts()
      );
    },
    recordFulfilment: async (_: any, { input }: any, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      return serializeOrder(
        await recordFulfilmentService(
          input.orderId,
          viewer(user),
          input.action as FulfilmentAction,
          { carrier: input.carrier ?? undefined, trackingNumber: input.trackingNumber ?? undefined },
          {}
        )
      );
    },
    refundPayment: async (_: any, { input }: any, ctx: GraphQLContext) => {
      const user = requireStaff(requireAuth(ctx));
      return refundPayment(input.paymentId, viewer(user), Number(input.amountMinor), input.reason ?? null, moneyOpts());
    },
  },
};
