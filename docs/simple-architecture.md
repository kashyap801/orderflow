# OrderFlow — simple architecture guide

This is the short, current-state guide for the project. Use it first when preparing for an
interview. The longer documents in `docs/` are kept as reference, but several of them describe
advanced patterns that are intentionally **not implemented**.

## One-minute explanation

OrderFlow is a small e-commerce order system built with Node.js, TypeScript and NestJS. An API
Gateway is the only public backend entry point. Four domain services own their own MongoDB data:
Order, Inventory, Payment and Notification. Checkout uses ordinary REST calls so the flow is easy
to follow. Redis is used only to cache product reads. Kafka demonstrates one event:
`ORDER_CREATED`, which creates a notification. JWT authentication is verified at the gateway, with
a simple `ADMIN` role for product changes. A small React storefront talks only to the gateway and is
deployed on Vercel.

## What is implemented now

| Part | Responsibility | Data |
| --- | --- | --- |
| API Gateway | Routes `/api/v1/*`, forwards correlation IDs, normalizes upstream failures | None |
| Order Service | Creates/lists/cancels orders, resolves prices from Inventory, stores status history | `orderflow_order` |
| Inventory Service | Products, availability, atomic reserve/release/restock | `orderflow_inventory` |
| Payment Service | Simulated capture/refund, idempotency key, payment history | `orderflow_payment` |
| Notification Service | Notification history, read state, simulated email | `orderflow_notification` |
| Shared libs | Bootstrap, validation, logging, health checks, test harness, minimal event types | None |

## Simplified additions in this track

These are deliberately small and are added incrementally on top of the working Phase 3 backend:

1. **JWT auth** — register/login in Order Service, token verification in the gateway.
2. **Basic roles** — `USER` for normal actions, `ADMIN` for product create/update/deactivate.
3. **Kafka** — Order publishes `ORDER_CREATED`; Notification consumes it and writes a notification.
4. **Redis** — Inventory caches product reads with a short TTL and invalidates on writes.
5. **React web app** — login, catalogue, cart, checkout, orders and a simple admin form.
6. **GitHub + Vercel** — source stays on GitHub; the static frontend is deployed by Vercel.

There is no Saga orchestrator, Transactional Outbox, DLQ, retry topic, distributed transaction,
refresh-token flow, rate limiting, Kafka UI, service mesh or Kubernetes.

## Main flows

### 1. Browse products

```text
Browser -> Gateway -> Inventory -> MongoDB
                         |
                         +-> Redis cache (product reads only)
```

The first read comes from MongoDB and is cached. Product changes clear the cached entry.

### 2. Checkout — stays synchronous

```text
Browser -> Gateway -> Order Service -> Inventory (price lookup)
Browser -> Gateway -> Inventory      (reserve stock)
Browser -> Gateway -> Payment        (simulated capture)
Browser -> Gateway -> Order Service  (order status/history)
```

The client sends product IDs and quantities only. Prices and totals are always calculated by the
backend. Kafka is not part of preserving correctness in checkout.

### 3. Notification event — the only Kafka flow

```text
Order Service --ORDER_CREATED--> Kafka --> Notification Service -> MongoDB notification
```

If the consumer runs again, the notification layer uses the event ID to avoid creating a duplicate.
No saga, outbox or compensating transaction is involved.

### 4. Authentication

```text
Browser -> Gateway /api/v1/auth/* -> Order Service (bcryptjs password hash + JWT)
Browser -> Gateway /api/v1/orders  (JWT verified here, x-user-id forwarded)
```

The gateway checks the bearer token before proxying protected routes. Product changes require
`ADMIN`. Health, Swagger, login and register stay public.

## Data ownership rule

Each service writes only its own database. Services never read another service's collections.
Cross-service references are plain string IDs. When Order needs a price, it calls Inventory over
HTTP. This is the main rule to explain in an interview.

## Local setup

```powershell
copy .env.example .env
npm install
npm run dev:stack
```

| URL | Purpose |
| --- | --- |
| `http://localhost:3000` | Gateway and all API routes |
| `http://localhost:3001` | Order Service Swagger |
| `http://localhost:3002` | Inventory Service Swagger |
| `http://localhost:3003` | Payment Service Swagger |
| `http://localhost:3004` | Notification Service Swagger |
| `http://localhost:5173` | React frontend |

Verification:

```powershell
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
npm run dev:down
```

## Interview cheat sheet

- **Why four services plus a gateway?** Four domain services own business data; the gateway is edge
  infrastructure and owns no business data.
- **Why synchronous checkout?** It is easy to trace and test. The event is only a notification side
  effect, not a distributed transaction.
- **How is overselling prevented?** Inventory uses a conditional atomic MongoDB update with
  `availableQuantity >= quantity`.
- **How are duplicate payments prevented?** A unique `idempotencyKey` returns the existing payment.
- **Why Redis?** Only to make product reads faster. MongoDB remains the source of truth.
- **Why Kafka?** To show event-driven communication without replacing the reliable REST flow.
- **What is deliberately missing?** Saga, outbox, DLQ, advanced retries, rate limiting and complex
  RBAC. These are documented elsewhere as future reference only.
