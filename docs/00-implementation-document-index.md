# AliAuction.ca — Implementation Documentation Index

**Product:** AliAuction.ca  
**Company:** AliAuction Inc.  
**Source business plan:** AliAuction.ca Business Plan 2026–2029, prepared April 2026  
**Document set:** Software implementation planning pack  
**Status:** Draft for product, engineering, design and business review  
**Classification:** Confidential — For Authorized Recipients Only

## Purpose

This documentation pack translates the supplied business plan into a practical software-development blueprint for a working web application. It is intended to guide product discovery, UX/UI design, backend and frontend implementation, database design, integrations, QA and deployment.

The business plan is the source for the business concept, proposed technology stack, revenue model, planned capabilities and high-level delivery phases. Where the business plan does not define implementation-level behaviour, this pack labels the item as an **assumption**, **proposal** or **decision required** rather than presenting it as an approved business rule.

## Documents

| File | Purpose |
|---|---|
| `01-product-requirements-document.md` | Product vision, goals, scope, functional and non-functional requirements, acceptance criteria |
| `02-epics-user-stories.md` | Epics, user stories and testable acceptance criteria |
| `03-system-architecture.md` | Proposed application architecture, services, deployment topology and data flows |
| `04-database-design.md` | PostgreSQL entities, relationships, constraints, indexes and data lifecycle |
| `05-postgresql-starter-schema.sql.md` | Starter SQL DDL for core entities; review and split into migrations before production |
| `06-api-specification.md` | API conventions, GraphQL domains, sample operations, errors and real-time events |
| `07-auction-engine-and-business-rules.md` | Auction lifecycle, bidding, proxy bidding, increments, reserves, extensions and settlement rules |
| `08-user-flows-and-screen-inventory.md` | Key journeys and screen inventory for web application UX |
| `09-roles-permissions-and-admin.md` | Roles, permission matrix and administrative controls |
| `10-security-privacy-and-compliance.md` | Security requirements, privacy controls, payment boundaries and compliance workstream |
| `11-third-party-integrations.md` | Payments, shipping, email/SMS, search, analytics and AI integration plans |
| `12-frontend-implementation-guide.md` | Next.js application structure, state, forms, accessibility and responsive UI |
| `13-devops-and-deployment-plan.md` | Environments, Docker, CI/CD, AWS Canada, Kubernetes, observability and backups |
| `14-testing-and-quality-plan.md` | Test strategy, critical scenarios, performance, security and release gates |
| `15-delivery-roadmap.md` | Phased implementation plan, milestones, dependencies and definition of done |
| `16-assumptions-decisions-and-open-questions.md` | Items that must be decided before or during implementation |

## How to use this pack

1. Review the PRD and the assumptions/open-questions register with the business owner.
2. Confirm MVP scope and explicitly defer later-phase features.
3. Approve the auction and payment rules before implementing bid settlement or charging users.
4. Review the data model and SQL with the backend engineer before creating production migrations.
5. Convert user stories into tickets with owners, estimates and sprint milestones.
6. Use the testing and release documents as mandatory acceptance gates.

## Source-derived baseline

The supplied business plan proposes:
- React.js / Next.js, Tailwind CSS and a PWA for the web experience.
- Node.js with Express, GraphQL, PostgreSQL, Redis and Socket.io.
- AWS Canada (`ca-central-1`) infrastructure.
- Stripe Connect and PayPal Business for payments.
- Elasticsearch for search.
- React Native mobile applications in a later phase.
- Docker, Kubernetes, GitHub Actions and Datadog for DevOps/monitoring.
- Timed auctions, proxy bidding, seller dashboards, watchlists, notifications, shipping labels, live auctions, recommendations, escrow for high-value items, image categorization and fraud detection.

These are the plan's proposed choices, not proof that services, contracts, compliance controls or integrations are already active.

## Important implementation warning

This is a planning specification, not a legal opinion, final security certification, production-ready payment/escrow design or complete executable application. Payment flows, escrow terminology, privacy obligations, taxes, consumer protection, marketplace liability, auction law, refunds and seller verification require qualified Canadian legal, tax, payment and compliance review before launch.
