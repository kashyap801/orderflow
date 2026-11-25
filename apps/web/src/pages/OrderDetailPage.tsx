import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { money } from '../format';
import type { Order } from '../types';

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const justCreated = (location.state as { justCreated?: boolean } | null)?.justCreated === true;
  const order = useQuery({
    queryKey: ['order', id],
    queryFn: () => api<Order>(`/orders/${id}`),
  });

  if (order.isPending) return <p className="text-slate-500">Loading…</p>;
  if (order.isError) return <p className="text-red-600">{order.error.message}</p>;

  const value = order.data;
  return (
    <div className="max-w-3xl">
      {justCreated && (
        <p className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-green-700">
          Order placed successfully. A notification is created from the ORDER_CREATED event.
        </p>
      )}
      <Link to="/orders" className="text-sm text-blue-600">
        ← My orders
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Order {value.orderId}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Status: {value.status} · Payment: {value.paymentStatus}
      </p>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Items</h2>
        <ul className="space-y-2 text-sm">
          {value.items.map((item) => (
            <li key={item.productId} className="flex justify-between">
              <span>
                {item.quantity} × {item.name}
              </span>
              <span>{money(item.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-slate-200 pt-3 font-bold">
          Total: {money(value.totalAmount)}
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Status history</h2>
        <ol className="space-y-2 text-sm">
          {value.history.map((entry, index) => (
            <li key={`${entry.at}-${index}`} className="text-slate-600">
              <span className="font-medium">{entry.status}</span> · {entry.at}
              {entry.note === undefined ? '' : ` · ${entry.note}`}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
