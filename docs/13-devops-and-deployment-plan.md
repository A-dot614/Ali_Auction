# DevOps and Deployment Plan

**Source-plan technologies:** Docker, Kubernetes, GitHub Actions, Datadog and AWS Canada.

## 1. Environments

Recommended:
- Local development.
- Shared development integration.
- Staging / pre-production.
- Production.

Use separate databases, storage buckets, credentials and payment-provider accounts for each environment. Production personal data must not be copied into lower environments unless properly anonymized and approved.

## 2. Containerization

Create separate container images or process targets for:
- Next.js web application.
- Node.js API.
- Socket.io gateway (may share API process initially).
- Background worker.
- Scheduled job runner.

Containers should:
- Run as non-root.
- Use pinned dependencies and reproducible builds.
- Include health checks.
- Handle graceful shutdown.
- Receive configuration through environment/secrets management.
- Avoid storing persistent user data inside the container filesystem.

## 3. CI/CD pipeline

Suggested pipeline:
1. Install dependencies using lockfiles.
2. Format and lint.
3. Run type checks.
4. Run unit tests.
5. Run integration tests with ephemeral PostgreSQL/Redis.
6. Run security and dependency scans.
7. Build container images.
8. Scan images.
9. Push immutable image tags.
10. Deploy to staging.
11. Run smoke and end-to-end tests.
12. Require approval for production deployment.
13. Deploy with health checks and rollback/forward-fix strategy.

Database migrations must be reviewed and deployed in a backward-compatible sequence.

## 4. AWS deployment baseline

The business plan identifies AWS Canada `ca-central-1`, including EC2, S3, CloudFront and RDS.

Proposed components:
- VPC and private networking.
- Load balancer / ingress.
- Container runtime or Kubernetes cluster.
- Managed PostgreSQL.
- Managed Redis-compatible cache.
- S3 buckets for media and backups.
- CloudFront/CDN.
- Secrets manager and KMS.
- Cloud monitoring/logging.
- Backup and disaster-recovery setup.

Confirm service availability and region/data residency for each component before choosing the final topology.

## 5. Kubernetes adoption

Kubernetes is part of the source plan's proposed DevOps stack. Use it only when the team can operate it securely.

Production readiness includes:
- Resource requests and limits.
- Liveness/readiness/startup probes.
- Pod disruption budgets.
- Horizontal scaling policy.
- Network policies.
- Secrets integration.
- Ingress and TLS.
- Cluster upgrades and patching.
- Centralized logs and metrics.
- Backup strategy for stateful services.
- Incident and rollback runbooks.

Do not run PostgreSQL or Redis in Kubernetes without a deliberate stateful operations strategy; managed services may reduce operational burden.

## 6. Observability

The source names Datadog. Monitor:
- API request rate, latency and error rate.
- GraphQL operation latency and complexity.
- Active socket connections and event delivery.
- Bid acceptance/rejection and contention.
- Auction close job delay/failure.
- Payment webhook lag and reconciliation mismatch.
- Worker queue depth and dead-letter count.
- Database connections, slow queries and locks.
- Cache hit rate.
- Search indexing lag.
- Container health and resource saturation.

Create alerts for payment failures, auction-close failures, unusually high bid rejection rates, queue backlog, database saturation and security events.

## 7. Backups and recovery

Define with the business owner:
- Recovery Point Objective (RPO).
- Recovery Time Objective (RTO).
- Backup frequency and retention.
- Cross-account or isolated backup strategy.
- Encryption and access control.
- Restore-test frequency.
- Disaster-recovery owner and runbook.

A backup is not considered reliable until restoration has been tested.

## 8. Release and rollback

- Use feature flags for high-risk capabilities.
- Deploy progressively where possible.
- Keep schema changes backward compatible.
- Monitor after release.
- Roll back application images when safe.
- Prefer forward fixes for irreversible data migrations.
- Maintain an incident communication process.
