import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../cart/CartContext';

export function Layout() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-bold tracking-tight">
            OrderFlow
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/" className="hover:text-blue-600">
              Products
            </Link>
            <Link to="/cart" className="hover:text-blue-600">
              Cart ({itemCount})
            </Link>
            {user === undefined ? (
              <>
                <Link to="/login" className="hover:text-blue-600">
                  Login
                </Link>
                <Link to="/register" className="hover:text-blue-600">
                  Register
                </Link>
              </>
            ) : (
              <>
                <Link to="/orders" className="hover:text-blue-600">
                  Orders
                </Link>
                {user.role === 'ADMIN' && (
                  <Link to="/admin" className="hover:text-blue-600">
                    Admin
                  </Link>
                )}
                <span className="text-slate-500">{user.email}</span>
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-100"
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                >
                  Log out
                </button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
