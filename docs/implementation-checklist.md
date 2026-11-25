# Implementation checklist

Update this file as work progresses. Each phase ends with a verification step.

## Phase 1 — Architecture and foundation ✅ COMPLETE

- [x] Analyse requirements; flag four-vs-five service ambiguity and resolve it
- [x] Finalize service boundaries and responsibilities
- [x] Define service-to-service communication rules
- [x] Define database ownership per service
- [x] Design Kafka topics, envelope, producers/consumers, DLQ and outbox
- [x] Design saga lifecycle and compensations
- [x] Propose monorepo folder structure
- [x] Record architectural decisions/trade-offs (ADRs)
- [x] Initialise npm-workspaces monorepo skeleton and root tooling configs
- [x] Create initial documentation and this checklist
- [x] Verify JSON configs parse and workspace structure is intact
- [x] Replaced the original relational database plan with MongoDB/Mongoose model
- [x] Updated deployment architecture: GitHub, Vercel, Render, Atlas, Upstash, Confluent
- [x] Updated `.env.example`, ADRs and local setup instructions
- [x] Architecture revision approved
- [x] Phase 2 go-ahead received

## Phase 2 — Backend foundation ✅ IMPLEMENTED

- [x] NestJS bootstrap for one runnable service: Order Service foundation
- [x] Global validation, CORS, standard success/error envelopes, exception filter and correlation IDs
- [x] `@orderflow/common`: env validation, structured logger, exception filter, correlation ID, health checks, Swagger setup and reusable Nest modules
- [x] Mongoose connection module with config-driven URI, retry, ping readiness and graceful shutdown
- [x] Redis and Kafka clients prepared as opt-in (`*_ENABLED=false` by default); no topics/consumers yet
- [x] Jest unit tests for env validation; health integration tests for liveness, readiness and 503
- [x] Local Docker Compose for MongoDB replica set `rs0`, Redis, Kafka and the backend container
- [x] README, API docs and deployment guide updated for the implemented foundation
- [x] Verify: build, typecheck, lint, format, Jest tests and local HTTP smoke test
- [x] Verify: `/health/ready` with real MongoDB, Redis and Kafka through Docker Compose
- [ ] Auth in Order Service: register/login, bcryptjs, JWT, RBAC guard (deferred)

## Phase 3 — Core microservices ✅ IMPLEMENTED (synchronous REST scope)

- [x] Shared `bootstrapService()` for uniform validation, filters, interceptor, CORS, Swagger and correlation handling
- [x] `@orderflow/testing` harness with `mongodb-memory-server` (no Compose needed for DB tests)
- [x] Order Service: create/get/customer/list/cancel, guarded status transitions, status history
- [x] Server-side pricing: Inventory lookup supplies `sku`, `name`, `priceCents`; client price/total fields rejected by DTO whitelist
- [x] Inventory Service: product CRUD/deactivate, availability checks, batch availability, atomic reserve/release/restock
- [x] Concurrency guard: conditional stock update prevents overselling; tested with parallel reservations
- [x] Payment Service: simulated success/failure, `idempotencyKey` uniqueness under racing requests, full/partial refunds, status history
- [x] Notification Service: create/history/customer retrieval, read state, simulated email sender interface, resend
- [x] API Gateway: centralized proxy routes, query/body/header forwarding, correlation propagation, upstream error normalization, `502` for unreachable services
- [x] Gateway auth integration point: resolves/forwards `authorization` and `x-user-id` without JWT verification
- [x] Per-service Swagger and health endpoints; Compose publishes 3000–3004 for local smoke tests
- [x] Unit, integration and API tests for all five deployables (insufficient stock, duplicate payments, inventory concurrency, order cancellation)
- [x] Shared `deploy/Dockerfile` with `SERVICE` build arg; Compose wires all four services + gateway
- [x] README, architecture, API and deployment docs updated for Phase 3
- [ ] Kafka consumers, saga orchestration, outbox relay, distributed order workflow (deferred)
- [ ] JWT/RBAC enforcement and Redis rate limiting (only simple auth/cache in this track)
- [ ] Frontend (simple React app in this track)

## Simplified remaining scope — current track

This is the approved short scope. Older Phase 4–7 sections below remain as reference only.

- [x] Add short current-state guide and mark advanced docs as reference
- [x] Simple JWT register/login in Order Service and verification in the gateway
- [x] Basic `USER` / `ADMIN` roles; `ADMIN` required for product changes
- [x] Minimal `ORDER_CREATED` event in `libs/contracts`
- [x] Kafka producer in Order Service and notification consumer in Notification Service
- [x] Redis product-read cache in Inventory Service with write invalidation
- [ ] Simple React frontend: login, catalogue, cart, checkout, orders, admin product form
- [ ] GitHub Actions checks and Vercel config for the frontend
- [ ] Verify: existing 79 tests plus new essential tests, Compose smoke, frontend build

## Phase 4 — Distributed systems (reference only)

