# Observability and security flows (Slice 10)

Text-only reference for workstream 12. All placeholders are NOT FOR PRODUCTION; retention is OPEN (docs/16 §7 #7).

## Request flow: requestId and redaction

```
incoming HTTP request
   |
   +--> x-request-id header (valid UUID?) -> keep
   |     otherwise -> generated UUID
   |     echo value in response header x-request-id
   |
   +--> express.json -> requestLogging middleware
   |     log on finish: { level, msg, time(injected clock), requestId,
   |                       method, path (NO query), status, duration_ms, operationName? }
   |     logger.redact() recursively applies deny-list BEFORE serialisation
   |     NEVER logs: body, variables, other headers, query strings, secrets
   |
   +--> GraphQL validationRules: depthLimitRule(10, placeholder)
   |     production: formatError strips stack/exception data
   |
   +--> response (no stack trace field)
```

## Metrics and health endpoints

```
GET /metrics
   Authorization: Bearer METRICS_TOKEN ?
     no  -> 401 { error: { code: UNAUTHORIZED } }
     yes -> read outbox_unpublished_rows (SELECT count)
            compute outbox_oldest_unpublished_age_seconds from injected clock
            render Prometheus text (counters, histogram, gauges)
            labels: stable values only (no ids, emails, free text)

GET /health/live   -> 200 { status: ok }  (no dependency access)
GET /health/ready  -> PostgreSQL SELECT 1 + Redis PING (timeout 2000ms placeholder)
                      200 { status: ok, checks: {postgres: ok, redis: ok} }
                      503 { status: fail, checks: {postgres: ok|fail, redis: ok|fail} }
                      no error text, hostnames or connection strings
GET /health        -> unchanged legacy response
```

## Account deletion request flow (D7)

```
user calls requestAccountDeletion(reason?) [service only, no end-user GraphQL mutation]
   |
   +--> account closed -> record nothing
   +--> suspended/active -> allowed
   |
   +--> INSERT account_deletion_requests(status='requested', requested_at=injected clock)
          ON CONFLICT (user_id) WHERE status='requested' DO NOTHING
          conflict -> return existing id, write nothing
          success  -> one audit_logs row (account_deletion_requested)
   |
   +--> NOTHING deleted, anonymised, or revoked; fulfilment/retention OPEN (docs/16 §7 #7)
```

## CI security scanning (D8)

```
pnpm install --frozen-lockfile
   -> pnpm -r typecheck / lint
   -> Dependency audit: pnpm audit --prod --audit-level=high   (must fail visibly)
   -> Secret scan: grep patterns over git ls-files, allowlist excluded
   -> migrate up / test / build / migration roundtrip
```

No third-party action requiring a token; no `continue-on-error`.
