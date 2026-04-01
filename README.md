# Nguyen Trai Portfolio

A Next.js 16 App Router project that presents the life, works, and legacy of Nguyen Trai, with content management, AI-assisted writing/search, and media upload support.

## What This App Does

- Public site with:
  - Home page and 9 themed section pages
  - Product/article detail pages
  - Search, sort, tag filtering, AI-assisted semantic search
  - AI summarization per card and detail page
- Admin page (`/admin`) to:
  - Create entries
  - Upload images to Cloudinary
  - Upload videos directly to Mux (direct upload + polling)
  - Clear all Redis data
  - Get AI title suggestions while typing

## Tech Stack

- `next@16` (App Router)
- `react@19`
- Tailwind CSS v4
- Upstash Redis (single JSON blob storage)
- Cloudinary (media upload + Cloudinary video fallback player)
- Mux (direct video upload + playback)
- Gemini and/or Mistral APIs (AI title suggestion, summarization, semantic search)
- Braintrust SDK (LLM trace logging for Gemini and Mistral calls)
- Vercel Analytics + Speed Insights + OpenTelemetry instrumentation

## Prerequisites

- Node.js 20+
- npm
- Optional service accounts:
  - Upstash Redis
  - Cloudinary
  - Mux
  - Gemini and/or Mistral

## Quick Start

```bash
git clone https://github.com/Kiy-K/NguyenTrai-Porfolio.git
cd NguyenTrai-Porfolio
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Set these in `.env.local`.

### Core

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

If Redis is missing, read APIs return empty arrays and write APIs return errors.

### Cloudinary

- `CLOUDINARY_URL`
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`

Used by `/api/upload` and Cloudinary video player fallback.

### Mux

- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `NEXT_PUBLIC_MUX_DATA_ENV_KEY`
- `APP_URL` (optional but recommended; used as `cors_origin` when generating direct upload URLs)

### AI Providers

- `GEMINI_API_KEY` (used first if present for summary/title)
- `MISTRAL_API_KEY` (fallback for summary/title; required for semantic search)
- `AI_MODEL` (declared in env, not currently used by route handlers)

### Observability

- `BRAINTRUST_API_KEY` (optional; enables Braintrust tracing for Gemini/Mistral route calls)
- `BRAINTRUST_PROJECT_NAME` (optional; defaults to `nguyen-trai-portfolio`)
- `OTEL_PROPAGATE_CONTEXT_URLS` (optional)

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run clean
```

No test framework is configured in this repository currently.

## Data Model and Storage

All content lives in Redis key `portfolio_data_v4`:

```ts
{ products: Product[] }
```

`Product` shape (`data/products.ts`):

- `id: string | number`
- `title: string`
- `description: string`
- `fullDescription?: string`
- `images: string[]`
- `video?: string`
- `muxAssetId?: string`
- `muxPlaybackId?: string`
- `tags?: string[]`
- `section?: string`
- `createdAt?: string`
- `status?: 'published' | 'draft' | 'archived'`
- `teamMembers?: string`

## Important Section Mapping Behavior

`SECTIONS` has both `id` and `name`, but products are filtered in section pages by matching product `section` against section `name` (case-insensitive), not `id`.

In admin, the `<select>` stores section names. Keep this behavior in mind if you migrate content.

## Caching and Revalidation

- `getProducts()` uses `unstable_cache` with a 30-minute TTL and tag `products`.
- Main route pages set `revalidate = 1800`.
- Product mutations trigger `revalidatePath('/', 'layout')`.
- `AutoReloader` does a client-side `router.refresh()` every 30 minutes.

## Routes

### Pages

- `/` home + category grid
- `/sections/[id]` section listing
- `/products/[id]` product detail
- `/admin` content management UI

### API

- `GET /api/products` list all products
- `POST /api/products` create product
- `DELETE /api/products` clear all products
- `GET /api/products/[id]` fetch one product
- `POST /api/upload` upload file to Cloudinary
- `POST /api/suggest-title` AI title suggestions
- `POST /api/get-summary` AI summary
- `POST /api/search-projects` Mistral semantic matching over visible products
- `POST /api/mux/upload-url` create Mux direct upload URL
- `GET /api/mux/asset/[uploadId]` poll Mux upload/asset status

## Project Structure

```text
app/
  admin/page.tsx
  api/
  products/[id]/page.tsx
  sections/[id]/page.tsx
  layout.tsx
  page.tsx
components/
data/
lib/
```

## Additional Docs

- `docs/architecture.md`
- `docs/api.md`
- `docs/operations.md`
- `CLAUDE.md` (agent/dev workflow notes)

## Deployment Notes

This app requires server runtime APIs (`/api/*`) and should be deployed on a Next.js-compatible platform (for example Vercel). Static-only hosting is not suitable.
