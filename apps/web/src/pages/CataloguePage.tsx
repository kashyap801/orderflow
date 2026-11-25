import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useCart } from '../cart/CartContext';
import { money } from '../format';
import type { Paginated, Product } from '../types';

export function CataloguePage() {
  const [search, setSearch] = useState('');
  const { add } = useCart();

  const products = useQuery({
    queryKey: ['products', search],
    queryFn: () =>
      api<Paginated<Product>>(
        `/inventory/products?active=true&limit=100${search === '' ? '' : `&search=${encodeURIComponent(search)}`}`,
      ),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-slate-500">Prices and stock come from the gateway.</p>
        </div>
        <input
          type="search"
          placeholder="Search products"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-64 rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {products.isPending && <p className="text-slate-500">Loading products…</p>}
      {products.isError && <p className="text-red-600">{products.error.message}</p>}
      {products.data?.items.length === 0 && <p className="text-slate-500">No products found.</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.data?.items.map((product) => (
          <div
            key={product._id}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <Link to={`/products/${product._id}`} className="font-semibold hover:text-blue-600">
              {product.name}
            </Link>
            <p className="text-xs uppercase tracking-wide text-slate-400">{product.sku}</p>
            <p className="mt-2 text-lg font-bold">{money(product.priceCents)}</p>
            <p className="text-sm text-slate-500">{product.availableQuantity} in stock</p>
            <button
              type="button"
              disabled={product.availableQuantity < 1}
              onClick={() => add(product)}
              className="mt-4 w-full rounded bg-blue-600 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-40"
            >
              Add to cart
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
