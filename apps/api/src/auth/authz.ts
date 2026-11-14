import type { AppUser } from "./service.js";

export type GraphQLContext = {
  req: any;
  res: any;
  user: AppUser | null;
  sessionToken?: string | null;
  rotatedToken?: string;
  rotatedExpiresAt?: Date;
};

export function requireAuth(ctx: GraphQLContext): AppUser {
  if (!ctx.user) {
    throw new Error("UNAUTHENTICATED: Authentication required.");
  }
  return ctx.user;
}

export function requireRole(ctx: GraphQLContext, role: string): AppUser {
  const user = requireAuth(ctx);
  if (!user.roles.includes(role)) {
    throw new Error("FORBIDDEN: Insufficient permissions.");
  }
  return user;
}
