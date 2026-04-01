# CLAUDE.md

This file gives coding agents and contributors high-signal context for this repository.

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint check
npm run clean    # Clean Next.js build cache
```

No test framework is configured.

## Environment Variables

Copy `.env.example` to `.env.local` and set values as needed.

### Required for Redis-backed content

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### Required for media upload

- `CLOUDINARY_URL`
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`

### Required for Mux direct video upload

- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `NEXT_PUBLIC_MUX_DATA_ENV_KEY`
- `APP_URL` (recommended for Mux `cors_origin`)

### AI providers

- `GEMINI_API_KEY` (primary for summary/title if present)
- `MISTRAL_API_KEY` (fallback for summary/title and required for `/api/search-projects`)
- `AI_MODEL` (present in env template, not consumed by route handlers currently)

### Observability

- `OTEL_PROPAGATE_CONTEXT_URLS` (optional)

## Architecture Overview

### Data storage

All content is stored in Redis key `portfolio_data_v4` as:

```ts
{ products: Product[] }
```

`Product` is defined in `data/products.ts`.

### Read path

- `lib/data.ts` exports `getProducts()` via `unstable_cache` (30 minutes, tag: `products`)
- `getProduct(id)` reads from `getProducts()`

### Write path

- `POST /api/products` appends one product
- `DELETE /api/products` resets to empty array
- Both call `revalidatePath('/', 'layout')`

### Rendering routes

- `/` home + categories
- `/sections/[id]` section-specific listing
- `/products/[id]` detail page
- `/admin` admin UI for create/upload/clear

### Section mapping detail (important)

`SECTIONS` contains `id`, `name`, and `path`, but `/sections/[id]` filters products by comparing product `section` to `section.name` (case-insensitive), not `section.id`.

Admin currently stores `section` as section name.

## API Surface

- `GET /api/products`
- `POST /api/products`
- `DELETE /api/products`
- `GET /api/products/[id]`
- `POST /api/upload` (Cloudinary)
- `POST /api/suggest-title` (Gemini -> Mistral fallback)
- `POST /api/get-summary` (Gemini -> Mistral fallback)
- `POST /api/search-projects` (Mistral only)
- `POST /api/mux/upload-url`
- `GET /api/mux/asset/[uploadId]`

## Media Flow

### Images

Admin uploads images via `/api/upload` -> Cloudinary `upload_stream`.

### Video

Primary flow is Mux direct upload:

1. Admin requests one-time upload URL from `/api/mux/upload-url`
2. Browser uploads file directly to Mux using XHR PUT
3. UI polls `/api/mux/asset/[uploadId]` until ready
4. `muxPlaybackId` and `muxAssetId` are persisted with product

Player behavior in detail page:

- If `muxPlaybackId` exists -> `MuxVideoPlayer`
- Else if `video` exists -> `VideoPlayer` (Cloudinary)

## Observability

`instrumentation.ts` enables Vercel OTel and propagates trace context for localhost, Mistral, and Gemini by default (overridable with `OTEL_PROPAGATE_CONTEXT_URLS`).

## Contributor Notes

- Use `rg` for search and file discovery.
- Do not introduce behavior changes when updating docs-only tasks.
- Keep docs aligned with actual route and env behavior from code, not assumptions.
