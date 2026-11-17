import { describe, expect, it } from "vitest";
import { graphql, GraphQLNonNull } from "graphql";
import { schema } from "../src/graphql/schema.js";

const FIXED = new Date("2026-11-17T12:34:56.000Z");

describe("serverTime (Slice 9)", () => {
  it("serverTime returns the injected clock value", async () => {
    const result = await graphql({
      schema,
      source: `{ serverTime }`,
      contextValue: { serverClock: () => FIXED },
    });
    expect(result.errors).toBeUndefined();
    expect((result.data as any).serverTime).toBe(FIXED.toISOString());
  });

  it("serverTime is a DateTime scalar and requires no authentication", async () => {
    const queryType: any = (schema as any).getQueryType();
    const field = queryType.getFields().serverTime;
    expect(field.type).toBeInstanceOf(GraphQLNonNull);
    expect(field.type.ofType.name).toBe("DateTime");
    const result = await graphql({ schema, source: `{ serverTime }` });
    expect(result.errors).toBeUndefined();
  });
});
