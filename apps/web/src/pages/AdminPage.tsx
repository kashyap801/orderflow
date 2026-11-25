import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { money } from '../format';
import type { Paginated, Product } from '../types';

interface ProductForm {
  name: string;
  sku: string;
  description: string;
  priceCents: string;
  availableQuantity: string;
}

const emptyForm: ProductForm = {
  name: '',
  sku: '',
  description: '',
  priceCents: '',
  availableQuantity: '',
};

export function AdminPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [error, setError] = useState('');

  const products = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => api<Paginated<Product>>('/inventory/products?limit=100'),
  });

  const create = useMutation({
    mutationFn: (input: ProductForm) =>
      api<Product>('/inventory/products', {
        method: 'POST',
        body: JSON.stringify({
          name: input.name,
          sku: input.sku,
          ...(input.description === '' ? {} : { description: input.description }),
          priceCents: Number(input.priceCents),
          availableQuantity: Number(input.availableQuantity),
        }),
      }),
    onSuccess: () => {
      setForm(emptyForm);
      setError('');
      void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (cause: Error) => setError(cause.message),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api<Product>(`/inventory/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate(form);
  }

  function field(key: keyof ProductForm) {
    return {
      value: form[key],
      onChange: (event: { target: { value: string } }) =>
        setForm((current) => ({ ...current, [key]: event.target.value })),
    };
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Admin — products</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={submit}
          className="space-y-3 rounded-lg border border-slate-200 bg-white p-5"
        >
          <h2 className="font-semibold">Add a product</h2>
          <input
            required
            placeholder="Name"
            {...field('name')}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="SKU (letters, numbers, . _ -)"
            {...field('sku')}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Description"
            {...field('description')}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              type="number"
              min={0}
              placeholder="Price (cents)"
              {...field('priceCents')}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              min={0}
              placeholder="Quantity"
              {...field('availableQuantity')}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          {error !== '' && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {create.isPending ? 'Saving…' : 'Create product'}
          </button>
        </form>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">Existing products</h2>
          {products.isPending && <p className="text-sm text-slate-500">Loading…</p>}
          <ul className="space-y-2 text-sm">
            {products.data?.items.map((product) => (
              <li key={product._id} className="flex items-center justify-between gap-2">
                <span className={product.active ? '' : 'text-slate-400 line-through'}>
                  {product.name} · {money(product.priceCents)}
                </span>
                {product.active && (
                  <button
                    type="button"
                    disabled={deactivate.isPending}
                    onClick={() => deactivate.mutate(product._id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Deactivate
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
