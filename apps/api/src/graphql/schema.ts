import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from "graphql";
import { identityResolvers } from "./resolvers/identity.js";

const HealthType = new GraphQLObjectType({
  name: "Health",
  fields: {
    status: { type: GraphQLString },
    service: { type: GraphQLString },
    databaseConfigured: { type: GraphQLBoolean },
    redisConfigured: { type: GraphQLBoolean },
  },
});

const UserType = new GraphQLObjectType({
  name: "User",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    email: { type: new GraphQLNonNull(GraphQLString) },
    status: { type: new GraphQLNonNull(GraphQLString) },
    emailVerified: { type: new GraphQLNonNull(GraphQLBoolean) },
    roles: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))) },
  },
});

const AuthPayload = new GraphQLObjectType({
  name: "AuthPayload",
  fields: {
    ok: { type: new GraphQLNonNull(GraphQLBoolean) },
    user: { type: UserType },
  },
});

const RegisterPayload = new GraphQLObjectType({
  name: "RegisterPayload",
  fields: {
    ok: { type: new GraphQLNonNull(GraphQLBoolean) },
    userId: { type: GraphQLID },
    verificationToken: { type: GraphQLString },
    message: { type: GraphQLString },
  },
});

const MessagePayload = new GraphQLObjectType({
  name: "MessagePayload",
  fields: {
    ok: { type: new GraphQLNonNull(GraphQLBoolean) },
    message: { type: GraphQLString },
  },
});

const AdminHealthType = new GraphQLObjectType({
  name: "AdminHealth",
  fields: {
    ok: { type: new GraphQLNonNull(GraphQLBoolean) },
    scope: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const RegisterInput = new GraphQLInputObjectType({
  name: "RegisterInput",
  fields: {
    email: { type: new GraphQLNonNull(GraphQLString) },
    password: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const LoginInput = new GraphQLInputObjectType({
  name: "LoginInput",
  fields: {
    email: { type: new GraphQLNonNull(GraphQLString) },
    password: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const ResetPasswordInput = new GraphQLInputObjectType({
  name: "ResetPasswordInput",
  fields: {
    token: { type: new GraphQLNonNull(GraphQLString) },
    newPassword: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const QueryType = new GraphQLObjectType({
  name: "Query",
  fields: {
    health: {
      type: HealthType,
      resolve: () => ({
        status: "ok",
        service: "aliauction-api",
        databaseConfigured: Boolean(process.env.DATABASE_URL),
        redisConfigured: Boolean(process.env.REDIS_URL),
      }),
    },
    phase: {
      type: GraphQLString,
      resolve: () =>
        "Phase 1 MVP: identity & access slice in progress. See docs/15-delivery-roadmap.md and docs-implementation/PHASE1_STATUS.md.",
    },
    me: { type: UserType, resolve: identityResolvers.Query.me },
    adminHealth: { type: AdminHealthType, resolve: identityResolvers.Query.adminHealth },
  },
});

const MutationType = new GraphQLObjectType({
  name: "Mutation",
  fields: {
    register: {
      type: new GraphQLNonNull(RegisterPayload),
      args: { input: { type: new GraphQLNonNull(RegisterInput) } },
      resolve: identityResolvers.Mutation.register,
    },
    verifyEmail: {
      type: new GraphQLNonNull(MessagePayload),
      args: { token: { type: new GraphQLNonNull(GraphQLString) } },
      resolve: identityResolvers.Mutation.verifyEmail,
    },
    login: {
      type: new GraphQLNonNull(AuthPayload),
      args: { input: { type: new GraphQLNonNull(LoginInput) } },
      resolve: identityResolvers.Mutation.login,
    },
    logout: {
      type: new GraphQLNonNull(MessagePayload),
      resolve: identityResolvers.Mutation.logout,
    },
    requestPasswordReset: {
      type: new GraphQLNonNull(MessagePayload),
      args: { email: { type: new GraphQLNonNull(GraphQLString) } },
      resolve: identityResolvers.Mutation.requestPasswordReset,
    },
    resetPassword: {
      type: new GraphQLNonNull(MessagePayload),
      args: { input: { type: new GraphQLNonNull(ResetPasswordInput) } },
      resolve: identityResolvers.Mutation.resetPassword,
    },
  },
});

export const schema = new GraphQLSchema({ query: QueryType, mutation: MutationType });
