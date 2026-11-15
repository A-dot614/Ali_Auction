import type { AppUser } from "./service.js";

export type GraphQLContext = {
  req: any;
  res: any;
  user: AppUser | null;
  sessionToken?: string | null;
  currentSessionId?: string | null;
  rotatedToken?: string;
  rotatedExpiresAt?: Date;
};

export function requireAuth(ctx: GraphQLContext): AppUser {
  if (!ctx.user) {
    throw new Error("UNAUTHENTICATED: Authentication required.");
  }
  return ctx.user;
}

export function requireVerified(ctx: GraphQLContext): AppUser {
  const user = requireAuth(ctx);
  if (!user.email_verified_at) {
    // Stable error code for unverified users blocked from protected mutations.
    throw new Error("EMAIL_NOT_VERIFIED: Verify your email before performing this action.");
  }
  return user;
}

export function requireRole(ctx: GraphQLContext, role: string): AppUser {
  const user = requireAuth(ctx);
  if (!user.roles.includes(role)) {
    throw new Error("FORBIDDEN: Insufficient permissions.");
  }
  return user;
}

