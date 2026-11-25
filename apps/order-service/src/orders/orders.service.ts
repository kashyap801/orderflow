import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createId } from '@orderflow/common';
import type { FilterQuery, UpdateQuery } from 'mongoose';
import { CreateOrderDto, ListOrdersQueryDto, UpdateOrderStatusDto } from './dto';
import { INVENTORY_CLIENT, type InventoryClient } from './inventory-client';
import {
  ORDER_MODEL,
  type Order,
  type OrderHistoryEntry,
  type OrderItem,
  type OrderModel,
  type OrderStatus,
  type PaymentStatus,
} from './order.schema';

export interface OrderListResult {
  items: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'FAILED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED', 'FAILED'],
  PROCESSING: ['SHIPPED', 'CANCELLED', 'FAILED'],
  SHIPPED: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  CANCELLED: [],
  FAILED: [],
};

const CANCELLABLE: readonly OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING'];

@Injectable()
export class OrdersService {
  constructor(
    @Inject(ORDER_MODEL) private readonly model: OrderModel,
    @Inject(INVENTORY_CLIENT) private readonly inventory: InventoryClient,
  ) {}

  async create(input: CreateOrderDto): Promise<Order> {
    const items: OrderItem[] = await Promise.all(
      input.items.map(async (item) => {
        const product = await this.inventory.getProduct(item.productId);
        if (!product.active) {
          throw new BadRequestException(`Product is inactive: ${item.productId}`);
        }
        if (product.availableQuantity < item.quantity) {
          throw new BadRequestException(
            `Insufficient available stock for product: ${item.productId}`,
          );
        }
        return {
          productId: product._id,
          sku: product.sku,
          name: product.name,
          quantity: item.quantity,
          unitPriceCents: product.priceCents,
          lineTotalCents: product.priceCents * item.quantity,
        };
      }),
    );

    const totalAmount = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
    const orderId = createId();
    const createdAt = new Date();

    return this.model.create({
      _id: orderId,
      orderId,
      userId: input.userId,
      items,
      totalAmount,
      status: 'PENDING',
      paymentStatus: 'PENDING',
      history: [{ status: 'PENDING', at: createdAt, note: 'Order created' }],
    });
  }

  async findById(id: string): Promise<Order> {
    const order = await this.model.findById(id).exec();
    if (order === null) throw new NotFoundException(`Order not found: ${id}`);
    return order;
  }

  async findByCustomer(userId: string): Promise<Order[]> {
    return this.model.find({ userId }).sort({ createdAt: -1 }).exec();
  }

  async list(query: ListOrdersQueryDto): Promise<OrderListResult> {
    const filter: FilterQuery<Order> = {};
    if (query.status !== undefined) filter.status = query.status;
    if (query.paymentStatus !== undefined) filter.paymentStatus = query.paymentStatus;
    if (query.userId !== undefined) filter.userId = query.userId;
    if (query.from !== undefined || query.to !== undefined) {
      filter.createdAt = {};
      if (query.from !== undefined) filter.createdAt.$gte = new Date(query.from);
      if (query.to !== undefined) filter.createdAt.$lte = new Date(query.to);
    }

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

  async history(id: string): Promise<OrderHistoryEntry[]> {
    return (await this.findById(id)).history;
  }

  async updateStatus(id: string, input: UpdateOrderStatusDto): Promise<Order> {
    const order = await this.findById(id);
    this.assertTransition(order.status, input.status);
    return this.applyTransition(order._id, order.status, input.status, input.note);
  }

  async cancel(id: string, note = 'Order cancelled by customer'): Promise<Order> {
    const order = await this.findById(id);
    if (!CANCELLABLE.includes(order.status)) {
      throw new ConflictException(`Order cannot be cancelled from status ${order.status}`);
    }
    return this.applyTransition(order._id, order.status, 'CANCELLED', note);
  }

  async updatePaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<Order> {
    const updated = await this.model
      .findOneAndUpdate(
        { _id: id },
        { $set: { paymentStatus } },
        { new: true, runValidators: true },
      )
      .exec();
    if (updated === null) throw new NotFoundException(`Order not found: ${id}`);
    return updated;
  }

  private assertTransition(from: OrderStatus, to: OrderStatus): void {
    if (from === to) {
      throw new ConflictException(`Order is already in status ${from}`);
    }
    if (!ALLOWED_TRANSITIONS[from].includes(to)) {
      throw new ConflictException(`Invalid order status transition: ${from} -> ${to}`);
    }
  }

  private async applyTransition(
    id: string,
    expectedStatus: OrderStatus,
    nextStatus: OrderStatus,
    note?: string,
  ): Promise<Order> {
    const entry: OrderHistoryEntry = {
      status: nextStatus,
      at: new Date(),
      ...(note === undefined ? {} : { note }),
    };
    const update: UpdateQuery<Order> = {
      $set: { status: nextStatus },
      $push: { history: entry },
    };
    const updated = await this.model
      .findOneAndUpdate({ _id: id, status: expectedStatus }, update, {
        new: true,
        runValidators: true,
      })
      .exec();
    if (updated === null) {
      throw new ConflictException('Order status changed concurrently; retry the operation');
    }
    return updated;
  }
}
