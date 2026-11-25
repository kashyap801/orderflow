import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../cart/CartContext';
import { money } from '../format';
import type { Order } from '../types';

export function CheckoutPage() {
  const { user } = useAuth();
  const { lines, clear, totalCents } = useCart();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('');

  if (user === undefined) return <p className="text-red-600">Please log in to check out.</p>;
  if (lines.length === 0) return <p className="text-slate-500">Your cart is empty.</p>;

  async function checkout() {
    if (user === undefined) return;
    setBusy(true);
    setError('');
    try {
      setStep('Creating order…');
      const order = await api<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          items: lines.map((line) => ({
            productId: line.product._id,
            quantity: line.quantity,
          })),
        }),
      });

      setStep('Reserving stock…');
      for (const line of lines) {
        await api(`/inventory/products/${line.product._id}/reserve`, {
          method: 'POST',
          body: JSON.stringify({ quantity: line.quantity }),
        });
      }

      setStep('Processing payment…');
      await api('/payments/process', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order.orderId,
          userId: user.id,
          amountCents: order.totalAmount,
          idempotencyKey: crypto.randomUUID(),
          simulate: 'SUCCESS',
        }),
      });

      setStep('Confirming order…');
      await api(`/orders/${order.orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CONFIRMED' }),
      });

      clear();
      navigate(`/orders/${order.orderId}`, { state: { justCreated: true } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Checkout failed');
    } finally {
      setBusy(false);
      setStep('');
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Checkout</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <ul className="mb-4 space-y-1 text-sm">
          {lines.map((line) => (
            <li key={line.product._id} className="flex justify-between">
              <span>
                {line.quantity} × {line.product.name}
              </span>
              <span>{money(line.product.priceCents * line.quantity)}</span>
            </li>
          ))}
        </ul>
        <p className="mb-6 border-t border-slate-200 pt-4 text-lg font-bold">
          Total: {money(totalCents)}
        </p>
        {step !== '' && <p className="mb-3 text-sm text-blue-600">{step}</p>}
        {error !== '' && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={checkout}
          className="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? 'Please wait…' : 'Place order'}
        </button>
        <p className="mt-3 text-xs text-slate-500">
          Checkout uses REST calls. Kafka only sends a notification afterwards.
        </p>
      </div>
    </div>
  );
}
