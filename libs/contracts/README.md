# @orderflow/contracts

Shared, dependency-light TypeScript contracts imported by every service.

Planned contents:

- `EventEnvelope<T>` and `CommandEnvelope<T>` (eventId, correlationId, causationId, version, occurredAt).
- Versioned payload types for every topic listed in [docs/event-driven-architecture.md](../../docs/event-driven-architecture.md).
- Topic name constants (e.g. `ORDER_CREATED_V1`).
- Public REST DTO shapes shared between the gateway and services.

Rule: this library must never import NestJS, Mongoose or any runtime infrastructure.
