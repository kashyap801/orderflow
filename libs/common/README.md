# @orderflow/common

Cross-cutting NestJS building blocks used by all backend services.

Planned contents:

- `validateEnvironment()` using class-validator (fails fast on missing/invalid env vars).
- Global exception filter with safe, structured error responses.
- JSON logger built on the NestJS `Logger` (no extra logging dependency).
- Correlation-ID middleware/interceptor (`X-Correlation-Id`).
- `@Roles()` decorator + RBAC guard primitives.
- Outbox publisher and idempotent-consumer base helpers.

Rule: no business logic belongs here.
