# API documentation

**Status:** Phase 3 domain APIs are implemented. Auth (`401`/`403`), rate limiting (`429`) and Kafka
workflows are deferred; `authorization` and `x-user-id` headers are forwarded but not verified.

## 1. Conventions

- Public base URL: `http://localhost:3000/api/v1` (API Gateway). Direct service ports are published
  in local Compose for smoke tests: Order `3001`, Inventory `3002`, Payment `3003`, Notification `3004`.
- JSON request/response bodies with `Content-Type: application/json`.
- Success envelope: `{ "data": <payload>, "correlationId": "<uuid>" }`.
- Error envelope: `{ "statusCode": 409, "code": "CONFLICT", "message": "...", "correlationId": "..." }`.
- Correlation: callers may send `X-Correlation-Id`; the gateway generates one if absent, forwards
  it upstream, echoes it as an HTTP header and rewrites the response envelope's `correlationId`.
- Validation: DTOs use `whitelist` + `forbidNonWhitelisted` + implicit transform. Unknown fields
  are rejected. Order requests may contain only `userId` and `items[].{productId,quantity}`;
  client prices and totals are not accepted.
- Auth integration point: `Authorization: Bearer <token>` and `X-User-Id` are forwarded to domain
  services. There is no token verification, RBAC or ownership enforcement in Phase 3.
- Idempotency: Payment uses a required `idempotencyKey` in the request body. There is no generic
  `Idempotency-Key` header support yet.
- Swagger UI: `<service>/api/v1/docs`; OpenAPI JSON: `<service>/api/v1/docs-json`.

## 2. Gateway routes

| Gateway prefix | Target | Upstream path |
| --- | --- | --- |
| `/api/v1/orders` | Order Service (3001) | unchanged |
| `/api/v1/inventory` | Inventory Service (3002) | `/api/v1` + suffix (strips `inventory`) |
| `/api/v1/payments` | Payment Service (3003) | unchanged |
| `/api/v1/notifications` | Notification Service (3004) | unchanged |

Unreachable upstreams return `502` with `code: "BAD_GATEWAY"`. Gateway health, docs and the two
gateway introspection routes are served locally and are not proxied.

## 3. Endpoint inventory

All paths are relative to `/api/v1`. Query parameters for list endpoints: `page` (default 1),
`limit` (default 20, max 100), plus the filters named below.

### Gateway

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/gateway/routes` | Returns the four live proxy routes |
| `GET` | `/gateway/auth-context` | Shows resolved `userId` / `hasBearerToken`; no verification |
| `GET` | `/health`, `/health/ready` | Liveness / readiness |

### Order Service

| Method | Path | Status | Notes |
| --- | --- | --- | --- |
| `POST` | `/orders` | 201 | Create order; prices resolved from Inventory |
| `GET` | `/orders` | 200 | List; filters `status`, `paymentStatus`, `userId`, `from`, `to` |
| `GET` | `/orders/customer/:userId` | 200 | Customer order history |
| `GET` | `/orders/:id` | 200 | Order with embedded items and totals |
| `GET` | `/orders/:id/history` | 200 | `history[]` list |
| `PATCH` | `/orders/:id/status` | 200 | Guarded transition with optional `note` |
| `PATCH` | `/orders/:id/payment-status` | 200 | Update `paymentStatus` |
| `POST` | `/orders/:id/cancel` | 200 | Cancel from `PENDING`, `CONFIRMED` or `PROCESSING` |

Order statuses: `PENDING`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`, `FAILED`.
Payment statuses: `PENDING`, `SUCCESS`, `FAILED`, `REFUNDED`, `PARTIALLY_REFUNDED`.

### Inventory Service

| Method | Path | Status | Notes |
| --- | --- | --- | --- |
| `POST` | `/inventory/products` | 201 | Create product with `priceCents` and initial `availableQuantity` |
| `GET` | `/inventory/products` | 200 | List; filters `active`, `search` |
| `GET` | `/inventory/products/:id` | 200 | Product detail |
| `PATCH` | `/inventory/products/:id` | 200 | Partial update |
| `DELETE` | `/inventory/products/:id` | 200 | Deactivate (`active=false`); no hard delete |
| `GET` | `/inventory/products/:id/availability?quantity=N` | 200 | Availability result |
| `POST` | `/inventory/products/availability/batch` | 200 | Batch availability for `items[]` |
| `POST` | `/inventory/products/:id/reserve` | 200 | Atomic reserve; `409` if insufficient |
| `POST` | `/inventory/products/:id/release` | 200 | Atomic release of reserved stock |
| `POST` | `/inventory/products/:id/restock` | 200 | Atomic increase of available stock |

