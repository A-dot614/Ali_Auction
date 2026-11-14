import { config } from "../../config.js";
import {
  authenticateSession,
  login,
  logout,
  register,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  type AppUser,
} from "../../auth/service.js";
import { requireAuth, requireRole, type GraphQLContext } from "../../auth/authz.js";
import { recordAudit } from "../../audit.js";

function cookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true,
    secure: config.session.secureCookies,
    sameSite: "lax" as const,
    path: "/",
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

function setSessionCookie(ctx: GraphQLContext, token: string, expiresAt: Date) {
  ctx.res?.cookie?.(config.session.cookieName, token, cookieOptions(expiresAt));
}

function clearSessionCookie(ctx: GraphQLContext) {
  ctx.res?.clearCookie?.(config.session.cookieName, { ...cookieOptions(), expires: undefined });
}

function userPayload(u: AppUser) {
  return {
    id: u.id,
    email: u.email,
    status: u.status,
    emailVerified: Boolean(u.email_verified_at),
    roles: u.roles,
  };
}

export const identityResolvers = {
  Query: {
    me: async (_: any, __: any, ctx: GraphQLContext) => {
      // Apply rotation cookie if context loader rotated.
      if (ctx.rotatedToken && ctx.rotatedExpiresAt) {
        setSessionCookie(ctx, ctx.rotatedToken, ctx.rotatedExpiresAt);
      }
      if (!ctx.user) return null;
      return userPayload(ctx.user);
    },
    adminHealth: async (_: any, __: any, ctx: GraphQLContext) => {
      requireRole(ctx, "admin");
      return { ok: true, scope: "admin" };
    },
  },
  Mutation: {
    register: async (_: any, { input }: any, ctx: GraphQLContext) => {
      const ip = ctx.req?.ip || null;
      const ua = ctx.req?.get?.("user-agent") || null;
      const result = await register({ email: input.email, password: input.password, ip, userAgent: ua });
      return {
        ok: true,
        userId: result.userId,
        // Dev-only convenience: token also sent via console email provider. Remove/guard in production.
        verificationToken: config.nodeEnv === "production" ? null : result.verificationToken,
        message: "Registration successful. Verify email before using protected marketplace functions.",
      };
    },
    verifyEmail: async (_: any, { token }: any, ctx: GraphQLContext) => {
      const ip = ctx.req?.ip || null;
      await verifyEmail({ token, ip });
      return { ok: true, message: "Email verified." };
    },
    login: async (_: any, { input }: any, ctx: GraphQLContext) => {
      const ip = ctx.req?.ip || null;
      const ua = ctx.req?.get?.("user-agent") || null;
      const result = await login({ email: input.email, password: input.password, ip, userAgent: ua });
      setSessionCookie(ctx, result.sessionToken, result.expiresAt);
      return { ok: true, user: userPayload(result.user) };
    },
    logout: async (_: any, __: any, ctx: GraphQLContext) => {
      await logout(ctx.sessionToken, ctx.user?.id || null);
      clearSessionCookie(ctx);
      return { ok: true };
    },
    requestPasswordReset: async (_: any, { email }: any, ctx: GraphQLContext) => {
      const ip = ctx.req?.ip || null;
      await requestPasswordReset({ email, ip });
      return { ok: true, message: "If the account exists, a reset token has been sent." };
    },
    resetPassword: async (_: any, { input }: any, ctx: GraphQLContext) => {
      const ip = ctx.req?.ip || null;
      await resetPassword({ token: input.token, newPassword: input.newPassword, ip });
      clearSessionCookie(ctx);
      return { ok: true, message: "Password reset successful. Please log in again." };
    },
  },
};

// Context helper exported for server wiring
export async function buildAuthContext(req: any, res: any): Promise<GraphQLContext> {
  const token = req?.cookies?.[config.session.cookieName] || null;
  if (!token) return { req, res, user: null, sessionToken: null };
  const auth = await authenticateSession(token);
  if (!auth) return { req, res, user: null, sessionToken: token };
  const ctx: GraphQLContext & { rotatedToken?: string; rotatedExpiresAt?: Date } = {
    req,
    res,
    user: auth.user,
    sessionToken: auth.rotatedToken || token,
  };
  if (auth.rotatedToken) {
    ctx.rotatedToken = auth.rotatedToken;
    ctx.rotatedExpiresAt = auth.rotatedExpiresAt;
  }
  return ctx;
}
