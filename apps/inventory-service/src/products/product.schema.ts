import { model, models, Schema, type Model } from 'mongoose';
import { createId } from '@orderflow/common';

export interface Product {
  _id: string;
  name: string;
  sku: string;
  description?: string;
  priceCents: number;
  availableQuantity: number;
  reservedQuantity: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const PRODUCT_MODEL = Symbol('PRODUCT_MODEL');
export type ProductModel = Model<Product>;

const ProductSchema = new Schema<Product>(
  {
    _id: { type: String, default: createId },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 64 },
    description: { type: String, trim: true, maxlength: 1000 },
    priceCents: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    availableQuantity: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    reservedQuantity: { type: Number, required: true, default: 0, min: 0 },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, strict: true, collection: 'products' },
);

ProductSchema.index({ sku: 1 }, { unique: true });
ProductSchema.index({ active: 1, name: 1 });

export function productModelFactory(): ProductModel {
  return (models.Product as ProductModel | undefined) ?? model<Product>('Product', ProductSchema);
}

export function getProductModel(): ProductModel {
  return productModelFactory();
}
