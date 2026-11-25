import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createId, isDuplicateKeyError } from '@orderflow/common';
import type { OrderCreatedEvent } from '@orderflow/contracts';
import type { FilterQuery } from 'mongoose';
import { CreateNotificationDto, ListNotificationsQueryDto } from './dto';
import { EMAIL_SENDER, type EmailSender } from './email-sender';
import {
  NOTIFICATION_MODEL,
  type Notification,
  type NotificationModel,
} from './notification.schema';

export interface NotificationListResult {
  items: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATION_MODEL) private readonly model: NotificationModel,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
  ) {}

  async create(input: CreateNotificationDto, eventId?: string): Promise<Notification> {
    const notificationId = createId();
    let delivery: Awaited<ReturnType<EmailSender['send']>> | undefined;
    try {
      delivery = await this.emailSender.send({
        toUserId: input.userId,
        subject: input.subject,
        body: input.message,
      });
    } catch {
      delivery = undefined;
    }

    return this.model.create({
      _id: notificationId,
      notificationId,
      userId: input.userId,
      type: input.type,
      subject: input.subject,
      message: input.message,
      metadata: input.metadata ?? {},
      ...(eventId === undefined ? {} : { eventId }),
      deliveryStatus: delivery === undefined ? 'FAILED' : 'SENT',
      ...(delivery === undefined
        ? {}
        : { deliveryMessageId: delivery.messageId, deliveredAt: delivery.deliveredAt }),
    });
  }

  async createFromOrderCreated(event: OrderCreatedEvent): Promise<Notification | undefined> {
    const existing = await this.model.findOne({ eventId: event.eventId }).exec();
    if (existing !== null) return existing;

    try {
      return await this.create(
        {
          userId: event.payload.userId,
          type: 'ORDER_CREATED',
          subject: 'Order received',
          message: `Order ${event.payload.orderId} was received.`,
          metadata: {
            orderId: event.payload.orderId,
            totalAmountCents: event.payload.totalAmountCents,
            correlationId: event.correlationId,
          },
        },
        event.eventId,
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      return (await this.model.findOne({ eventId: event.eventId }).exec()) ?? undefined;
    }
  }

  async findById(id: string): Promise<Notification> {
    const notification = await this.model.findById(id).exec();
    if (notification === null) throw new NotFoundException(`Notification not found: ${id}`);
    return notification;
  }

  async findByCustomer(userId: string): Promise<Notification[]> {
    return this.model.find({ userId }).sort({ createdAt: -1 }).exec();
  }

  async list(query: ListNotificationsQueryDto): Promise<NotificationListResult> {
    const filter: FilterQuery<Notification> = {};
    if (query.userId !== undefined) filter.userId = query.userId;
    if (query.type !== undefined) filter.type = query.type;
    if (query.deliveryStatus !== undefined) filter.deliveryStatus = query.deliveryStatus;
    if (query.isRead === true) filter.readAt = { $ne: null };
    if (query.isRead === false) filter.readAt = null;

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async markRead(id: string): Promise<Notification> {
    const existing = await this.findById(id);
    if (existing.readAt !== undefined) return existing;
    const updated = await this.model
      .findOneAndUpdate({ _id: id }, { $set: { readAt: new Date() } }, { new: true })
      .exec();
    return updated ?? existing;
  }

  async resend(id: string): Promise<Notification> {
    const notification = await this.findById(id);
    let delivery: Awaited<ReturnType<EmailSender['send']>> | undefined;
    try {
      delivery = await this.emailSender.send({
        toUserId: notification.userId,
        subject: notification.subject,
        body: notification.message,
      });
    } catch {
      delivery = undefined;
    }
    const updated = await this.model
      .findOneAndUpdate(
        { _id: id },
        {
          $set: {
            deliveryStatus: delivery === undefined ? 'FAILED' : 'SENT',
            ...(delivery === undefined ? {} : { deliveryMessageId: delivery.messageId }),
            ...(delivery === undefined ? {} : { deliveredAt: delivery.deliveredAt }),
          },
        },
        { new: true },
      )
      .exec();
    return updated ?? notification;
  }
}
