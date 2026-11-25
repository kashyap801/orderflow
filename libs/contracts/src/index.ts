export const ORDER_CREATED_TOPIC = 'order.created.v1';

export interface EventEnvelope<TPayload> {
  eventId: string;
  eventType: string;
  version: 1;
  correlationId: string;
  occurredAt: string;
  producer: string;
  payload: TPayload;
}

export interface OrderCreatedPayload {
  orderId: string;
  userId: string;
  totalAmountCents: number;
  itemCount: number;
  status: string;
}

export type OrderCreatedEvent = EventEnvelope<OrderCreatedPayload>;
