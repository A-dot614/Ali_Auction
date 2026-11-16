import { requireAuth, type GraphQLContext } from "../../auth/authz.js";
import {
  linkFor,
  markNotificationRead,
  myNotifications,
  unreadCount,
  type NotificationRow,
} from "../../notifications/service.js";

/** Slice 8 resolvers: notification data is scoped to the authenticated recipient. */
function serialize(n: NotificationRow) {
  return {
    id: n.id,
    category: n.category,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt.toISOString(),
    readAt: n.readAt ? n.readAt.toISOString() : null,
    resourceType: n.resourceType,
    resourceId: n.resourceId,
    // D5: relative path only, resolved here for the authenticated owner.
    link: linkFor(n),
  };
}

export const notificationsResolvers = {
  Query: {
    myNotifications: async (_: any, args: any, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      const result = await myNotifications(user.id, {
        first: args.first,
        after: args.after ?? null,
        unreadOnly: args.unreadOnly ?? null,
      });
      return { ...result, items: result.items.map(serialize) };
    },
    unreadCount: async (_: any, __: any, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      return unreadCount(user.id);
    },
  },
  Mutation: {
    markNotificationRead: async (_: any, args: { id: string }, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      return serialize(await markNotificationRead(args.id, user.id));
    },
  },
};
