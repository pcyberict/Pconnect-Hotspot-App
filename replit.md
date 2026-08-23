# Primzy Connect

Primzy Connect sells hotspot internet vouchers, manages wallet deposits, and provides an admin inventory and plan dashboard.

## Run & Operate

- `pnpm --filter @workspace/pconnect run dev` — run the web app
- `pnpm --filter @workspace/api-server run dev` — run the PostgreSQL REST API
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — apply the Drizzle schema to development PostgreSQL
- Required env: `DATABASE_URL` — the provisioned PostgreSQL connection string
- Demo session: the web app uses the `demo-user` token; the seeded demo admin has a ₦2,500 wallet balance.
- The combined Docker deployment bootstraps the PostgreSQL schema and idempotent demo data before starting the API.

## Stack

- pnpm workspaces, Node.js 20, TypeScript
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Frontend: React + Vite + React Router
- API: REST compatibility layer for the existing UI flows
- Build: Vite and esbuild

## Where things live

- `artifacts/pconnect/src` — web pages and PostgreSQL REST compatibility client
- `artifacts/api-server/src/routes/pconnect.ts` — Pconnect API routes and transactional voucher purchases
- `lib/db/src/schema/pconnect.ts` — PostgreSQL source-of-truth schema for all Convex tables

## Architecture decisions

- Existing page calls remain stable through a REST adapter, so the UI did not need a page-by-page rewrite.
- Voucher purchase debits the wallet, records a transaction, and marks a voucher sold in one PostgreSQL transaction.
- PostgreSQL IDs are UUIDs and API responses include `_id` compatibility fields for the existing screens.

## Product

Users can browse plans, fund a wallet, buy vouchers, view purchase history, and manage their profile. Admins can manage plans, voucher inventory, users, settings, and sales statistics.

## User preferences

Keep the current Primzy Connect screens and visual language while replacing persistence integrations.
- Use the purple-tinted `#23103e` background across all pages, including admin pages and any future pages; avoid black page backgrounds.

## Gotchas

- The PostgreSQL schema must be applied with `pnpm --filter @workspace/db run push` before starting the API.
- Flutterwave verification and virtual-account flows require provider credentials in site settings; wallet deposits remain pending until verified.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
