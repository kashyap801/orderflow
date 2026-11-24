# API documentation

**Status:** proposed contract; controllers and Swagger annotations are Phase 3 work.

## 1. Conventions

- Public base URL: `http://localhost:3000/api/v1` (gateway only). Internal service ports are not
  exposed to the host.
- JSON request/response bodies. `Content-Type: application/json`.
- Auth: `Authorization: Bearer <JWT>`. Roles: `CUSTOMER`, `ADMIN`.
- Idempotent writes: `Idempotency-Key: <uuid>` header on `POST /orders`.
- Correlation: caller may send `X-Correlation-Id: <uuid>`; gateway generates one if absent and
  echoes it on every response. All logs and Kafka events carry it.
- Validation: unknown properties are rejected (`whitelist` + `forbidNonWhitelisted`).
- Errors: `{ "statusCode": 409, "code": "INSUFFICIENT_STOCK", "message": "...", "correlationId": "..." }`.
- Rate limits: 100 req/min per user (configurable), 20 auth attempts/min per IP. `429` includes
  `Retry-After`.

## 2. Endpoint inventory

| Method | Path | Auth | Target service | Notes |
| --- | --- | --- | --- | --- |
| `POST` | `/auth/register` | public | Order | bcryptjs hash; returns user + JWT |
| `POST` | `/auth/login` | public | Order | Returns JWT; rate limited per IP |
| `GET` | `/auth/me` | user | Order | Current user profile |
| `GET` | `/products` | public | Inventory | Paginated, Redis-cached catalogue |
| `GET` | `/products/:id` | public | Inventory | Product detail + available stock |
| `POST` | `/products` | ADMIN | Inventory | Create product (initial stock) |
| `PATCH` | `/products/:id` | ADMIN | Inventory | Update product; invalidates cache |
| `POST` | `/products/:id/adjust` | ADMIN | Inventory | Stock adjustment with reason |
| `POST` | `/orders` | user | Order | Async saga starts; returns `201` + `PENDING` |
| `GET` | `/orders` | user | Order | Own orders (admin sees all) |
| `GET` | `/orders/:id` | user/owner | Order | Status + `order_status_history` timeline |
| `POST` | `/orders/:id/cancel` | user/owner | Order | Refund-then-release for paid orders |
| `GET` | `/payments/:orderId` | ADMIN | Payment | Transaction history lookup |
| `GET` | `/notifications` | user/owner | Notification | Notification history |
| `GET` | `/health`, `/health/ready` | public | each | Liveness / readiness |

All paths above are relative to `/api/v1`.

## 3. Core request shapes (v1)

```ts
// POST /auth/register
{ name: string; email: string; password: string /* min 8 */ }

// POST /orders
{
  items: Array<{ productId: string; quantity: number /* >= 1 */ }>;
  simulateFailure?: boolean; // demo-only payment failure switch
}

// GET /orders/:id → 200
{
  id: string;
  status: 'PENDING' | 'INVENTORY_RESERVED' | 'PAYMENT_PROCESSING'
        | 'PAYMENT_CAPTURED' | 'CONFIRMED' | 'CANCELLING' | 'CANCELLED';
  totalAmount: string; // decimal string
  items: Array<{ productId: string; quantity: number; unitPrice: string }>;
  history: Array<{ fromStatus: string | null; toStatus: string; reason?: string; occurredAt: string }>;
}
```

Detailed response schemas, examples and OpenAPI JSON will be generated from NestJS decorators in
Phase 3 and surfaced at `/api/v1/docs` (gateway) plus per-service `/docs` endpoints.

## 4. Status codes

| Code | Meaning |
| --- | --- |
| 200 / 201 | Success / created |
| 202 | Accepted for asynchronous processing (reserved for future use) |
| 400 | Validation failure (field errors included) |
| 401 | Missing/invalid/expired JWT |
| 403 | Insufficient role or resource ownership |
| 404 | Resource not found |
| 409 | Business conflict: duplicate idempotency key, insufficient stock, invalid state transition |
| 429 | Rate limit exceeded |
| 500 / 503 | Unexpected error / dependency unavailable (safe message only) |
