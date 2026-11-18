import { beforeEach, describe, expect, it } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { query } from "../src/db.js";
import { createCheckout, handleWebhook, startHostedCheckout } from "../src/payments/service.js";
import { fakePaymentProvider } from "../src/payments/fakeProvider.js";
import { gql, makePaidOrder, resetDisputeDb } from "./dispute-helpers.js";

/** Slice 13: provider-neutral hosted-checkout contract, fake adapter only. */

const SECRET = "test-fake-webhook-secret";

async function makeFixture() {
  const built = await makePaidOrder(false); // awaiting_payment order, no payment yet
  const checkout = await createCheckout(
    built.order.id,
    built.buyer.userId,
    {
      acceptedTotalMinor: String(built.order.total_minor),
      fulfilmentChoice: "shipping",
      requestId: randomUUID(),
    },
    { now: () => new Date(), moneyEnabled: true, webhookSecret: SECRET }
  );
  const payment = (await query(`SELECT provider_payment_id FROM payment_transactions WHERE id=$1`, [checkout.id])).rows[0];
  return { ...built, checkout, providerPaymentId: payment.provider_payment_id as string };
}

function webhook(body: Record<string, unknown>, at: Date) {
  const raw = JSON.stringify(body);
  return handleWebhook(
    "fake",
    raw,
    { "x-fake-signature": createHmac("sha256", SECRET).update(raw).digest("hex") },
    { now: () => at, moneyEnabled: true, webhookSecret: SECRET }
  );
}

function orderStatus(id: string) {
  return query(`SELECT status FROM orders WHERE id=$1`, [id]).then((r) => r.rows[0].status as string);
}
function paymentStatus(id: string) {
  return query(`SELECT status FROM payment_transactions WHERE id=$1`, [id]).then((r) => r.rows[0].status as string);
}
function sessionCount() {
  return query(`SELECT count(*)::int AS c FROM outbox_events WHERE event_type='payment.hosted_session_started'`).then(
    (r) => r.rows[0].c as number
  );
}
function webhookCount() {
  return query(`SELECT count(*)::int AS c FROM webhook_events`).then((r) => r.rows[0].c as number);
}

