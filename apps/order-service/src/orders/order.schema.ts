import { model, models, Schema, type Model } from 'mongoose';
import { createId } from '@orderflow/common';

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'FAILED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'PENDING',
  'SUCCESS',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface OrderItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface OrderHistoryEntry {
  status: OrderStatus;
  note?: string;
  at: Date;
}

export interface Order {
  _id: string;
  orderId: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  history: OrderHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export const ORDER_MODEL = Symbol('ORDER_MODEL');
export type OrderModel = Model<Order>;

const OrderItemSchema = new Schema<OrderItem>(
  {
    productId: { type: String, required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    unitPriceCents: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    lineTotalCents: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  },
  { _id: false },
);

const HistorySchema = new Schema<OrderHistoryEntry>(
  {
    status: { type: String, required: true, enum: ORDER_STATUSES },
    note: { type: String, maxlength: 500 },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const OrderSchema = new Schema<Order>(
  {
    _id: { type: String, default: createId },
    orderId: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    items: { type: [OrderItemSchema], required: true },
    totalAmount: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    status: { type: String, required: true, enum: ORDER_STATUSES, default: 'PENDING' },
    paymentStatus: { type: String, required: true, enum: PAYMENT_STATUSES, default: 'PENDING' },
    history: { type: [HistorySchema], required: true },
  },
  { timestamps: true, strict: true, collection: 'orders' },
);

OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });

export function orderModelFactory(): OrderModel {
  return (models.Order as OrderModel | undefined) ?? model<Order>('Order', OrderSchema);
}
