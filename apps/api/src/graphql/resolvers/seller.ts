import { requireAuth, requireVerified, type GraphQLContext } from "../../auth/authz.js";
import {
  createSellerProfile,
  getMySellerProfile,
  getMySellerVerification,
  listPendingSellerVerifications,
  requireApprovedSellerForUser,
  reviewSellerVerification,
  submitSellerVerification,
  updateSellerProfile,
} from "../../seller/service.js";

function requireStaffReviewer(ctx: GraphQLContext) {
  const user = requireAuth(ctx);
  // docs/09: verification review by Moderator/Trust & Safety (and staff as assigned). Permission concept: seller.verify.
  if (user.roles.includes("admin") || user.roles.includes("moderator") || user.roles.includes("support")) {
    return user;
  }
  throw new Error("FORBIDDEN: Insufficient permissions.");
}

export const sellerResolvers = {
  Query: {
    mySellerProfile: async (_: any, __: any, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      return getMySellerProfile(user.id);
    },
    mySellerVerification: async (_: any, __: any, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      return getMySellerVerification(user.id);
    },
    pendingSellerVerifications: async (_: any, args: any, ctx: GraphQLContext) => {
      requireStaffReviewer(ctx);
      const items = await listPendingSellerVerifications({
        first: args.first,
        afterCreatedAt: args.after || null,
      });
      // Minimal cursor: createdAt of last item
      const endCursor = items.length ? items[items.length - 1].createdAt.toISOString() : null;
      return { items, endCursor };
    },
  },
  Mutation: {
    createSellerProfile: async (_: any, { input }: any, ctx: GraphQLContext) => {
      const user = requireVerified(ctx);
      return createSellerProfile({ userId: user.id, ...input });
    },
    updateSellerProfile: async (_: any, { input }: any, ctx: GraphQLContext) => {
      const user = requireVerified(ctx);
      return updateSellerProfile({ userId: user.id, ...input });
    },
    submitSellerVerification: async (_: any, __: any, ctx: GraphQLContext) => {
      const user = requireVerified(ctx);
      return submitSellerVerification(user.id);
    },
    reviewSellerVerification: async (_: any, { input }: any, ctx: GraphQLContext) => {
      const reviewer = requireStaffReviewer(ctx);
      return reviewSellerVerification({
        verificationId: input.verificationId,
        reviewerUserId: reviewer.id,
        decision: input.decision,
        reason: input.reason,
      });
    },
    sellerActionPing: async (_: any, __: any, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      await requireApprovedSellerForUser(user.id);
      return { ok: true, message: "Approved seller access granted." };
    },
  },
};