Availability result: `{ productId, available, availableQuantity, reservedQuantity }`.

### Payment Service

| Method | Path | Status | Notes |
| --- | --- | --- | --- |
| `POST` | `/payments/process` | 201 | Simulated capture; duplicate key returns the original payment |
| `GET` | `/payments` | 200 | List; filters `status`, `orderId`, `userId` |
| `GET` | `/payments/order/:orderId` | 200 | Payments for an order |
| `GET` | `/payments/customer/:userId` | 200 | Payments for a customer |
| `GET` | `/payments/:id` | 200 | Payment detail |
| `GET` | `/payments/:id/history` | 200 | Status history |
| `POST` | `/payments/:id/refunds` | 200 | Full or partial refund |

Payment statuses: `PENDING`, `SUCCESS`, `FAILED`, `REFUNDED`, `PARTIALLY_REFUNDED`.

### Notification Service

| Method | Path | Status | Notes |
| --- | --- | --- | --- |
| `POST` | `/notifications` | 201 | Create notification + simulated email |
| `GET` | `/notifications` | 200 | List; filters `userId`, `type`, `deliveryStatus`, `isRead` |
| `GET` | `/notifications/customer/:userId` | 200 | Customer history |
| `GET` | `/notifications/:id` | 200 | Notification detail |
| `PATCH` | `/notifications/:id/read` | 200 | Idempotent read timestamp |
| `POST` | `/notifications/:id/resend` | 200 | Retry simulated email |

Notification types: `ORDER_CREATED`, `ORDER_CONFIRMED`, `PAYMENT_SUCCESS`, `PAYMENT_FAILED`,
`ORDER_CANCELLED`, `REFUND_COMPLETED`. Delivery statuses: `PENDING`, `SENT`, `FAILED`.

Each service also exposes `GET /health` and `GET /health/ready`.

## 4. Core request shapes

```ts
// POST /orders — only IDs and quantities are accepted
{
  userId: 'customer-1',
  items: [{ productId: '2f4bd8de-...', quantity: 2 }]
}

// POST /inventory/products
{
  name: 'Wireless Mouse',
  sku: 'MOUSE-001',
  description?: 'Ergonomic wireless mouse',
  priceCents: 2499,        // integer minor units
  availableQuantity: 50
}

// POST /inventory/products/:id/reserve | /release | /restock
{ quantity: 2 }

// POST /inventory/products/availability/batch
{ items: [{ productId: '2f4bd8de-...', quantity: 1 }] }

// POST /payments/process
{
  orderId: 'order-1',
  userId: 'customer-1',
  amountCents: 4998,
  idempotencyKey: 'order-1-capture',
  simulate?: 'SUCCESS',    // or 'FAILURE'
  failureReason?: 'Card declined'
}

// POST /payments/:id/refunds
{ amountCents: 2000, reason?: 'Partial cancellation' }

// POST /notifications
{
  userId: 'customer-1',
  type: 'ORDER_CREATED',
  subject: 'Order received',
  message: 'Your order was created.',
  metadata?: { orderId: 'order-1' }
}
```

Order totals are computed as `sum(priceCents from Inventory * quantity)` and stored as integer
minor units (`totalAmount`, `unitPriceCents`, `lineTotalCents`). A client that sends `priceCents`,
`totalAmount` or any other unknown property receives `400`.

## 5. Representative responses

```json
// POST /orders → 201
{
  "data": {
    "_id": "uuid",
    "orderId": "uuid",
    "userId": "customer-1",
    "items": [{
      "productId": "uuid",
      "sku": "MOUSE-001",
      "name": "Wireless Mouse",
      "quantity": 2,
      "unitPriceCents": 2499,
      "lineTotalCents": 4998
    }],
    "totalAmount": 4998,
    "status": "PENDING",
    "paymentStatus": "PENDING",
    "history": [{ "status": "PENDING", "note": "Order created", "at": "2026-11-25T00:00:00.000Z" }]
  },
  "correlationId": "uuid"
}
```

`GET /health/ready` returns `503` with the standard error envelope when a required dependency is
unavailable. Redis and Kafka are checked only when `REDIS_ENABLED` / `KAFKA_ENABLED` are `true`.

## 6. Status codes

| Code | Meaning |
| --- | --- |
| 200 / 201 | Success / created |
| 400 | Validation failure or invalid state/refund rule |
| 404 | Resource not found |
| 409 | Conflict: insufficient stock, duplicate idempotency race, invalid transition |
| 502 | Gateway could not reach an upstream service |
| 500 / 503 | Unexpected error / dependency unavailable (safe message only) |

`401`, `403` and `429` are reserved for the future auth and rate-limiting phases.
