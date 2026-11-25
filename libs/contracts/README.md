# @orderflow/contracts

Tiny, dependency-free TypeScript types shared by the services.

This package intentionally implements **only** the simplified event flow:

- `ORDER_CREATED_TOPIC` — `order.created.v1`
- `EventEnvelope<T>` — basic `eventId`, `eventType`, `correlationId`, `occurredAt`, `producer`, payload
- `OrderCreatedEvent` — emitted by Order Service after an order is saved

The larger topic catalogue, versioning rules, retry topics and DLQ described in
`docs/event-driven-architecture.md` are reference material only and are not implemented.
