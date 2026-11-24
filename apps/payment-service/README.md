# Payment Service

Owns `payments` and transaction history. No real gateway integration.

Planned modules: simulated authorize/capture, simulated refund, idempotency by `orderId`, outbox relay,
Kafka consumer for `payment.processing.requested` / `payment.refund.requested`.
