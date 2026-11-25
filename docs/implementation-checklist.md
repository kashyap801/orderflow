# Implementation checklist

Update this file as work progresses. Each phase ends with a verification step.

## Phase 1 — Architecture and foundation ✅ COMPLETE (pending approval)

- [x] Analyse requirements; flag four-vs-five service ambiguity and resolve it
- [x] Finalize service boundaries and responsibilities
- [x] Define service-to-service communication rules
- [x] Define database ownership per service
- [x] Design Kafka topics, envelope, producers/consumers, DLQ and outbox
- [x] Explain saga lifecycle and compensations
- [x] Propose monorepo folder structure
- [x] Record architectural decisions/trade-offs (ADRs)
- [x] Initialise npm-workspaces monorepo skeleton and root tooling configs
- [x] Create initial documentation and this checklist
- [x] Verify JSON configs parse and workspace structure is intact
- [x] Replaced the original relational database plan with MongoDB/Mongoose model (collections, indexes, validation)
- [x] Updated deployment architecture: GitHub, Vercel, Render, Atlas, Upstash, Confluent
- [x] Updated `.env.example`, ADRs and local setup instructions
- [x] Architecture revision approved
- [x] Phase 2 go-ahead received

## Phase 2 — Backend foundation ✅ IMPLEMENTED (scope limited: no full microservices)

- [x] NestJS bootstrap for one runnable service: Order Service foundation
- [x] Global validation, CORS, standard success/error envelopes, exception filter and correlation IDs
- [x] `@orderflow/common`: env validation, structured logger, exception filter, correlation ID,
      health checks, Swagger setup and reusable Nest modules
- [x] Mongoose connection module with config-driven URI, retry, ping readiness and graceful shutdown
      (domain schemas/indexes deliberately deferred to Phase 3)
- [x] Redis and Kafka clients prepared as opt-in (`*_ENABLED=false` by default); no topics/consumers yet
- [x] Jest unit tests for env validation; health integration tests for liveness, readiness and 503
- [x] Local Docker Compose for MongoDB replica set `rs0`, Redis, Kafka and the backend container
- [x] README, API docs and deployment guide updated for the implemented foundation
- [x] Verify: build, typecheck, lint, format, 6 Jest tests and local HTTP smoke test
- [x] Verify: `/health/ready` with real MongoDB, Redis and Kafka through Docker Compose
- [ ] Auth in Order Service: register/login, bcryptjs, JWT, RBAC guard (Phase 3)

## Phase 3 — Core microservices

- [ ] Order Service: create/get/cancel, state machine, status history
- [ ] Inventory Service: catalogue, atomic reservation, release/confirm, expiry worker
- [ ] Payment Service: simulated capture/refund, idempotency, transactions
- [ ] Notification Service: history API + simulated email
- [ ] API Gateway: proxy routes, validation, errors, rate limiting, Swagger
- [ ] Verify: unit tests + HTTP smoke tests per service

## Phase 4 — Distributed systems

- [ ] `@orderflow/contracts`: envelopes and payload types for all topics
- [ ] Outbox collection + lease-based relay in each publishing service
- [ ] Saga handlers with guarded state transitions and compensations
- [ ] Idempotent consumers, retry topics and DLQ
- [ ] Duplicate-order, duplicate-event and concurrent-reservation handling
- [ ] Verify: full E2E happy path + all failure scenarios from `order-lifecycle.md`

## Phase 5 — Redis and optimisation

- [ ] Catalogue caching with TTL and invalidation
- [ ] Redis rate limiting
- [ ] Query/index review; optional reservation lock benchmark
- [ ] Verify: load/concurrency tests show no oversell and expected cache hits

## Phase 6 — Frontend

- [ ] Vite + Tailwind + Router + TanStack Query setup
- [ ] Ten required pages, loading/error/empty states, auth flow
- [ ] Gateway-only API client with typed contracts
- [ ] Verify: production build + browser walkthrough of the order workflow

## Phase 7 — Testing, deployment and documentation

- [ ] Unit, integration and E2E suites (incl. concurrency/duplicate tests)
- [ ] Dockerfiles for 5 backend apps + web; Compose (MongoDB rs0, Redis, Kafka) with healthchecks
- [ ] GitHub Actions: install, lint, typecheck, unit, integration, build
- [ ] Vercel web config + Render backend services; Atlas/Upstash/Confluent secrets and topics
- [ ] Complete README and all docs; verify examples against running system
- [ ] Verify: fresh clone → `docker compose up --build` → full workflow passes

## Verification log

| Date | Phase | Command / check | Result |
| --- | --- | --- | --- |
| 2026-11-24 | 1 | 12 JSON configs parsed with PowerShell `ConvertFrom-Json`; all 9 workspace packages present | PASS |
| 2026-11-24 | 1 | `npm install` / `npm run format:check` | PASS — completed after Node.js installation |
| 2026-11-24 | 1 (revision) | Full-workspace scan for old database/ORM names and SQL-only wording | PASS — 0 references |
| 2026-11-24 | 1 (revision) | 12 JSON configs re-parsed after edits | PASS — 0 failures |
| 2026-11-25 | 2 | `npm run build`, `typecheck`, `lint`, `format:check` | PASS |
| 2026-11-25 | 2 | `npm run test:order` | PASS — 2 suites, 6 tests |
| 2026-11-25 | 2 | Local HTTP smoke without infrastructure | PASS — `/health`, `/docs`, `/docs-json` 200; `/health/ready` 503 as expected |
| 2026-11-25 | 2 | Docker Compose YAML syntax | PASS — parsed with `js-yaml` |
| 2026-11-25 | 2 | `docker compose up --build` with real services | PASS — MongoDB `rs0`, Redis, Kafka and Order Service healthy |
| 2026-11-25 | 2 | `/health/ready` with live dependencies | PASS — 200; MongoDB, Redis and Kafka all `up` |
| 2026-11-25 | 2 | `docker compose down` / `dev:down` | PASS — stack stopped cleanly |
