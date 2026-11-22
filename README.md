# games.io

games.io is a dark, responsive game directory for finding rules, setup notes, and quick scorekeeping tools.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/games-io/src/App.tsx` — routed SPA shell and primary UI flows
- `lib/catalog/src/index.ts` — shared catalog types, seed data, search helpers, and normalization
- `lib/db/src/schema/catalog.ts` — PostgreSQL catalog snapshot
- `artifacts/games-io/src/hooks/use-catalog.ts` — server-synchronized catalog editing actions
- `artifacts/games-io/src/components/AdminPanel.tsx` — signed-in local admin desk
- `artifacts/games-io/src/components/InventoryBank.tsx` — per-game inventory gallery
- `artifacts/games-io/src/index.css` — dark visual system, responsive rules, motion, and print styles
- `artifacts/games-io/src/components/` — shared scaffolded UI primitives

## Architecture decisions

- The catalog is stored as a PostgreSQL snapshot and loaded through the API so admin edits persist across devices.
- Catalog writes require a signed-in Clerk user plus the server-side admin password. Keep `ADMIN_PASSWORD` in Replit Secrets only; never compare it in frontend code.
- Inventory image bytes live in App Storage. Catalog records store object paths, not base64 image payloads.
- Wouter provides route-like navigation while preserving the app's lightweight single-page feel.
- Printing is handled with the browser print dialog and dedicated print CSS so a game guide can be saved as a simple PDF.
- Clerk provides user sign-in; the API also issues a short-lived, signed admin session cookie after the server verifies `ADMIN_PASSWORD`.

## Product

- Search games by title, alternate names, descriptions, and category labels.
- Browse from four primary categories through nested category levels with breadcrumbs.
- Read game objectives, setup details, equipment, and step-by-step rules.
- Track multiple players with +/- scoring controls and reset the scorekeeper.
- Copy a game link or print/save a cheat sheet.
- Sign in, unlock the admin desk, manage categories and game articles, and add/remove per-game inventory images.

## User preferences

No additional preferences recorded.

## Gotchas

- The artifact workflow supplies `PORT` and `BASE_PATH`; run the web app through the managed workflow rather than starting Vite at the workspace root.
- Keep the local game data typed when adding new games so search and detail views stay in sync.
- Do not move the admin password into frontend code or localStorage. The password gate is checked only by the API using Replit Secrets.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
