# AGENTS.md

## Cursor Cloud specific instructions

This repo is **Next.js Commerce** — a Next.js 15 (App Router, React 19, Turbopack) storefront backed by Shopify. Standard commands live in `package.json` and `README.md`; only the non-obvious cloud notes are captured here.

### Services
- **Storefront (Next.js)** — dev server on port `3000`.
  - Run (dev): `pnpm dev` (defined in `package.json`).
  - Lint/test: `pnpm prettier:check` (this is also `pnpm test`).
  - Build: `pnpm build`.

### Non-obvious notes
- The storefront fetches all catalog/cart data from a live **Shopify** Storefront API. It does **not** work against a local mock. You must provide a real `.env` (copy `.env.example`) with valid `SHOPIFY_STORE_DOMAIN` and `SHOPIFY_STOREFRONT_ACCESS_TOKEN`. With the placeholder values from `.env.example`, the dev server starts fine but every page that loads data (including the homepage) returns **HTTP 500**. `pnpm build` likewise fails because it pre-renders pages that fetch from Shopify.
- `pnpm prettier:check` currently reports pre-existing formatting drift in `components/cart/actions.ts` and `lib/shopify/index.ts`. These are upstream repo state, not an environment problem.
- The `sharp` build script is skipped by pnpm (ignored-build-scripts warning). This is harmless for `pnpm dev`; Next.js image optimization still works.
