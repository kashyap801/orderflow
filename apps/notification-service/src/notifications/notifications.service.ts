import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createId } from '@orderflow/common';
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

  /**
   * Stable entry point for Phase 4 Kafka consumers: they build the same DTO from
   * an event and call this method; no consumer logic is wired yet.
   */
  async create(input: CreateNotificationDto): Promise<Notification> {
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
      deliveryStatus: delivery === undefined ? 'FAILED' : 'SENT',
      ...(delivery === undefined
        ? {}
        : { deliveryMessageId: delivery.messageId, deliveredAt: delivery.deliveredAt }),
    });
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
