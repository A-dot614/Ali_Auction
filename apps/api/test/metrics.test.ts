import { describe, expect, it } from "vitest";
import { MetricsRegistry, recordBidOutcome, recordConsumerFailure, assertSafeLabel } from "../src/observability/metrics.js";

describe("metrics registry (Slice 10)", () => {
  it("metrics: counters increment with stable labels; no label contains an ID, email, or free text", () => {
    const registry = new MetricsRegistry();
    registry.increment("http_requests_total", { method: "POST", route: "/graphql", status_class: "2xx" });
    registry.increment("http_requests_total", { method: "POST", route: "/graphql", status_class: "2xx" });
    recordBidOutcome("accepted", registry);
    recordBidOutcome("rejected", registry);
    recordConsumerFailure("notifications", registry);
    registry.observe("http_request_duration_ms", 12);
    registry.setGauge("outbox_unpublished_rows", 3);

    const text = registry.render();
    expect(text).toContain('http_requests_total{method="POST",route="/graphql",status_class="2xx"} 2');
    expect(text).toContain('bid_outcomes_total{outcome="accepted"} 1');
    expect(text).toContain('consumer_batch_failures_total{consumer="notifications"} 1');
    expect(text).toContain("outbox_unpublished_rows 3");
    expect(text).toMatch(/http_request_duration_ms_bucket/);

    for (const bad of [
      "123e4567-e89b-42d3-a456-426614174000",
      "user@example.com",
      "some free text",
    ]) {
      expect(() => assertSafeLabel("x", bad)).toThrow(/VALIDATION_ERROR/);
    }
    expect(() => recordBidOutcome("user-123", registry)).toThrow(/VALIDATION_ERROR/);
  });
});
