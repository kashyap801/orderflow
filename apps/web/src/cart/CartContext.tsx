import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Product } from '../types';

const CART_KEY = 'orderflow.cart';

export interface CartLine {
  product: Product;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
  add(product: Product, quantity?: number): void;
  setQuantity(productId: string, quantity: number): void;
  remove(productId: string): void;
  clear(): void;
  itemCount: number;
  totalCents: number;
}

const CartContext = createContext<CartState | undefined>(undefined);

function savedLines(): CartLine[] {
  const raw = localStorage.getItem(CART_KEY);
  if (raw === null) return [];
  try {
    return JSON.parse(raw) as CartLine[];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(savedLines);

  const persist = useCallback((next: CartLine[]) => {
    localStorage.setItem(CART_KEY, JSON.stringify(next));
    setLines(next);
  }, []);

  const add = useCallback(
    (product: Product, quantity = 1) => {
      const existing = lines.find((line) => line.product._id === product._id);
      const next =
        existing === undefined
          ? [...lines, { product, quantity }]
          : lines.map((line) =>
              line.product._id === product._id
                ? { ...line, quantity: line.quantity + quantity }
                : line,
            );
      persist(next);
    },
    [lines, persist],
  );

  const setQuantity = useCallback(
    (productId: string, quantity: number) => {
      persist(
        quantity < 1
          ? lines.filter((line) => line.product._id !== productId)
          : lines.map((line) => (line.product._id === productId ? { ...line, quantity } : line)),
      );
    },
    [lines, persist],
  );

  const remove = useCallback(
    (productId: string) => {
      persist(lines.filter((line) => line.product._id !== productId));
    },
    [lines, persist],
  );

  const clear = useCallback(() => persist([]), [persist]);

  const value = useMemo<CartState>(
    () => ({
      lines,
      add,
      setQuantity,
      remove,
      clear,
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      totalCents: lines.reduce((sum, line) => sum + line.product.priceCents * line.quantity, 0),
    }),
    [lines, add, setQuantity, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const context = useContext(CartContext);
  if (context === undefined) throw new Error('useCart must be used inside CartProvider');
  return context;
}
