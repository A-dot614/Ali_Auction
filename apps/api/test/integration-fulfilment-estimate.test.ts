import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gql, makePaidOrder, registerVerifyLogin, resetDisputeDb } from "./dispute-helpers.js";

/** A1 (FR-051): display-only placeholder fulfilment estimate (docs/16 §6 OPEN). */

const PREVIOUS = process.env.FULFILMENT_FLAT_ESTIMATE_MINOR;

describe("fulfilment estimate (FR-051, NOT FOR PRODUCTION placeholder)", () => {
  beforeEach(async () => {
    await resetDisputeDb();
    process.env.FULFILMENT_FLAT_ESTIMATE_MINOR = "999";
  });
  afterEach(() => {
    if (PREVIOUS === undefined) delete process.env.FULFILMENT_FLAT_ESTIMATE_MINOR;
    else process.env.FULFILMENT_FLAT_ESTIMATE_MINOR = PREVIOUS;
  });

  it("estimate is returned to the buyer", async () => {
    const { buyer, order } = await makePaidOrder();
    const res = await gql({
      query: `query($id:ID!){ order(id:$id){ id estimatedShippingMinor estimateBasis totalMinor } }`,
      variables: { id: order.id },
      cookie: buyer.cookie,
    });
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.order.estimatedShippingMinor).toBe("999");
    expect(res.body.data.order.estimateBasis).toBe("PLACEHOLDER_FLAT");
  });

  it("NOT_FOUND for a non-participant", async () => {
    const { order } = await makePaidOrder();
    const outsider = await registerVerifyLogin("estimate-outsider");
    const res = await gql({
      query: `query($id:ID!){ order(id:$id){ id estimatedShippingMinor } }`,
      variables: { id: order.id },
      cookie: outsider.cookie,
    });
    expect(res.body.errors?.[0]?.message || "").toContain("NOT_FOUND");
  });

  it("estimate is never added to total_minor", async () => {
    const { buyer, order } = await makePaidOrder();
    const res = await gql({
      query: `query($id:ID!){ order(id:$id){ estimatedShippingMinor hammerPriceMinor feeTotalMinor totalMinor } }`,
      variables: { id: order.id },
      cookie: buyer.cookie,
    });
    expect(res.body.errors).toBeUndefined();
    const view = res.body.data.order;
    expect(view.estimatedShippingMinor).toBe("999");
    // Fee and total rules are unchanged: total = hammer + fee, with no estimate added.
    expect(Number(view.totalMinor)).toBe(Number(view.hammerPriceMinor) + Number(view.feeTotalMinor));
    expect(Number(view.totalMinor)).not.toBe(Number(view.hammerPriceMinor) + Number(view.feeTotalMinor) + 999);
  });
});
