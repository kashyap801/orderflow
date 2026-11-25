export type Role = 'USER' | 'ADMIN';

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
}

export interface AuthResult {
  accessToken: string;
  tokenType: 'Bearer';
  user: PublicUser;
}

export interface Product {
  _id: string;
  name: string;
  sku: string;
  description?: string;
  priceCents: number;
  availableQuantity: number;
  reservedQuantity: number;
  active: boolean;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OrderItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface OrderHistoryEntry {
  status: string;
  note?: string;
  at: string;
}

export interface Order {
  _id: string;
  orderId: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: string;
  paymentStatus: string;
  history: OrderHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}