- [ ] `@orderflow/contracts`: envelopes and payload types for all topics
- [ ] Outbox collection + lease-based relay in each publishing service
- [ ] Saga handlers with guarded state transitions and compensations
- [ ] Idempotent consumers, retry topics and DLQ
- [ ] Duplicate-order, duplicate-event and concurrent-reservation handling through events
- [ ] Verify: full E2E happy path + all failure scenarios from `order-lifecycle.md`

## Phase 5 — Redis and optimisation (reference only)

- [ ] Catalogue caching with TTL and invalidation
- [ ] Redis rate limiting
- [ ] Reservation expiry worker
- [ ] Query/index review; optional reservation lock benchmark
- [ ] Verify: load/concurrency tests show no oversell and expected cache hits

## Phase 6 — Frontend (reference only)

- [ ] Vite + Tailwind + Router + TanStack Query setup
- [ ] Ten required pages, loading/error/empty states, auth flow
- [ ] Gateway-only API client with typed contracts
- [ ] Verify: production build + browser walkthrough of the order workflow

## Phase 7 — Testing, deployment and documentation (partially reference)

- [x] Unit/integration/API suites for Phase 3 services (concurrency/duplicate tests included)
- [x] Dockerfiles for the five backend apps (one shared parameterized image) + Compose healthchecks
- [ ] GitHub Actions: install, lint, typecheck, unit, integration, build
- [ ] Vercel web config + Render backend services; Atlas/Upstash/Confluent secrets and topics
- [x] README, architecture, API and deployment docs updated for implemented phases
- [ ] Verify: fresh clone → `docker compose up --build` → full asynchronous workflow passes (Phase 4+)

## Verification log

| Date | Phase | Command / check | Result |
| --- | --- | --- | --- |
| 2026-11-24 | 1 | JSON configs parsed with PowerShell `ConvertFrom-Json`; 9 workspace packages present | PASS |
| 2026-11-24 | 1 | `npm install` / `npm run format:check` | PASS — completed after Node.js installation |
| 2026-11-24 | 1 (revision) | Full-workspace scan for old database/ORM names and SQL-only wording | PASS — 0 references |
| 2026-11-25 | 2 | `npm run build`, `typecheck`, `lint`, `format:check` | PASS |
| 2026-11-25 | 2 | `npm run test:order` | PASS — 2 suites, 6 tests |
| 2026-11-25 | 2 | Local HTTP smoke without infrastructure | PASS — `/health`, `/docs`, `/docs-json` 200; `/health/ready` 503 as expected |
| 2026-11-25 | 2 | Docker Compose YAML syntax and live stack | PASS — MongoDB `rs0`, Redis, Kafka and Order Service healthy |
| 2026-11-25 | 2 | `/health/ready` with live dependencies | PASS — 200; MongoDB, Redis and Kafka all `up` |
| 2026-11-25 | 2 | `docker compose down` / `dev:down` | PASS — stack stopped cleanly |
| 2026-11-25 | 3 | `npm run test:inventory` | PASS — 3 suites, 14 tests (includes concurrent reservation) |
| 2026-11-25 | 3 | `npm run test:order` | PASS — 5 suites, 27 tests (includes cancellation and per-service env URIs) |
| 2026-11-25 | 3 | `npm run test:payment` | PASS — 3 suites, 18 tests (includes duplicate idempotency) |
| 2026-11-25 | 3 | `npm run test:notification` | PASS — 3 suites, 13 tests |
| 2026-11-25 | 3 | `npm run test:gateway` | PASS — 2 suites, 7 tests (includes generated correlation ID) |
| 2026-11-25 | 3 | `npm run build`, `typecheck`, `lint`, `format:check`, `npm test` | PASS — 79 tests across 16 suites |
| 2026-11-25 | 3 | `docker compose config` and live Phase 3 stack smoke | PASS — gateway + 4 services healthy; domain Swagger and gateway proxy verified |
| 2026-11-25 | 3 | `npm run dev:down` | PASS — stack stopped cleanly |
| 2026-11-25 | Simplified 1 | `npm run format:check` | PASS — docs-only simplification |
| 2026-11-25 | Simplified 2 | `npm run build`, `typecheck`, `lint`, `format:check` | PASS — contracts package built first |
| 2026-11-25 | Simplified 2 | `npm run test:order` | PASS — 6 suites, 29 tests (includes publisher) |
| 2026-11-25 | Simplified 2 | `npm run test:notification` | PASS — 5 suites, 16 tests (includes consumer and event dedupe) |
| 2026-11-25 | Simplified 3 | `npm run build`, `typecheck`, `lint`, `format:check` | PASS |
| 2026-11-25 | Simplified 3 | `npm run test:inventory` | PASS — 4 suites, 16 tests (includes cache hit and invalidation) |
| 2026-11-25 | Simplified 4 | `npm run build`, `typecheck`, `lint`, `format:check` | PASS |
| 2026-11-25 | Simplified 4 | `npm run test:order` | PASS — 7 suites, 33 tests (includes auth service) |
| 2026-11-25 | Simplified 4 | `npm run test:gateway` | PASS — 3 suites, 13 tests (includes JWT middleware) |
