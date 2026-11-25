import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const INVENTORY_CLIENT = Symbol('INVENTORY_CLIENT');

export interface InventoryProductSnapshot {
  _id: string;
  name: string;
  sku: string;
  priceCents: number;
  active: boolean;
  availableQuantity: number;
}

export interface InventoryClient {
  getProduct(productId: string): Promise<InventoryProductSnapshot>;
}

@Injectable()
export class HttpInventoryClient implements InventoryClient {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config
      .get<string>('INVENTORY_SERVICE_URL', 'http://localhost:3002')
      .replace(/\/$/, '');
  }

  async getProduct(productId: string): Promise<InventoryProductSnapshot> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/v1/products/${encodeURIComponent(productId)}`);
    } catch (error) {
      throw new ServiceUnavailableException(
        `Inventory service unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    if (response.status === 404) {
      throw new NotFoundException(`Product not found: ${productId}`);
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Inventory service returned ${response.status} for product ${productId}`,
      );
    }

    const payload = (await response.json()) as { data?: InventoryProductSnapshot };
    if (payload.data === undefined) {
      throw new ServiceUnavailableException(
        'Inventory service returned an invalid product payload',
      );
    }
    return payload.data;
  }
}
