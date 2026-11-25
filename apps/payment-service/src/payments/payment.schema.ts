import { model, models, Schema, type Model } from 'mongoose';
import { createId } from '@orderflow/common';

export const PAYMENT_STATUSES = [
  'PENDING',
  'SUCCESS',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface Refund {
  refundId: string;
  amountCents: number;
  reason?: string;
  createdAt: Date;
}

export interface PaymentHistoryEntry {
  status: PaymentStatus;
  note?: string;
  at: Date;
}

export interface Payment {
  _id: string;
  paymentId: string;
  orderId: string;
  userId: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  idempotencyKey: string;
  failureReason?: string;
  refunds: Refund[];
  history: PaymentHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export const PAYMENT_MODEL = Symbol('PAYMENT_MODEL');
export type PaymentModel = Model<Payment>;

const RefundSchema = new Schema<Refund>(
  {
    refundId: { type: String, required: true },
    amountCents: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    reason: { type: String, maxlength: 500 },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const HistorySchema = new Schema<PaymentHistoryEntry>(
  {
    status: { type: String, required: true, enum: PAYMENT_STATUSES },
    note: { type: String, maxlength: 500 },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const PaymentSchema = new Schema<Payment>(
  {
    _id: { type: String, default: createId },
    paymentId: { type: String, required: true, unique: true },
    orderId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    amountCents: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    currency: { type: String, required: true, default: 'USD', maxlength: 3 },
    status: { type: String, required: true, enum: PAYMENT_STATUSES, default: 'PENDING' },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    failureReason: { type: String, maxlength: 500 },
    refunds: { type: [RefundSchema], default: [] },
    history: { type: [HistorySchema], required: true },
  },
  { timestamps: true, strict: true, collection: 'payments' },
);

PaymentSchema.index({ userId: 1, createdAt: -1 });
PaymentSchema.index({ orderId: 1, createdAt: -1 });

export function paymentModelFactory(): PaymentModel {
  return (models.Payment as PaymentModel | undefined) ?? model<Payment>('Payment', PaymentSchema);
}
