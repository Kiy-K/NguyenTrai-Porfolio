# Architecture

## High-Level System

This project is a Next.js App Router application with a server-backed content store and media integrations:

- Content metadata in Upstash Redis (`portfolio_data_v4`)
- Feedback records in Redis hash keys (`feedback:{uuid}`)
- Admin credentials/sessions in Redis (`admin:*`)
- Images in Cloudinary
- Videos in Mux (preferred) with Cloudinary URL fallback
- AI features powered by Gemini and/or Mistral

## Data Storage

### Redis shape

```ts
{ products: Product[] }
```

`Product` is defined in `data/products.ts` and includes optional media fields (`video`, `muxAssetId`, `muxPlaybackId`) plus descriptive fields (`title`, `description`, `fullDescription`, `tags`, `section`, etc.).

Feedback storage uses separate Redis hashes:

- `feedback:{uuid}` with fields: `id`, `nameHash`, `classHash`, `emailHash`, `text`, `rating`, `videoId`, `createdAt`, `createdAtUnix`
- No raw `name`, `class`, or `email` values are persisted

### Read strategy

`lib/data.ts` uses `unstable_cache` to memoize `getProducts()` for 30 minutes:

- cache key: `products-cache`
- tags: `products`
- revalidate: `1800` seconds

`getProduct(id)` resolves from the cached product list.

### Write strategy

`POST /api/products` and `DELETE /api/products` update Redis and call:

```ts
revalidatePath('/', 'layout')
```

to force fresh reads for server-rendered views.

## Route Architecture

### Page routes

- `/`: Landing page + section chooser
- `/sections/[id]`: Category-specific list
- `/products/[id]`: Product detail page
- `/admin`: Client-side content management and uploads
- `/admin/login`: Admin authentication UI

### API routes

- Product CRUD-lite:
  - `GET /api/products`
  - `POST /api/products`
  - `DELETE /api/products`
  - `GET /api/products/[id]`
- Feedback:
  - `POST /api/feedback`
- AI:
  - `POST /api/suggest-title`
  - `POST /api/get-summary`
  - `POST /api/search-projects`
- Media:
  - `POST /api/upload` (Cloudinary)
  - `POST /api/mux/upload-url`
  - `GET /api/mux/asset/[uploadId]`
- Admin auth:
  - `POST /api/admin/auth/bootstrap`
  - `POST /api/admin/auth/login`
  - `GET /api/admin/auth/status`
  - `POST /api/admin/auth/logout`
  - `POST /api/admin/feedback/read`

## Section Mapping (Behavioral Detail)

Sections are declared in `lib/constants.ts` with `id`, `name`, and `path`.

Current section filtering compares product `section` with section `name` (case-insensitive), not section `id`.

Admin writes the section as the human-readable section name.

## Media Pipeline

### Images

1. Admin selects image(s).
2. Frontend posts multipart form to `/api/upload`.
3. Server route streams file to Cloudinary.
4. Returned secure URLs are stored in product `images`.

### Videos (Mux direct upload)

1. Admin requests a one-time URL from `/api/mux/upload-url`.
2. Browser uploads video directly to Mux via XHR PUT.
3. Frontend polls `/api/mux/asset/[uploadId]` until `ready`.
4. On success, stores `muxPlaybackId` and `muxAssetId` in product payload.

At render time, detail page prefers Mux playback, then falls back to Cloudinary video URL (`video`) if present.

## AI Integration

### Title suggestion (`/api/suggest-title`)

- Triggered from admin title input with ~800ms debounce.
- Provider order: Gemini first, then Mistral fallback.
- Route enforces JSON-like output and parses defensively.

### Summarization (`/api/get-summary`)

- Used in cards and detail page.
- Provider order: Gemini first, then Mistral fallback.

### Semantic search (`/api/search-projects`)

- Uses Mistral only.
- Sends simplified project list (`id`, `title`, `description`).
- Returns matched IDs for semantic relevance blending with local text search.

## Rendering and Client Behavior

- Core routes export `revalidate = 1800`.
- Global `AutoReloader` triggers `router.refresh()` every 30 minutes for long-open tabs.
- Navigation is sticky and auto-hides on downward scroll.

## Security Model

- `/admin/*` is guarded by `proxy.ts` checking `admin_session` cookie presence.
- Server-side admin route handlers validate full session state against Redis and client IP hash.
- Admin sessions expire after 3 hours.
- Mutation endpoints (`/api/products` POST/DELETE, `/api/upload`, `/api/mux/upload-url`) require a valid admin session.
- Reading feedback hashes from admin requires both an active session and password re-verification.
- Sensitive admin mutation routes enforce same-origin `Origin` checks.
- Redis-backed fixed-window rate limiting is applied to admin auth/mutation and feedback submission/read paths.
- Global response headers are configured in `next.config.ts` for baseline browser hardening.

## Observability

`instrumentation.ts` registers Vercel OpenTelemetry and context propagation for:

- localhost
- `api.mistral.ai`
- `generativelanguage.googleapis.com`

This can be overridden via `OTEL_PROPAGATE_CONTEXT_URLS`.

`lib/braintrust.ts` adds optional LLM-level tracing spans for Gemini and Mistral calls in:

- `/api/get-summary`
- `/api/suggest-title`
- `/api/search-projects`

Enable it with `BRAINTRUST_API_KEY` (and optional `BRAINTRUST_PROJECT_NAME`).
