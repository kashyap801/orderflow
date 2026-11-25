# Technical decisions (ADRs)

Each decision: context → decision → trade-off. Revise here when implementation changes.

> **Simplified scope:** ADR-005, ADR-006, ADR-012, ADR-016 and ADR-017 describe deferred advanced
> patterns and are kept as interview reference only. The current simple choices are summarised in
> [simple-architecture.md](simple-architecture.md).

### ADR-001 — npm workspaces monorepo
**Context:** multiple services and shared types. **Decision:** plain npm workspaces
(`apps/*`, `libs/*`) with a single lockfile and `tsconfig.base.json` path aliases.
**Trade-off:** less tooling than Nx/Turborepo (no task graph/cache), but fully transparent and no
extra dependency. Build/lint scripts use `--workspaces --if-present`.

### ADR-002 — Four domain services + one edge gateway
**Context:** brief says four microservices but lists five components. **Decision:** Order, Inventory,
Payment, Notification are the four domain microservices; API Gateway is edge infrastructure with no
business DB. **Trade-off:** gateway is still independently deployable, but not counted as a domain
service. Documented in README to avoid confusion.

### ADR-003 — Identity owned by Order Service
**Context:** registration/login required, but no Auth service in the agreed count. **Decision:**
`users` collection and JWT issuance live in Order Service; gateway verifies JWT statelessly.
**Trade-off:** identity is coupled to order domain and all services share the JWT secret; extracting
an Auth service later is a contained change (one collection + auth module).

### ADR-004 — Separate MongoDB databases, one cluster
**Context:** data ownership requirement. **Decision:** four MongoDB databases (`orderflow_*`) in one
cluster; one Mongoose schema set per service; no cross-service collection reads or `$lookup`; UUID
string references only.
**Trade-off:** strong ownership with simple local setup; one cluster is a local SPOF (fine for dev).
Atlas can split services into separate clusters later without code changes to the contracts.

### ADR-005 — Saga orchestration in Order Service
**Context:** multi-service order workflow with compensations. **Decision:** orchestration with
explicit state machine and guarded transitions; services publish facts.
**Trade-off:** coordinator logic is centralized (testable), but Order Service is more complex than
pure choreography. Mitigated by keeping logic in a state machine + small handlers, not one giant class.

### ADR-006 — Transactional outbox with polling relay
**Context:** avoid losing events between DB commit and Kafka publish. **Decision:** outbox collection
+ relay polling with a `lockedUntil` lease (~1 s), no Debezium.
**Trade-off:** simple and dependency-free; slightly higher latency and DB polling load vs CDC.

### ADR-007 — Atomic document update for concurrency
**Context:** prevent overselling under concurrent reservations. **Decision:** one MongoDB
`updateOne` with `$inc` and an `{ availableQuantity: { $gte: qty } }` filter inside a Mongoose
session, plus schema `min: 0` validators.
**Trade-off:** DB is authoritative and correct; Redis reservation locks are optional optimization
only and never a source of truth.

### ADR-008 — Redis for cache and coordination only
**Context:** Redis requested. **Decision:** catalogue cache (TTL 300 s, invalidated on product
change), rate limiting, optional short-lived per-product lock. No payments or inventory truth.
**Trade-off:** stale catalogue possible for ≤TTL; documented and acceptable for product names/prices,
but checkout re-validates price against the service.

### ADR-009 — JWT verification at gateway and services
**Context:** internal services must not be callable by outsiders. **Decision:** shared HS256 secret
from env; gateway validates for routing/RBAC, services validate again (defence in depth); internal
ports unexposed in Compose.
**Trade-off:** secret distribution must be managed; no key rotation endpoint yet.

### ADR-010 — Explicit payment simulation flag
**Context:** realistic payment demo without a real provider. **Decision:** checkout may carry
`simulateFailure?: boolean`, stored on the order and passed in the payment command; otherwise
payments succeed. Fixed response delay up to `PAYMENT_SIMULATION_MAX_DELAY_MS`.
**Trade-off:** deterministic testable failure path; the flag is demo-only and must never exist in a
real payment integration.

### ADR-011 — Client-side cart
**Context:** cart page required, no Cart service agreed. **Decision:** localStorage cart; server
re-prices items at checkout from Inventory. **Trade-off:** no cross-device sync; simpler architecture.

### ADR-012 — At-least-once + idempotency everywhere
**Context:** Kafka duplicates and client retries. **Decision:** dedupe keys at HTTP, reservation,
payment, consumer and notification layers (see event docs).
**Trade-off:** extra collections and indexes; eliminates double orders, double charges and duplicate mail.

### ADR-013 — Tight dependency set
**Context:** "avoid unnecessary libraries". **Decision:** no Nx/Turborepo, no native `bcrypt` (use
`bcryptjs`), no `nestjs-pino` (thin JSON logger), no Testcontainers (tests use Compose infra),
no Kafka UI, no migration tool. Mongoose is the only added ODM dependency; Swagger via
`@nestjs/swagger`.
**Trade-off:** slightly more glue code, fewer opaque tools and simpler CI.

### ADR-014 — API versioning in URL, events in topic suffix
**Context:** compatible evolution. **Decision:** `/api/v1/...` at gateway; `*.v1` topics plus
`version` in envelope.
**Trade-off:** two places to bump for breaking changes, but both are explicit.

### ADR-015 — Integer cents in MongoDB, string transport in events
**Context:** currency precision without extra libraries. **Decision:** money is stored as integer
minor units (`amountCents: number`, safe-integer validation); events carry decimal strings produced
by one shared formatter; the UI formats cents for display.
**Trade-off:** one conversion helper; no floating-point money bugs and no BSON `Decimal128`
serialization complexity.

### ADR-016 — Refund-before-release
**Context:** cancellation of a paid order. **Decision:** refund completes before stock is released;
failed refund restores `CONFIRMED`. Added `payment.refund.failed.v1` event.
**Trade-off:** slightly longer cancellation flow; avoids freeing stock for a charged customer.

### ADR-017 — MongoDB replica set for transactions
**Context:** the saga needs atomic state change + outbox insert per service. **Decision:** use
Mongoose sessions / multi-document transactions; local Compose runs MongoDB as a single-node
replica set `rs0`, hosted uses Atlas M10+ (verify tier support before choosing a cheaper tier).
**Trade-off:** slightly more setup than a standalone mongod, but atomicity without distributed
transactions.

### ADR-018 — Embed 1:few owned data
**Context:** order items, product stock and payment transactions are always read with their parent
and have no independent lifecycle. **Decision:** embed `items` in `orders`, stock fields in
`products`, and `transactions` in `payments`; keep unbounded/time-bound data (`order_status_history`,
`reservations`) in separate collections.
**Trade-off:** no cross-collection joins and simpler transactions; embedded arrays must stay small
and are validated by DTO/schema rules.

### ADR-019 — Managed hosting split
**Context:** frontend and long-running backend services have different deployment needs.
**Decision:** GitHub source + Actions CI gates; Vercel hosts the static React app; Render hosts the
five backend Docker services; MongoDB Atlas, Upstash Redis and Confluent Cloud provide managed data
infrastructure.
**Trade-off:** multiple vendor dashboards and cost, but independent deploys and no self-managed
stateful infrastructure. Local Docker Compose mirrors the topology.
