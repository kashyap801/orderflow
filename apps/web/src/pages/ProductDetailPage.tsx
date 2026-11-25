import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useCart } from '../cart/CartContext';
import { money } from '../format';
import type { Product } from '../types';

export function ProductDetailPage() {
  const { id = '' } = useParams();
  const { add } = useCart();
  const product = useQuery({
    queryKey: ['product', id],
    queryFn: () => api<Product>(`/inventory/products/${id}`),
  });

  if (product.isPending) return <p className="text-slate-500">Loading…</p>;
  if (product.isError) return <p className="text-red-600">{product.error.message}</p>;

  const value = product.data;
  return (
    <div className="max-w-2xl">
      <Link to="/" className="text-sm text-blue-600">
        ← Back to products
      </Link>
      <h1 className="mt-4 text-2xl font-bold">{value.name}</h1>
      <p className="text-xs uppercase tracking-wide text-slate-400">{value.sku}</p>
      <p className="mt-4 text-lg font-bold">{money(value.priceCents)}</p>
      <p className="mt-2 text-slate-600">{value.description ?? 'No description provided.'}</p>
      <p className="mt-2 text-sm text-slate-500">{value.availableQuantity} available</p>
      <button
        type="button"
        disabled={value.availableQuantity < 1}
        onClick={() => add(value)}
        className="mt-6 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-40"
      >
        Add to cart
      </button>
    </div>
  );
}