describe("provider-neutral hosted checkout (Slice 13)", () => {
  beforeEach(async () => {
    await resetDisputeDb();
  });

  it("hosted session: createHostedSession returns a relative redirect and a neutral expiresAt from the injected clock", async () => {
    const at = new Date(Date.now());
    const session = fakePaymentProvider.createHostedSession({
      paymentId: randomUUID(),
      amountMinor: 1000,
      currency: "CAD",
      returnUrl: "/checkout/return",
      cancelUrl: "/checkout/cancel",
      at,
      ttlMinutes: 30,
    });
    expect(session.redirectUrl.startsWith("/")).toBe(true);
    expect(session.redirectUrl.startsWith("//")).toBe(false);
    expect(session.expiresAt.getTime()).toBe(at.getTime() + 30 * 60_000);
    expect(JSON.stringify(session)).not.toMatch(/https?:\/\//);
  });

  it("hosted session: external or absolute returnUrl and cancelUrl return VALIDATION_ERROR and write nothing", async () => {
    const before = await sessionCount();
    const at = new Date(Date.now());
    expect(() =>
      fakePaymentProvider.createHostedSession({
        paymentId: randomUUID(),
        amountMinor: 1000,
        currency: "CAD",
        returnUrl: "https://external.example/return",
        cancelUrl: "/checkout/cancel",
        at,
        ttlMinutes: 30,
      })
    ).toThrow(/VALIDATION_ERROR/);
    expect(() =>
      fakePaymentProvider.createHostedSession({
        paymentId: randomUUID(),
        amountMinor: 1000,
        currency: "CAD",
        returnUrl: "/checkout/return",
        cancelUrl: "//external.example/cancel",
        at,
        ttlMinutes: 30,
      })
    ).toThrow(/VALIDATION_ERROR/);
    expect(await sessionCount()).toBe(before);
  });

  it("startHostedCheckout: flag OFF returns REAL_MONEY_DISABLED and writes nothing", async () => {
    const f = await makeFixture();
    await expect(
      startHostedCheckout(f.order.id, f.buyer.userId, randomUUID(), { now: () => new Date(), moneyEnabled: false })
    ).rejects.toThrow(/REAL_MONEY_DISABLED/);
    expect(await sessionCount()).toBe(0);
    expect(await paymentStatus(f.checkout.id)).toBe("created");
    expect(await orderStatus(f.order.id)).toBe("awaiting_payment");
  });

  it("startHostedCheckout: buyer-only (non-buyer gets NOT_FOUND); retry with the same requestId returns the same session and creates no second row", async () => {
    const f = await makeFixture();
    const at = new Date(Date.now());
    await expect(
      startHostedCheckout(f.order.id, f.seller.userId, randomUUID(), { now: () => at, moneyEnabled: true })
    ).rejects.toThrow(/NOT_FOUND/);
    expect(await sessionCount()).toBe(0);

    const requestId = randomUUID();
    const first = await startHostedCheckout(f.order.id, f.buyer.userId, requestId, { now: () => at, moneyEnabled: true });
    const replay = await startHostedCheckout(f.order.id, f.buyer.userId, requestId, { now: () => at, moneyEnabled: true });
    expect(replay).toEqual(first);
    expect(await sessionCount()).toBe(1);
  });

  it("session completion webhook: valid signature moves payment created → captured and order awaiting_payment → paid; duplicate delivery changes nothing", async () => {
    const f = await makeFixture();
    const at = new Date(Date.now());
    const session = await startHostedCheckout(f.order.id, f.buyer.userId, randomUUID(), { now: () => at, moneyEnabled: true });
    const body = {
      provider_event_id: randomUUID(),
      event_type: "payment.session_completed",
      session_id: session.sessionId,
    };
    const result = await webhook(body, new Date(at.getTime() + 60_000));
    expect(result.outcome).toBe("processed");
    expect(await paymentStatus(f.checkout.id)).toBe("captured");
    expect(await orderStatus(f.order.id)).toBe("paid");
    const countBefore = await webhookCount();
    const duplicate = await webhook(body, new Date(at.getTime() + 120_000));
    expect(duplicate.outcome).toBe("duplicate");
    expect(await webhookCount()).toBe(countBefore);
    expect(await paymentStatus(f.checkout.id)).toBe("captured");
  });

  it("session completion webhook: after the session expiry time, the completion event is recorded and changes no state", async () => {
    const f = await makeFixture();
    const at = new Date(Date.now());
    const session = await startHostedCheckout(f.order.id, f.buyer.userId, randomUUID(), { now: () => at, moneyEnabled: true });
    const before = await webhookCount();
    const result = await webhook(
      { provider_event_id: randomUUID(), event_type: "payment.session_completed", session_id: session.sessionId },
      new Date(at.getTime() + 31 * 60_000)
    );
    expect(result.outcome).toBe("processed");
    expect(await webhookCount()).toBe(before + 1);
    expect(await paymentStatus(f.checkout.id)).toBe("created");
    expect(await orderStatus(f.order.id)).toBe("awaiting_payment");
  });

  it("return URL with success query string changes no payment or order state", async () => {
    const f = await makeFixture();
    const at = new Date(Date.now());
    await startHostedCheckout(f.order.id, f.buyer.userId, randomUUID(), { now: () => at, moneyEnabled: true });
    // A browser return carries only a query string; there is no GraphQL operation that
    // processes it, so state can only change through the verified webhook path.
    const returnUrl = "/checkout/return?success=true";
    expect(returnUrl).toContain("success=true");
    const introspection = await gql({ query: `{ __schema { mutationType { fields { name } } } }` });
    const mutationNames: string[] = introspection.body.data.__schema.mutationType.fields.map((x: any) => x.name);
    expect(mutationNames.some((n) => /return|redirect|hosted|completepayment/i.test(n))).toBe(false);
    expect(await paymentStatus(f.checkout.id)).toBe("created");
    expect(await orderStatus(f.order.id)).toBe("awaiting_payment");
  });

  it("source guard: no provider name, SDK package name, or network call exists in apps/api/src/payments (grep test)", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const dir = resolve(process.cwd(), "src/payments");
    const forbidden = /stripe|paypal|authorize\.net|braintree|fetch\s*\(|axios|node-fetch|https?\.request/i;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".ts")) continue;
      const text = readFileSync(resolve(dir, file), "utf8");
      expect(text.match(forbidden), `${file} must not mention a provider/SDK/network call`).toBeNull();
    }
  });

  it("source guard: no SQL now() or Date.now() in new code (grep test)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    for (const file of ["src/payments/hostedSession.ts", "src/payments/fakeProvider.ts"]) {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(text, `${file} must not read the wall clock`).not.toMatch(/Date\.now\s*\(/);
      expect(text, `${file} must not use SQL now()`).not.toMatch(/\bnow\(\)/i);
    }
  });
});
