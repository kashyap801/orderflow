# OrderFlow

**Distributed e-commerce order management system — portfolio / interview project.**

> **Build status: Phase 3 core backend implemented and smoke-tested.** Four domain services
> (Order, Inventory, Payment, Notification) and the API Gateway are runnable with independent
> MongoDB databases, Swagger, tests and Docker Compose. Kafka choreography, saga orchestration,
> outbox relay, JWT/RBAC enforcement, rate limiting and the frontend remain Phase 4+.

---

## 1. Overview

OrderFlow demonstrates production-oriented backend engineering: independently deployable NestJS
services, MongoDB data ownership with Mongoose, REST APIs with DTO validation, Swagger/OpenAPI,
automated tests, Docker Compose, CI and (in later phases) Kafka saga orchestration, Redis
caching/rate limiting and a React storefront.

Phase 3 delivers the **synchronous domain APIs**:

- server-resolved order pricing (client-supplied prices/totals are rejected by DTO whitelisting),
- atomic inventory reservations with `availableQuantity` / `reservedQuantity` and no overselling,
- idempotent simulated payments with refunds and status history,
- notification history with read state and simulated email delivery,
- one gateway with centralized routing, correlation propagation and normalized upstream errors.

The asynchronous order workflow is intentionally **not** implemented yet; see
[docs/implementation-checklist.md](docs/implementation-checklist.md).

## 2. Requirement ambiguity resolved

The brief says "**four** independently deployable microservices" but then lists **five** components
(API Gateway, Order, Inventory, Payment, Notification).

**Resolution:** the four *domain* microservices are Order, Inventory, Payment and Notification.
The API Gateway is treated as independently deployable **edge infrastructure**, not a domain
microservice, and owns no business data. Total backend deployables: 5 (4 domain services + gateway).

Other explicit decisions: identity is planned in the Order Service (no fifth Auth service), and the
shopping cart is client-side (no Cart service). The database layer uses MongoDB/Mongoose; rationale
in [docs/technical-decisions.md](docs/technical-decisions.md).

## 3. Architecture

```mermaid
flowchart LR
  C["Client"] -->|"REST /api/v1"| GW["API Gateway<br/>routing, correlation, error normalization,<br/>auth context pass-through"]
  GW --> OS["Order Service<br/>orders + status history"]
  GW --> IS["Inventory Service<br/>catalogue + atomic stock"]
  GW --> PS["Payment Service<br/>simulated capture + refunds"]
  GW --> NS["Notification Service<br/>history + simulated email"]
  OS -->|"sync price lookup"| IS
  OS --> OD[("MongoDB<br/>orderflow_order")]
  IS --> ID[("MongoDB<br/>orderflow_inventory")]
  PS --> PD[("MongoDB<br/>orderflow_payment")]
  NS --> ND[("MongoDB<br/>orderflow_notification")]
  K[("Kafka / Redis<br/>Phase 4+")] -.-> OS
  K -.-> IS
  K -.-> PS
  K -.-> NS
```

Detailed boundaries, communication rules and deployment view: [docs/architecture.md](docs/architecture.md).

## 4. Service responsibilities

| Deployable | Owns | Phase 3 responsibility | Deferred |
| --- | --- | --- | --- |
| API Gateway | No business DB | Route `/api/v1/{orders,inventory,payments,notifications}`, forward correlation/auth headers, normalize upstream failures as `502`, expose route table | JWT verification, RBAC, Redis rate limits |
| Order Service | `orders` | Create/get/list/cancel, guarded status transitions, status history, server-side price lookup from Inventory | Saga orchestration, reservations during checkout, outbox |
| Inventory Service | `products` | Product CRUD/deactivate, availability checks, atomic reserve/release/restock, oversell prevention | Reservation expiry worker, Redis cache |
| Payment Service | `payments` | Simulated success/failure, idempotency key, full/partial refunds, payment history | Kafka payment commands/events |
| Notification Service | `notifications` | Create/history/customer queries, read state, simulated email + resend | Kafka event consumers, dedupe |
| Web | Static assets | Not implemented | Storefront/admin UI (Phase 6) |

## 5. Technology stack

| Layer | Choice |
| --- | --- |
| Backend | Node.js 20+, TypeScript 5, NestJS 10, REST, **Mongoose**, class-validator, Swagger/OpenAPI |
| Data / infra | MongoDB 7 (Atlas M10+ hosted, single-node replica set locally), Redis 7 and Kafka 3.x prepared but not used for business workflows yet |
| Hosting | GitHub, Vercel (web, future), Render (backend Docker services), MongoDB Atlas, Upstash Redis, Confluent Cloud |
| Quality | Jest, Supertest, ESLint, Prettier, GitHub Actions |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query (Phase 6) |

No Nx/Turborepo, no relational database or code-generation ORM, no native `bcrypt` build, no
CDC/Debezium, no extra logging framework — see ADRs in
[docs/technical-decisions.md](docs/technical-decisions.md).

