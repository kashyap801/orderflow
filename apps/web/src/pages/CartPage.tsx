import { Link } from 'react-router-dom';
import { useCart } from '../cart/CartContext';
import { money } from '../format';

export function CartPage() {
  const { lines, setQuantity, remove, totalCents, itemCount } = useCart();

  if (lines.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Cart</h1>
        <p className="mt-4 text-slate-500">
          Your cart is empty.{' '}
          <Link to="/" className="text-blue-600">
            Browse products
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Cart</h1>
      <div className="space-y-3">
        {lines.map((line) => (
          <div
            key={line.product._id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4"
          >
            <div>
              <p className="font-semibold">{line.product.name}</p>
              <p className="text-sm text-slate-500">{money(line.product.priceCents)} each</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={line.product.availableQuantity}
                value={line.quantity}
                onChange={(event) => setQuantity(line.product._id, Number(event.target.value))}
                className="w-20 rounded border border-slate-300 px-2 py-1"
              />
              <span className="w-24 text-right font-semibold">
                {money(line.product.priceCents * line.quantity)}
              </span>
              <button
                type="button"
                onClick={() => remove(line.product._id)}
                className="text-sm text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
        <span>
          {itemCount} item{itemCount === 1 ? '' : 's'} · Total <strong>{money(totalCents)}</strong>
        </span>
        <Link to="/checkout" className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          Checkout
        </Link>
      </div>
    </div>
  );
}
