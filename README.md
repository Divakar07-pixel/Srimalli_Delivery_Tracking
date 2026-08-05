# Srimalli Food Product — Delivery Tracking System

A small-business delivery tracking application for **Srimalli Food Product**.
One admin records orders as they arrive at the hub, updates delivery status,
and messages customers on WhatsApp. Customers track their own order by
mobile number or invoice number — no account needed.

This is intentionally **not** a courier/fleet platform. There is one
delivery person, one hub, and no driver accounts, GPS tracking, or bidding.

https://divakar07-pixel.github.io/Srimalli_Delivery_Tracking/

---

## Features

- **Public tracking** — customers search by mobile number or invoice/order ID, no login. Multiple orders for the same mobile number are all shown.
- **Two ways to create an order** — capture/upload a bill photo or PDF, or enter details manually. Both are always available; scanning never blocks order creation.
- **Bill scanning architecture** — "Scanning Bill..." with an immediate "Enter Details Manually" escape hatch, a timeout fallback, a failure fallback, and an editable "Review Bill Details" screen before anything saves. See [OCR integration](#ocr-integration) below — a real OCR provider isn't wired in by default.
- **Dynamic, unlimited products per order** — no hardcoded product list. Admin types product names freely; quantity × price auto-calculates, and the invoice grand total can be overridden.
- **Delivery timeline** — Order Created → Supplier Dispatched → Arrived at Hub → Out for Delivery → Delivered (+ Cancelled), with timestamps, shown to both admin and customers.
- **WhatsApp click-to-chat** — free, no paid API. Auto-generated, editable message per status, opens `wa.me` with the message pre-filled.
- **Admin dashboard** — order counts by status, today's orders, quick actions.
- **Orders list** — search, status filters, date filters, pagination.
- **Order detail** — quick status buttons, edit items/notes/expected delivery, delete, invoice view/download, call, WhatsApp.
- **Settings** — company name, logo, business contact info, WhatsApp templates, theme.
- **Security** — Postgres Row Level Security locks every table to the authenticated admin. Public tracking goes exclusively through narrow, masked RPC functions — customer mobile numbers are masked, addresses are never exposed publicly, and the invoice storage bucket is private (accessed via a signed URL from an Edge Function that verifies the order reference first).
- **Mobile-first** — bottom nav on mobile, sidebar on desktop; camera capture for bills; installable as a PWA.

---

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router, React Hook Form, Zod, Lucide Icons, Framer Motion
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Row Level Security, one Edge Function)
- **Hosting:** GitHub (source), Vercel (frontend), Supabase (backend) — all usable on free tiers to start

---

## Project Structure

```
src/
  components/    # UI primitives + feature components (orders, tracking, invoices, layout)
  pages/
    public/      # Landing, Track, TrackDetail — no auth
    admin/       # Login, Dashboard, Orders, OrderDetail, AddOrder, Settings — auth required
  services/      # All Supabase calls live here (orders, invoices, tracking, auth, settings, whatsapp, ocr)
  hooks/         # useAuth, useToast, useDebounce, useThemeSync
  types/         # Database + domain types
  constants/     # Status labels/colors/flow
supabase/
  migrations/    # Run in order: 0001 schema → 0002 RLS → 0003 tracking RPCs → 0004 storage
  functions/
    get-invoice-url/   # Edge Function: verifies an order reference, returns a signed invoice URL
```

---

## Local Setup

### 1. Prerequisites

