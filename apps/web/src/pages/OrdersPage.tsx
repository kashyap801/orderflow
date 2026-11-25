import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { money } from '../format';
import type { Order } from '../types';

export function OrdersPage() {
  const { user } = useAuth();
  const orders = useQuery({
    queryKey: ['orders', user?.id],
    queryFn: () => api<Order[]>(`/orders/customer/${user?.id ?? ''}`),
    enabled: user !== undefined,
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">My orders</h1>
      {orders.isPending && <p className="text-slate-500">Loading orders…</p>}
      {orders.isError && <p className="text-red-600">{orders.error.message}</p>}
      {orders.data?.length === 0 && <p className="text-slate-500">No orders yet.</p>}
      <div className="space-y-3">
        {orders.data?.map((order) => (
          <Link
            key={order.orderId}
            to={`/orders/${order.orderId}`}
            className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-blue-400"
          >
            <div className="flex justify-between">
              <span className="font-semibold">{order.orderId}</span>
              <span>{money(order.totalAmount)}</span>
            </div>
            <div className="mt-1 flex gap-3 text-sm text-slate-500">
              <span>Status: {order.status}</span>
              <span>Payment: {order.paymentStatus}</span>
              <span>{order.items.length} item(s)</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
