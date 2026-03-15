# Moneda

Moneda is a personal expense tracker built with Next.js. It now uses Supabase for authentication and cloud data storage, while keeping the existing mobile-first UI and analytics workflows.

## Features
- Email/password authentication (signup, login, forgot password)
- Transaction CRUD with category/split/recurring support
- Budget management with threshold alerts
- Dashboard, savings history, insights, and timeline analytics
- Offline queue via IndexedDB + sync endpoint
- WebSocket refresh events for real-time UI updates

## Tech Stack
- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- Supabase Auth + Postgres (RLS enabled)
- IndexedDB (offline queue)

## Supabase Setup

1. Install dependencies:
	`npm install`

2. Configure environment variables in `.env.local`:
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
	- `NEXT_PUBLIC_SITE_URL`

3. Link your local project to Supabase:
	`cmd /c npx supabase link --project-ref YOUR_PROJECT_REF`

4. Apply migrations:
	`cmd /c npx supabase db push`

	The current backend requires both migrations:
	- `supabase/migrations/202603150001_initial_schema.sql`
	- `supabase/migrations/202603150002_replace_transaction_splits_rpc.sql`

5. Start development server:
	`npm run dev`

6. Build and lint checks:
	- `cmd /c npm run lint`
	- `cmd /c npm run build`

## API Notes
- Data APIs require an authenticated Supabase session cookie.
- Auth routes:
  - `POST /api/auth/signup`
  - `POST /api/auth/login`
  - `POST /api/auth/forgot-password`
- Data routes:
  - `/api/transactions`
  - `/api/budgets`
  - `/api/dashboard`
  - `/api/insights`
  - `/api/savings`
  - `/api/timeline`
  - `/api/sync`
  - `/api/transactions/recurring`

## Security
- Supabase Row Level Security (RLS) is enabled on core tables.
- API routes return `401` for unauthenticated requests.
- Ownership checks are enforced by RLS policies and authenticated session context.

## License
MIT
