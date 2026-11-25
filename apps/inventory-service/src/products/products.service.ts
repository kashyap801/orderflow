import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { isDuplicateKeyError } from '@orderflow/common';
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

@Injectable()
export class ProductsService {
  constructor(@Inject(PRODUCT_MODEL) private readonly model: ProductModel) {}

  async create(input: CreateProductDto): Promise<Product> {
    try {
      return await this.model.create({
        ...input,
        sku: input.sku.toUpperCase(),
        reservedQuantity: 0,
        active: true,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(`SKU already exists: ${input.sku.toUpperCase()}`);
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Product> {
    const product = await this.model.findById(id).exec();
    if (product === null) throw new NotFoundException(`Product not found: ${id}`);
    return product;
  }

  async list(query: ListProductsQueryDto): Promise<ProductListResult> {
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

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async update(id: string, input: UpdateProductDto): Promise<Product> {
    const changes: Partial<UpdateProductDto> = { ...input };
    if (changes.sku !== undefined) changes.sku = changes.sku.toUpperCase();

    try {
      const updated = await this.model
        .findOneAndUpdate({ _id: id }, { $set: changes }, { new: true, runValidators: true })
        .exec();
      if (updated === null) throw new NotFoundException(`Product not found: ${id}`);
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

    if (updated !== null) return updated;

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

    if (updated !== null) return updated;

    const exists = await this.model.exists({ _id: id }).exec();
    if (exists === null) throw new NotFoundException(`Product not found: ${id}`);
    throw new ConflictException(`Insufficient reserved stock for product: ${id}`);
  }

  async restock(id: string, quantity: number): Promise<Product> {
    const updated = await this.model
      .findOneAndUpdate({ _id: id }, { $inc: { availableQuantity: quantity } }, { new: true })
      .exec();
    if (updated === null) throw new NotFoundException(`Product not found: ${id}`);
    return updated;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
