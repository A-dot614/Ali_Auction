import { describe, expect, it } from "vitest";
import {
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  GraphQLError,
  parse,
  validate,
  graphql,
} from "graphql";
import { depthLimitRule, productionFormatError, DEPTH_LIMIT_CODE } from "../src/graphql/limits.js";

describe("GraphQL limits and production errors (Slice 10)", () => {
  it("graphql depth limit: query deeper than 10 is rejected with a stable code", () => {
    const deep = parse("{ a { b { c { d { e { f { g { h { i { j { k { l } } } } } } } } } } } }");
    const errors = validate(new GraphQLSchema({ query: new GraphQLObjectType({ name: "Q", fields: { a: { type: GraphQLString } } }) }), deep, [
      depthLimitRule(10),
    ]);
    expect(errors.some((e) => e.message.includes(DEPTH_LIMIT_CODE))).toBe(true);

    const shallow = parse("{ a }");
    const ok = validate(
      new GraphQLSchema({ query: new GraphQLObjectType({ name: "Q", fields: { a: { type: GraphQLString } } }) }),
      shallow,
      [depthLimitRule(10)]
    );
    expect(ok).toEqual([]);
  });

  it("production error output: no stack trace field in GraphQL errors when NODE_ENV is production", async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const throwingSchema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: "Query",
          fields: {
            boom: {
              type: GraphQLString,
              resolve() {
                throw new Error("SECRET-DETAIL: user@example.com password hunter2\nstack trace line");
              },
            },
          },
        }),
      });
      const result = await graphql({ schema: throwingSchema, source: "{ boom }" });
      const raw = result.errors?.[0] as GraphQLError | undefined;
      expect(raw).toBeDefined();
      const formatted = productionFormatError(raw!) as GraphQLError;
      const serialized = formatted.toJSON() as any;
      expect(serialized.extensions?.exception).toBeUndefined();
      expect(serialized.extensions?.stacktrace).toBeUndefined();
      expect(Object.keys(serialized)).not.toContain("stacktrace");
      expect(serialized.extensions?.code).toBe("INTERNAL_ERROR");
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});