## 6. Repository layout

```text
orderflow/
├── apps/
│   ├── api-gateway/          # edge service (NestJS)
│   ├── order-service/        # domain service (NestJS + Mongoose)
│   ├── inventory-service/    # domain service (NestJS + Mongoose)
│   ├── payment-service/      # domain service (NestJS + Mongoose)
│   ├── notification-service/ # domain service (NestJS + Mongoose)
│   └── web/                  # React + Vite (future phase)
├── libs/
│   ├── contracts/            # shared event/DTO types (future topics)
│   ├── common/               # config, bootstrap, filters, logging, health, infra clients
│   └── testing/              # MongoDB memory-server test harness
├── deploy/                   # shared Dockerfile + Compose files; local + hosted guide
├── docs/                     # architecture, database, events, lifecycle, decisions, API, checklist
├── .github/workflows/        # CI (Phase 7)
├── .env.example
├── package.json              # npm workspaces
└── tsconfig.base.json
```

## 7. Current request flow

Phase 3 uses synchronous REST. There is no Kafka consumer or saga orchestrator yet.

```mermaid
sequenceDiagram
  participant C as Client
  participant G as API Gateway
  participant O as Order Service
  participant I as Inventory Service
  participant P as Payment Service
  participant N as Notification Service

  C->>G: POST /api/v1/orders { userId, items }
  G->>O: proxy with X-Correlation-Id
  O->>I: GET product by id (price + availability snapshot)
  O-->>C: 201 order PENDING, total computed server-side
  C->>I: POST /api/v1/inventory/:id/reserve (atomic)
  C->>P: POST /api/v1/payments/process (idempotencyKey)
  C->>N: POST /api/v1/notifications (simulated email)
  C->>O: GET /api/v1/orders/:id and history
```

`GET /api/v1/gateway/routes` returns the live proxy table;
`GET /api/v1/gateway/auth-context` demonstrates the future auth integration point without
verifying tokens. Full target event flow: [docs/event-driven-architecture.md](docs/event-driven-architecture.md)
and [docs/order-lifecycle.md](docs/order-lifecycle.md).

## 8. Local setup

Install dependencies and verify formatting:

```powershell
npm install
npm run format:check
```

Run everything with Docker Compose (recommended):

```powershell
copy .env.example .env
npm run dev:stack
npm run dev:down
```

Or run infrastructure in Compose and Node processes on the host:

```powershell
npm run dev:infra
npm run dev:gateway        # http://localhost:3000
npm run dev:order          # http://localhost:3001
npm run dev:inventory      # http://localhost:3002
npm run dev:payment        # http://localhost:3003
npm run dev:notification   # http://localhost:3004
```

Useful endpoints:

| URL | Purpose |
| --- | --- |
| `http://localhost:3000/api/v1/health` | Gateway liveness |
| `http://localhost:3000/api/v1/gateway/routes` | Live proxy route table |
| `http://localhost:3000/api/v1/docs` | Gateway Swagger UI |
| `http://localhost:3001/api/v1/docs` | Order Service Swagger UI |
| `http://localhost:3002/api/v1/docs` | Inventory Service Swagger UI |
| `http://localhost:3003/api/v1/docs` | Payment Service Swagger UI |
| `http://localhost:3004/api/v1/docs` | Notification Service Swagger UI |

Every service also exposes `/api/v1/health` and `/api/v1/health/ready`. Local MongoDB runs as a
**single-node replica set (`rs0`)**; host-side Node processes use `directConnection=true`, while
Compose overrides the URI with `replicaSet=rs0` and the internal `mongo` hostname. Local Compose
disables MongoDB auth; hosted environments use Atlas credentials in secrets. See
[deploy/README.md](deploy/README.md).

Verification commands:

```powershell
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
```

Domain-specific suites: `npm run test:order`, `test:inventory`, `test:payment`,
`test:notification`, `test:gateway`. Database tests use `mongodb-memory-server`, so no running
Compose stack is required for `npm test`.

## 9. Documentation

- [Architecture](docs/architecture.md)
- [API documentation](docs/api-documentation.md)
- [Database design](docs/database-design.md)
- [Event-driven architecture (Phase 4 target)](docs/event-driven-architecture.md)
- [Order lifecycle (Phase 4 target)](docs/order-lifecycle.md)
- [Technical decisions / ADRs](docs/technical-decisions.md)
- [Implementation checklist](docs/implementation-checklist.md)
- [Deployment (local + hosted)](deploy/README.md)
- [Package install commands](docs/install-commands.md)

## 10. Future improvements

Out of scope for Phase 3 but documented for interviews: Kafka topics/outbox/saga/compensation,
idempotent consumers and DLQ, Redis catalogue caching and rate limiting, JWT/RBAC enforcement,
refresh tokens, OpenTelemetry, read replicas, real payment provider adapter, Kubernetes manifests,
and the React storefront.
