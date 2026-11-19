# Alert routes and on-call template (draft — no contacts assigned)

Template only. Every signal below exists in `apps/api/src/observability/` (and the gauges set from `apps/api/src/index.ts`). The on-call contact column is intentionally blank: no contact, escalation tier or rotation is invented. Alert routes, escalation and on-call are **not decided**; see `docs-implementation/decision-log.md` (§9 #9) and `docs/13 §6`.

## Metrics

| Signal | Type / labels | Source | On-call contact | Decision |
|---|---|---|---|---|
| `http_requests_total` | counter `{method, route, status_class}` | `apps/api/src/observability/metrics.ts:29`; incremented in `apps/api/src/index.ts` |  | Decision: pending (decision-log: FR-???, operations) |
| `http_request_duration_ms` | histogram (buckets 10/50/100/500/1000/5000 ms) | `apps/api/src/observability/metrics.ts:37`, `:63–70` |  | Decision: pending (decision-log: FR-???, operations) |
| `bid_outcomes_total` | counter `{outcome: accepted\|rejected}` | `apps/api/src/observability/metrics.ts:82–86` |  | Decision: pending (decision-log: FR-???, operations) |
| `consumer_batch_failures_total` | counter `{consumer}` | `apps/api/src/observability/metrics.ts:89–90` |  | Decision: pending (decision-log: FR-???, operations) |
| `outbox_unpublished_rows` | gauge (DB count on scrape) | `apps/api/src/observability/metrics.ts:45`; set in `apps/api/src/index.ts` |  | Decision: pending (decision-log: FR-???, operations) |
| `outbox_oldest_unpublished_age_seconds` | gauge (injected-clock age on scrape) | `apps/api/src/observability/metrics.ts:45`; set in `apps/api/src/index.ts` |  | Decision: pending (decision-log: FR-???, operations) |

## Health checks

| Check | Behaviour | Source | On-call contact | Decision |
|---|---|---|---|---|
| `liveness()` — `GET /health/live` | 200 when the process is up; no dependency access | `apps/api/src/observability/health.ts:28` |  | Decision: pending (decision-log: FR-???, operations) |
| `readiness()` — `GET /health/ready` | 200/503 from both dependency checks | `apps/api/src/observability/health.ts:32` |  | Decision: pending (decision-log: FR-???, operations) |
| readiness sub-check: `postgres` | `ok`/`fail`, no error text or connection string | `apps/api/src/observability/health.ts:35`, `:40` |  | Decision: pending (decision-log: FR-???, operations) |
| readiness sub-check: `redis` | `ok`/`fail`, no error text or connection string | `apps/api/src/observability/health.ts:36`, `:40` |  | Decision: pending (decision-log: FR-???, operations) |

No alert rules, routes, escalation tiers or on-call rotations are configured by this template. No monitoring vendor or external SaaS is added.
