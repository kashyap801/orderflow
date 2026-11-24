# Notification Service

Owns `notifications`. Consumes domain events and records simulated email deliveries.

Planned modules: Kafka consumers, deduplication by `eventId`, notification history API, DLQ handling.
It is the only service that may store an event ID as a deduplication key for user-facing side effects.