- Node.js 22+
- A free [Supabase](https://supabase.com) account
- The [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm install -g supabase`) for running migrations and deploying the Edge Function

### 2. Clone and install

```bash
git clone <your-repo-url> srimalli-delivery
cd srimalli-delivery
npm install
```

### 3. Create a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New Project**.
2. Once created, go to **Project Settings → API** and copy the **Project URL** and **anon public key**.

### 4. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 5. Run database migrations

Link the CLI to your project (find `<project-ref>` in your Supabase dashboard URL):

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

This runs all four migrations in `supabase/migrations/` — schema, RLS policies, tracking RPC functions, and storage buckets, in order.

> **Prefer the dashboard?** Open **SQL Editor** in Supabase and run each file in `supabase/migrations/` manually, in filename order (0001 → 0004).

### 6. Deploy the Edge Function

```bash
supabase functions deploy get-invoice-url
```

This function is what lets customers view/download their bill without the storage bucket being public. It uses the service role key automatically injected by Supabase — you don't need to set anything manually.

### 7. Create your admin account

Supabase Auth is used for the single admin login. In the dashboard, go to **Authentication → Users → Add user** and create yourself an account with an email and password. That's it — this app doesn't have a public signup flow, by design.

### 8. Run the app

```bash
npm run dev
```

Visit `http://localhost:5173` for the public tracking site, and `http://localhost:5173/admin/login` to sign in as admin.

---

## OCR Integration

Bill scanning ships as a **working state machine with no OCR provider wired in** — every scan currently resolves to "failed" so the manual-entry path is exercised by default, exactly per spec ("bill capture and manual entry are equal options; never force OCR").

To wire up a real provider (Google Cloud Vision, AWS Textract, an LLM vision call, etc.):

1. Create a new Edge Function, e.g. `supabase functions deploy scan-bill`, that accepts the uploaded file, calls your OCR provider (keep the API key server-side as a Supabase secret — never in frontend code), and returns fields matching `ExtractedBillData` in `src/services/ocr.ts`.
2. Update `runOcr()` in `src/services/ocr.ts` to call that function instead of the stub — the commented-out example in that file shows the expected shape.

Everything downstream (timeout handling, partial-success handling, the editable review screen, manual fallback) already works and doesn't need to change.

---

## Deploying to GitHub + Vercel

### GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

### Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repo.
2. Framework preset: **Vite**.
3. Add environment variables (same as your `.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Deploy.

`vercel.json` is already configured to rewrite all routes to `index.html`, so refreshing on `/admin/orders` or `/track/ABC123` will not 404.

### GitHub Actions (optional but included)

`.github/workflows/ci.yml` runs lint, typecheck, and build on every push/PR. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository secrets (**Settings → Secrets and variables → Actions**) if you want the build step to succeed in CI.

---

## Running Locally — Commands

```bash
npm run dev        # start dev server
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run build        # production build (also type-checks)
npm run preview      # preview the production build locally
```

---

## App Icons for PWA

`public/manifest.json` references `/icons/icon-192.png`, `/icons/icon-512.png`, and a maskable 512px icon. These aren't included — generate them from your actual logo (e.g. with [realfavicongenerator.net](https://realfavicongenerator.net)) and drop them into `public/icons/`.

---

## Troubleshooting

**"Missing VITE_SUPABASE_URL..." in the browser console** — you haven't created `.env` from `.env.example`, or forgot to restart `npm run dev` after adding it.

**Tracking search always says "No matching orders"** — check that migrations `0002` and `0003` ran successfully (RLS + RPC functions). Without them, the `anon` role has zero table access by design, and the RPC functions are the only path to public data.

**"Unable to retrieve invoice" on the tracking page** — the `get-invoice-url` Edge Function isn't deployed, or the order has no invoice on file. Check `supabase functions logs get-invoice-url` for details.

**Admin login fails** — confirm you created a user under **Authentication → Users** in the Supabase dashboard; there's no public signup route.

**Refreshing `/admin/orders` on Vercel gives a 404** — check that `vercel.json` was deployed (it's in the repo root) and that the Vercel project framework preset is Vite, not "Other."

**Duplicate invoice number warning won't go away** — invoice numbers must be unique across all orders; check the Orders list search for the existing one.

---

## Database Schema Reference

| Table | Purpose |
|---|---|
| `customers` | Name, mobile, address. Looked up/created by mobile number when an order is saved. |
| `orders` | One row per order — status, dates, totals, tracking ID, notes. |
| `order_items` | Line items per order. No product master table — product names live directly on each line, by design, so any product works without code changes. |
| `invoices` | Bill/invoice file metadata; the file itself lives in the private `invoices` storage bucket. |
| `order_status_history` | Auto-logged on every status change via a database trigger — powers the tracking timeline. |
| `settings` | Single-row table for company name, logo, contact info, WhatsApp templates, theme. |

---

## Production Deployment

### 1. Supabase setup

1. Create or select the Supabase project, then copy its Project URL and anon/publishable key into local `.env` using `.env.example` as the template. Never expose a service-role key to Vite or GitHub Pages.
2. Run the existing migrations in order, including `0005_admin_profiles_and_hardened_rls.sql`. The first four migrations create the delivery schema, public tracking RPCs, and private invoice storage; migration 0005 adds role-based admin access. Run [VERIFY_DATABASE.sql](supabase/VERIFY_DATABASE.sql) afterward for read-only live schema, RLS, index, constraint, and bucket checks.
3. Deploy the invoice URL function: `supabase functions deploy get-invoice-url`.
4. In Authentication > URL Configuration, add your production URLs, including `https://divakar07-pixel.github.io/Srimalli_Delivery_Tracking/` and the Vercel URL. The password-reset redirect must be allowed.
5. Create the first Auth user through Authentication > Users, then run [FIRST_ADMIN_SETUP.sql](supabase/FIRST_ADMIN_SETUP.sql) in SQL Editor after replacing its placeholders. Direct inserts into `auth.users` are intentionally avoided because Supabase Auth manages password hashing and identities.

The `invoices` bucket is private and accepts JPG, PNG, WEBP, and PDF files up to 15 MB. The public `branding` bucket is limited to logo assets. Only explicit `profiles.role = 'admin'` users receive CRUD access; public users use the existing narrow tracking RPCs only.

### 2. GitHub Pages

The repository includes `.github/workflows/deploy-pages.yml`. In GitHub, open Settings > Pages and set Source to **GitHub Actions**. Add these repository secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Each push to `main` validates the app and deploys a build with base path `/Srimalli_Delivery_Tracking/`. GitHub Pages is static hosting, so direct deep-link refreshes (for example `/admin/orders`) cannot be rewritten to the Vite entry point. Share the root URL and let React navigation handle app routes, or deploy the customer/admin SPA to Vercel for full refresh support.

### 3. Vercel

Import this repository in Vercel, choose the **Vite** preset, and configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Do not set `VITE_DEPLOY_TARGET`; the app then builds for `/`, and the included `vercel.json` supplies SPA rewrites for direct route refreshes.

### 4. Local production verification

```bash
npm ci
npm run lint
npm run typecheck
npm run build

# Optional: verify the GitHub Pages base-path bundle locally
VITE_DEPLOY_TARGET=github-pages npm run build
```

## License

MIT — see `LICENSE`.
