# Order Service

Owns identity (`users`) and orders. Acts as the **saga orchestrator**.

Planned modules: auth (register/login), orders, order state machine, saga handlers, outbox relay,
idempotency, Mongoose repository layer (orders with embedded items), Kafka consumers for
inventory/payment events.
