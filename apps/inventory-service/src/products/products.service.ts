import { ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService, isDuplicateKeyError } from '@orderflow/common';
import type Redis from 'ioredis';
import type { FilterQuery } from 'mongoose';
import {
  BatchAvailabilityDto,
  CreateProductDto,
  ListProductsQueryDto,
  UpdateProductDto,
} from './dto';
import { PRODUCT_MODEL, type Product, type ProductModel } from './product.schema';

export interface AvailabilityResult {
  productId: string;
  available: boolean;
  availableQuantity: number;
  reservedQuantity: number;
}

export interface ProductListResult {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const LIST_VERSION_KEY = 'products:list:version';

@Injectable()
export class ProductsService {
  constructor(
    @Inject(PRODUCT_MODEL) private readonly model: ProductModel,
    @Optional() private readonly redis?: RedisService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async create(input: CreateProductDto): Promise<Product> {
    try {
      const product = await this.model.create({
        ...input,
        sku: input.sku.toUpperCase(),
        reservedQuantity: 0,
        active: true,
      });
      await this.invalidate(product._id);
      return product;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(`SKU already exists: ${input.sku.toUpperCase()}`);
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Product> {
    const cached = await this.readCache<Product>(`product:${id}`);
    if (cached !== undefined) return cached;

    const product = await this.model.findById(id).exec();
    if (product === null) throw new NotFoundException(`Product not found: ${id}`);
    await this.writeCache(`product:${id}`, product);
    return product;
  }

  async list(query: ListProductsQueryDto): Promise<ProductListResult> {
    const version = await this.listVersion();
    const key = `products:list:v${version}:${JSON.stringify(query)}`;
    const cached = await this.readCache<ProductListResult>(key);
    if (cached !== undefined) return cached;

    const filter: FilterQuery<Product> = {};
    if (query.active !== undefined) filter.active = query.active;
    if (query.search !== undefined && query.search.length > 0) {
      const pattern = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ name: pattern }, { sku: pattern }];
    }

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    const result: ProductListResult = {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
    await this.writeCache(key, result);
    return result;
  }

  async update(id: string, input: UpdateProductDto): Promise<Product> {
    const changes: Partial<UpdateProductDto> = { ...input };
    if (changes.sku !== undefined) changes.sku = changes.sku.toUpperCase();

    try {
      const updated = await this.model
        .findOneAndUpdate({ _id: id }, { $set: changes }, { new: true, runValidators: true })
        .exec();
      if (updated === null) throw new NotFoundException(`Product not found: ${id}`);
      await this.invalidate(id);
      return updated;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(`SKU already exists: ${String(changes.sku)}`);
      }
      throw error;
    }
  }

  async deactivate(id: string): Promise<Product> {
    const updated = await this.model
      .findOneAndUpdate({ _id: id }, { $set: { active: false } }, { new: true })
      .exec();
    if (updated === null) throw new NotFoundException(`Product not found: ${id}`);
    await this.invalidate(id);
    return updated;
  }

  async checkAvailability(id: string, quantity: number): Promise<AvailabilityResult> {
    const product = await this.findById(id);
    return {
      productId: product._id,
      available: product.active && product.availableQuantity >= quantity,
      availableQuantity: product.availableQuantity,
      reservedQuantity: product.reservedQuantity,
    };
  }

  async checkAvailabilityBatch(input: BatchAvailabilityDto): Promise<AvailabilityResult[]> {
    return Promise.all(
      input.items.map((item) => this.checkAvailability(item.productId, item.quantity)),
    );
  }

  async reserve(id: string, quantity: number): Promise<Product> {
    const updated = await this.model
      .findOneAndUpdate(
        { _id: id, active: true, availableQuantity: { $gte: quantity } },
        { $inc: { availableQuantity: -quantity, reservedQuantity: quantity } },
        { new: true },
      )
      .exec();

    if (updated !== null) {
      await this.invalidate(id);
      return updated;
    }

    const exists = await this.model.exists({ _id: id, active: true }).exec();
    if (exists === null) throw new NotFoundException(`Product not found or inactive: ${id}`);
    throw new ConflictException(`Insufficient available stock for product: ${id}`);
  }

  async release(id: string, quantity: number): Promise<Product> {
    const updated = await this.model
      .findOneAndUpdate(
        { _id: id, reservedQuantity: { $gte: quantity } },
        { $inc: { availableQuantity: quantity, reservedQuantity: -quantity } },
        { new: true },
      )
      .exec();

    if (updated !== null) {
      await this.invalidate(id);
      return updated;
    }

    const exists = await this.model.exists({ _id: id }).exec();
    if (exists === null) throw new NotFoundException(`Product not found: ${id}`);
    throw new ConflictException(`Insufficient reserved stock for product: ${id}`);
  }

  async restock(id: string, quantity: number): Promise<Product> {
    const updated = await this.model
      .findOneAndUpdate({ _id: id }, { $inc: { availableQuantity: quantity } }, { new: true })
      .exec();
    if (updated === null) throw new NotFoundException(`Product not found: ${id}`);
    await this.invalidate(id);
    return updated;
  }

  private get cache(): Redis | undefined {
    return this.redis?.enabled === true ? this.redis.getClient() : undefined;
  }

  private get ttlSeconds(): number {
    const raw = this.config?.get<number | string>('CACHE_TTL_SECONDS', 300);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 300;
  }

  private async readCache<T>(key: string): Promise<T | undefined> {
    const cache = this.cache;
    if (cache === undefined) return undefined;
    try {
      const raw = await cache.get(key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch {
      return undefined;
    }
  }

  private async writeCache(key: string, value: unknown): Promise<void> {
    const cache = this.cache;
    if (cache === undefined) return;
    try {
      await cache.set(key, JSON.stringify(value), 'EX', this.ttlSeconds);
    } catch {
      // Cache failures never block product reads or writes.
    }
  }

  private async listVersion(): Promise<number> {
    const cache = this.cache;
    if (cache === undefined) return 0;
    try {
      const raw = await cache.get(LIST_VERSION_KEY);
      const version = Number(raw ?? 0);
      return Number.isFinite(version) ? version : 0;
    } catch {
      return 0;
    }
  }

  private async invalidate(id: string): Promise<void> {
    const cache = this.cache;
    if (cache === undefined) return;
    try {
      await cache.del(`product:${id}`);
      await cache.incr(LIST_VERSION_KEY);
    } catch {
      // Cache failures never block product writes.
    }
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
