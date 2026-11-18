import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { openDispute } from "../src/disputes/service.js";
import { makePaidOrder, resetDisputeDb } from "./dispute-helpers.js";

describe("dispute evidence window (Slice 12, placeholder docs/16 §8 #4)", () => {
  beforeEach(async () => {
    await resetDisputeDb();
  });

  it("evidence window: a date inside the window is allowed, a date outside is rejected (injected clock)", async () => {
    const { seller, order } = await makePaidOrder();

    const inside = await openDispute(
      { id: seller.userId, roles: seller.roles },
      {
        orderId: order.id,
        reasonCode: "damaged",
        description: "Inside the placeholder evidence window.",
        requestId: randomUUID(),
      },
      { clock: () => new Date(Date.now() + 10 * 86_400_000) }
    );
    expect(inside.created).toBe(true);
    expect(inside.dispute.status).toBe("open");

    // A separate order is required because one open dispute per order is allowed.
    const second = await makePaidOrder();
    await expect(
      openDispute(
        { id: second.seller.userId, roles: second.seller.roles },
        {
          orderId: second.order.id,
          reasonCode: "damaged",
          description: "Outside the placeholder evidence window.",
          requestId: randomUUID(),
        },
        { clock: () => new Date(Date.now() + 31 * 86_400_000) }
      )
    ).rejects.toThrow(/INVALID_DISPUTE_STATE/);
  });
});
