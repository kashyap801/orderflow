# Web

React + TypeScript + Vite + Tailwind + React Router + TanStack Query storefront.

## Run locally

```powershell
npm install
npm run dev:web   # from the repository root
```

Open `http://localhost:5173`. Vite proxies `/api` to the gateway at
`http://localhost:3000`, so start the backend stack first with `npm run dev:stack`.

## Pages

- Login and registration (a demo role selector lets you create an `ADMIN`)
- Product catalogue with search and product detail
- Client-side cart stored in `localStorage`
- Checkout: creates the order, reserves stock, processes a simulated payment and confirms the order
- My orders and order detail with status history
- Admin product form (create/deactivate), visible only to `ADMIN` users

The frontend calls only the API gateway. It never talks to a domain service directly.

## Deploy to Vercel

- Framework: Vite
- Root directory: `apps/web`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_URL=https://<your-gateway-host>` (no trailing `/api`)

`vercel.json` rewrites unknown paths to `index.html` so React Router works on refresh.
