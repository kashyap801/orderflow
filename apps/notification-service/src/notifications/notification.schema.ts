import { model, models, Schema, type Model } from 'mongoose';
import { createId } from '@orderflow/common';

export const NOTIFICATION_TYPES = [
  'ORDER_CREATED',
  'ORDER_CONFIRMED',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'ORDER_CANCELLED',
  'REFUND_COMPLETED',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const DELIVERY_STATUSES = ['PENDING', 'SENT', 'FAILED'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export interface Notification {
  _id: string;
  notificationId: string;
  userId: string;
  type: NotificationType;
  subject: string;
  message: string;
  metadata: Record<string, unknown>;
  deliveryStatus: DeliveryStatus;
  deliveryMessageId?: string;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const NOTIFICATION_MODEL = Symbol('NOTIFICATION_MODEL');
export type NotificationModel = Model<Notification>;

const NotificationSchema = new Schema<Notification>(
  {
    _id: { type: String, default: createId },
    notificationId: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    type: { type: String, required: true, enum: NOTIFICATION_TYPES },
    subject: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 2000 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    deliveryStatus: {
      type: String,
      required: true,
      enum: DELIVERY_STATUSES,
      default: 'PENDING',
    },
    deliveryMessageId: { type: String },
    deliveredAt: { type: Date },
    readAt: { type: Date },
  },
  { timestamps: true, strict: true, collection: 'notifications' },
);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, createdAt: -1 });

export function notificationModelFactory(): NotificationModel {
  return (
    (models.Notification as NotificationModel | undefined) ??
    model<Notification>('Notification', NotificationSchema)
  );
}
