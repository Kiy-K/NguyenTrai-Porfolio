# Architecture

## High-Level System

This project is a Next.js App Router application with a server-backed content store and media integrations:

- Persistent content and credential hash payloads in the selected backend (`lib/persistence.ts`): Redis by default, Neon `portfolio.state` when `PERSISTENCE_BACKEND=postgres`.
- Feedback records in Redis hashes/RediSearch before cutover, or JSONB in Neon `portfolio.feedback` after cutover.
- Expiring administrator sessions, IP bindings, rate limits, and dedupe state remain in Redis.
- Images in Cloudinary
- Multiple videos per product via Mux (preferred) with Cloudinary URL fallback
- AI features powered by Gemini and/or Mistral

## Product Goal

The platform goal is to preserve Nguyễn Trãi's historical legacy and raise awareness among youth by making archival and interpretive content easier to discover, consume, and share.

## Data Storage

### Preserved content shape

```ts
{ products: Product[] }
```

`Product` is defined in `data/products.ts` and includes optional media fields (`videos`, `video`, `muxAssetId`, `muxPlaybackId`) plus descriptive fields (`title`, `description`, `fullDescription`, `tags`, `section`, etc.).

Feedback keeps the same fields/source keys in the selected backend:

- `feedback:record:{uuid}` with fields: `id`, `nameHash`, `classHash`, `emailHash`, `text`, `rating`, `videoId`, `createdAt`, `createdAtUnix`
- No raw `name`, `class`, or `email` values are persisted
- Redis reads use `feedback_idx_v1`; PostgreSQL reads use SQL with bounded newest reads and modern-record precedence over legacy duplicate IDs.

### Read strategy

`lib/data.ts` reads public products through `lib/product-cache.ts` when Neon is
selected. Neon owns persistent content. Redis stores only the public product
list, with 60-second maximum TTL; the cache namespace includes a hash of the
normalized Neon endpoint/database. Undefined legacy status and `published` are
public; draft/archive/unknown statuses are excluded before caching or returning.
Credentials and feedback use their existing uncached persistence paths.

Product and section pages are dynamic. Product APIs send `Cache-Control:
no-store`, so the application Redis cache controls server freshness. The static
homepage contains no products. There is no `unstable_cache`, products tag, ISR
product cache, or product mutation `revalidatePath` layer. `getProduct(id)` uses
the public list. Authenticated `GET /api/products?fresh=1` bypasses Redis content
caching and returns fresh persisted content (including drafts) with no-store.

### Write strategy

Successful Neon `writeContent` and `appendProduct` mutations atomically replace
the Redis cache epoch and remove its payload. Every public cache read runs a
Lua script on the Redis write path to get the epoch/payload and Redis-clock
read-start deadline. Publication compares that epoch and uses only the remaining
TTL. All instances share the fence; old reads cannot repopulate after successful
invalidation. Keys expire (data ≤60s, epoch 120s), including metadata.

A Redis cache outage reads Neon directly. Failed publication returns the loaded
source result; failed invalidation does not turn an already committed write into
an API failure. If invalidation fails, stale responses are bounded to 60 seconds
from the original source read's start, including delayed fills. In-flight source
requests may return their earlier snapshot. Neon failures propagate as errors;
the persistent Redis content key is never a fallback for Neon. A valid cache hit
can serve its public snapshot until expiry during a Neon outage.

The cache uses a separate SDK client with a 2-second timeout, retries disabled,
and automatic pipelining disabled; session/rate-limit clients are unaffected.
No process-local cache or per-client read-your-writes assumption is needed.
Direct SQL/operator mutations must explicitly invalidate or allow the TTL bound.
The explicit operator-selected Redis rollback backend remains supported without
this public cache; a source change is never selected automatically.

See [cache validation](redis-cache-validation.md) for evidence and staging gates.

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
4. On success, appends a video entry to product payload (`videos[]`) with `muxPlaybackId` and `muxAssetId`.

At render time, detail page supports multiple videos and prefers Mux playback for each entry. Legacy single-video fallback (`video`) still works.

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

- Product/section routes use dynamic rendering; the homepage remains static.
- Global `AutoReloader` triggers `router.refresh()` every 30 minutes for long-open tabs.
- Navigation is sticky and auto-hides on downward scroll.

## Security Model

- `/admin/*` is guarded by `proxy.ts` checking `admin_session` cookie presence.
- Server-side admin route handlers validate full session state against Redis and HMAC-hashed client IP.
- Admin sessions expire after 3 hours.
- Admin credentials are stored with salted `PBKDF2-SHA256` hashing.
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

## Migration controls

`PERSISTENCE_BACKEND=postgres` requires a verified import and DATABASE_URL (the runtime prefers the least-privilege APP_DATABASE_URL when set). Backend failures never silently switch storage. SQL credential provisioning and product append are atomic. `DATA_WRITE_PAUSED=1` rejects persistent mutation routes with 503 and defers legacy credential upgrades. Content reads never initialize storage. See [cutover and recovery](neon-migration.md).
