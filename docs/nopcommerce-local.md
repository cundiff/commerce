# nopCommerce local backend for Next.js Commerce

## Prerequisites

- Docker (nopCommerce + SQL Server)
- .NET 10 SDK (to build the Headless Storefront plugin)
- Node.js + pnpm (this storefront)

## 1. Start nopCommerce

```bash
cd /path/to/nopCommerce
docker compose up
```

Complete the installation wizard at http://localhost and seed catalog data.

## 2. Build and enable the plugin

```bash
cd src
dotnet build NopCommerce.sln
```

Admin → Configuration → Local plugins → **Headless Storefront API** → Install.

Verify: `curl http://localhost/headless/v1/health`

## 3. Configure Next.js Commerce

Copy `.env.example` to `.env.local`:

```bash
NOPCOMMERCE_API_URL=http://localhost/headless/v1
NOPCOMMERCE_STORE_URL=http://localhost
```

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000

## Checkout

Checkout redirects to nopCommerce via `/headless/v1/checkout/handoff`, which sets the guest cookie and sends the browser to hosted checkout on nopCommerce.
