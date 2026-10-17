# CLAUDE.md

This file gives coding agents and contributors high-signal context for this repository.

## Mission

Preserve and promote the legacy of Nguyễn Trãi while increasing awareness and interest among younger generations through accessible digital experiences.

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
- `MISTRAL_API_KEY` (fallback for summary/title)
- `AI_MODEL` (present in env template, not consumed by route handlers currently)

### Observability

- `BRAINTRUST_API_KEY` (optional, enables LLM tracing for Gemini/Mistral route calls)
- `BRAINTRUST_PROJECT_NAME` (optional, defaults to `nguyen-trai-portfolio`)
- `OTEL_PROPAGATE_CONTEXT_URLS` (optional)

### Link preview security

- `PREVIEW_ALLOWED_DOMAINS` (optional, comma-separated domain allowlist for `/api/preview`)

## Architecture Overview

### Data storage

Content retains logical key `portfolio_data_v4` in the selected backend (`lib/persistence.ts`), Redis by default or Neon `portfolio.state` when PERSISTENCE_BACKEND=postgres:

```ts
{ products: Product[] }
```

`Product` is defined in `data/products.ts`.

Feedback uses Redis hashes/RediSearch before cutover, or Neon `portfolio.feedback` after PERSISTENCE_BACKEND=postgres. Expiring sessions and rate limits remain Redis-backed.

### Read path

- `lib/data.ts` exports public `getProducts()` through the 60-second Redis cache for Neon; see `docs/architecture.md` for consistency and outage behavior.
- `getProduct(id)` reads from `getProducts()`

### Write path

- `POST /api/products` appends one product
- `DELETE /api/products` resets to empty array
- Both invalidate the Redis public cache after the Neon mutation succeeds.
- Product writes may include `videos[]` for multiple videos; legacy single-video fields are still accepted.

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
- `GET /api/preview`
- `POST /api/upload` (Cloudinary)
- `POST /api/suggest-title` (Gemini -> Mistral fallback)
- `POST /api/get-summary` (Gemini -> Mistral fallback)
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
4. Each successful upload can be persisted as one entry in `videos[]`

Player behavior in detail page:

- Render all available videos
- Prefer `MuxVideoPlayer` for entries with `muxPlaybackId`
- Fallback to `VideoPlayer` when only `video` URL is available

## Observability

`instrumentation.ts` enables Vercel OTel and propagates trace context for localhost, Mistral, and Gemini by default (overridable with `OTEL_PROPAGATE_CONTEXT_URLS`).

`lib/braintrust.ts` provides optional Braintrust tracing wrappers used by:

- `/api/get-summary`
- `/api/suggest-title`

## Contributor Notes

- Use `rg` for search and file discovery.
- Do not introduce behavior changes when updating docs-only tasks.
- Keep docs aligned with actual route and env behavior from code, not assumptions.

For persistence changes or migration, read `docs/neon-migration.md`. PostgreSQL requires DATABASE_URL and a verified import; never silently fall back between backends. DATA_WRITE_PAUSED=1 blocks persistent mutations and defers legacy credential upgrades. Preserve Redis source data and all media references.
