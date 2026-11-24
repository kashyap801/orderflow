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
- [x] Architecture revision approved; Phase 2 still held pending explicit go-ahead
- [ ] **Await Phase 2 go-ahead**

## Phase 2 — Backend foundation

- [ ] NestJS bootstrap for gateway + 4 services; health endpoints
- [ ] `@orderflow/common`: env validation, logger, exception filter, correlation ID
- [ ] Mongoose schemas, TypeScript interfaces and indexes for four MongoDB databases
- [ ] MongoDB (replica set)/Redis/Kafka clients with retry/backoff and graceful shutdown
- [ ] Auth in Order Service: register/login, bcryptjs, JWT, RBAC guard
- [ ] Verify: `npm run typecheck`, service boot + `/health/ready` against local infra

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
| 2026-11-24 | 1 | `npm install` / `npm run format:check` | NOT RUN — Node.js is not installed in this environment; run on the developer machine before Phase 2 |
| 2026-11-24 | 1 (revision) | Full-workspace scan for old database/ORM names and SQL-only wording | PASS — 0 references |
| 2026-11-24 | 1 (revision) | 12 JSON configs re-parsed after edits | PASS — 0 failures |
