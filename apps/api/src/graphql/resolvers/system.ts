import type { GraphQLContext } from "../../auth/authz.js";

/** Slice 9: server-authoritative time for client countdown offset calculation. */
export function resolveServerTime(_: any, __: any, ctx: GraphQLContext): Date {
  return (ctx?.serverClock ?? (() => new Date()))();
}
