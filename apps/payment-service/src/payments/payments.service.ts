import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createId, isDuplicateKeyError } from '@orderflow/common';
import type { FilterQuery, UpdateQuery } from 'mongoose';
import { ListPaymentsQueryDto, ProcessPaymentDto, RefundPaymentDto } from './dto';
import {
  PAYMENT_MODEL,
  type Payment,
  type PaymentHistoryEntry,
  type PaymentModel,
  type PaymentStatus,
} from './payment.schema';

export interface PaymentListResult {
  items: Payment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const REFUNDABLE: readonly PaymentStatus[] = ['SUCCESS', 'PARTIALLY_REFUNDED'];

@Injectable()
export class PaymentsService {
  constructor(@Inject(PAYMENT_MODEL) private readonly model: PaymentModel) {}

  async process(input: ProcessPaymentDto): Promise<Payment> {
    const existing = await this.model.findOne({ idempotencyKey: input.idempotencyKey }).exec();
    if (existing !== null) return existing;

    const paymentId = createId();
    const now = new Date();
    const failed = input.simulate === 'FAILURE';
    const status: PaymentStatus = failed ? 'FAILED' : 'SUCCESS';
    const history: PaymentHistoryEntry[] = [
      { status: 'PENDING', at: now, note: 'Payment request accepted' },
      {
        status,
        at: new Date(now.getTime() + 1),
        note: failed ? 'Simulated payment failure' : 'Simulated capture succeeded',
      },
    ];

    try {
      return await this.model.create({
        _id: paymentId,
        paymentId,
        orderId: input.orderId,
        userId: input.userId,
        amountCents: input.amountCents,
        currency: 'USD',
        status,
        idempotencyKey: input.idempotencyKey,
        ...(failed ? { failureReason: input.failureReason ?? 'Simulated payment failure' } : {}),
        refunds: [],
        history,
      });
    } catch (error) {
      // A concurrent request with the same idempotency key won the unique-index race.
      if (isDuplicateKeyError(error)) {
        const winner = await this.model.findOne({ idempotencyKey: input.idempotencyKey }).exec();
        if (winner !== null) return winner;
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Payment> {
    const payment = await this.model.findById(id).exec();
    if (payment === null) throw new NotFoundException(`Payment not found: ${id}`);
    return payment;
  }

  async findByOrderId(orderId: string): Promise<Payment[]> {
    return this.model.find({ orderId }).sort({ createdAt: -1 }).exec();
  }

  async findByCustomer(userId: string): Promise<Payment[]> {
    return this.model.find({ userId }).sort({ createdAt: -1 }).exec();
  }

  async history(id: string): Promise<PaymentHistoryEntry[]> {
    return (await this.findById(id)).history;
  }

  async list(query: ListPaymentsQueryDto): Promise<PaymentListResult> {
    const filter: FilterQuery<Payment> = {};
    if (query.status !== undefined) filter.status = query.status;
    if (query.orderId !== undefined) filter.orderId = query.orderId;
    if (query.userId !== undefined) filter.userId = query.userId;

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

  async refund(id: string, input: RefundPaymentDto): Promise<Payment> {
    const payment = await this.findById(id);
    if (!REFUNDABLE.includes(payment.status)) {
      throw new BadRequestException(`Payment cannot be refunded from status ${payment.status}`);
    }

    const alreadyRefunded = payment.refunds.reduce((sum, refund) => sum + refund.amountCents, 0);
    if (alreadyRefunded + input.amountCents > payment.amountCents) {
      throw new BadRequestException('Refund amount exceeds the remaining refundable amount');
    }

    const nextStatus: PaymentStatus =
      alreadyRefunded + input.amountCents === payment.amountCents
        ? 'REFUNDED'
        : 'PARTIALLY_REFUNDED';
    const refundId = createId();
    const update: UpdateQuery<Payment> = {
      $set: { status: nextStatus },
      $push: {
        refunds: {
          refundId,
          amountCents: input.amountCents,
          ...(input.reason === undefined ? {} : { reason: input.reason }),
          createdAt: new Date(),
        },
        history: {
          status: nextStatus,
          at: new Date(),
          note: `Refunded ${input.amountCents} minor units`,
        },
      },
    };

    const updated = await this.model
      .findOneAndUpdate({ _id: id, status: payment.status }, update, {
        new: true,
        runValidators: true,
      })
      .exec();
    if (updated === null) {
      throw new BadRequestException('Payment changed concurrently; retry the refund');
    }
    return updated;
  }
}
