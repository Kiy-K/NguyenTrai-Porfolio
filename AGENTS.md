# AGENTS.md

## Project Overview

Nguyen Trai Portfolio is a Next.js 16 App Router application for publishing historical content with admin-managed products/articles, AI-assisted writing and search, image/video upload, and Redis-backed storage.

## Product Mission

Preserve and promote the legacy of Nguyễn Trãi and raise awareness among youth through modern, accessible, and media-rich educational content.

Core stack:

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS v4
- Upstash Redis for content storage (`portfolio_data_v4`)
- Upstash RediSearch schema/index for feedback reads
- Cloudinary for image upload and video fallback
- Mux for direct video uploads and playback
- Gemini and/or Mistral for AI title suggestion, summarization, and semantic search

## Setup Commands

- Install dependencies: `npm install`
- Create local env file: `cp .env.example .env.local`
- Start dev server: `npm run dev`
- Production build: `npm run build`
- Run production server: `npm run start`
- Lint: `npm run lint`
- Clean Next build cache: `npm run clean`

## Environment Notes

Required for Redis-backed CRUD:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Optional integrations:

- Cloudinary: `CLOUDINARY_URL`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- Mux: `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `NEXT_PUBLIC_MUX_DATA_ENV_KEY`, `APP_URL`
- AI: `GEMINI_API_KEY`, `MISTRAL_API_KEY`
- Observability: `BRAINTRUST_API_KEY`, `BRAINTRUST_PROJECT_NAME`, `OTEL_PROPAGATE_CONTEXT_URLS`
- Preview allowlist: `PREVIEW_ALLOWED_DOMAINS` (comma-separated domains allowed by `GET /api/preview`)

If Redis env vars are missing, read APIs can return empty results and write APIs will fail.

## Architecture and Data Flow

- Canonical content key in Redis: `portfolio_data_v4`
- Stored JSON shape: `{ products: Product[] }`
- Product type source: `data/products.ts`
- Cached reads in `lib/data.ts` using `unstable_cache` (30 minutes, `products` tag)
- Product mutations revalidate via `revalidatePath('/', 'layout')`

Important behavior:

- Section pages filter by section **name** (case-insensitive), not section id.
- Admin writes section values as human-readable section names.
- Products can include multiple videos through `videos[]`; legacy single-video fields remain supported.

## Route Map

Pages:

- `/`
- `/sections/[id]`
- `/products/[id]`
- `/admin`

APIs:

- `GET /api/products`
- `POST /api/products`
- `DELETE /api/products`
- `GET /api/products/[id]`
- `GET /api/preview`
- `POST /api/feedback`
- `POST /api/upload`
- `POST /api/suggest-title`
- `POST /api/get-summary`
- `POST /api/search-projects`
- `POST /api/mux/upload-url`
- `GET /api/mux/asset/[uploadId]`
- `POST /api/admin/auth/bootstrap`
- `POST /api/admin/auth/login`
- `GET /api/admin/auth/status`
- `POST /api/admin/auth/logout`
- `POST /api/admin/feedback/read`

## Coding Conventions

- Use TypeScript and preserve existing Next.js App Router patterns.
- Prefer minimal, focused changes; avoid broad refactors unless requested.
- Keep docs aligned with implemented behavior from source code.
- Use `rg` for fast codebase search.
- Do not introduce behavior changes in docs-only tasks.

## Testing and Validation

This repository currently has no automated test suite.

For most changes, run:

- `npm run lint`
- `npm run build` (for integration-level confidence when changes affect routing, APIs, or build behavior)

For API changes, manually sanity-check relevant endpoints from `/admin` and/or HTTP calls.

## Media and AI Implementation Notes

Image flow:

- Admin uploads to `POST /api/upload` -> Cloudinary `secure_url` stored in product images.

Video flow:

- Admin requests URL from `POST /api/mux/upload-url`
- Browser uploads directly to Mux
- Client polls `GET /api/mux/asset/[uploadId]` until ready
- Persist each successful upload as an entry in `videos[]`
- Product page renders multiple videos, preferring Mux player per entry and falling back to Cloudinary `video` URL for legacy records

AI providers:

- `POST /api/suggest-title`: Gemini first, Mistral fallback
- `POST /api/get-summary`: Gemini first, Mistral fallback
- `POST /api/search-projects`: Mistral only

## Security and Operational Constraints

- `/admin` uses session auth (`admin_session` cookie) and redirects to `/admin/login` when missing (guarded by `proxy.ts`).
- Admin mutation routes and admin feedback read route validate Redis-backed session + IP hash.
- Admin sessions expire after 3 hours.
- Feedback route hashes `name`, `class`, and `email` via SHA-256; do not introduce raw-PII storage.
- Feedback text is sanitized with `sanitize-html` before write.
- Feedback records are written as Redis hashes (`feedback:record:{uuid}`) and queried through RediSearch index `feedback_idx_v1`.
- Link preview route only fetches allowlisted domains and blocks internal/private network targets to mitigate SSRF.
- Sensitive admin mutation/auth routes enforce same-origin `Origin` checks.
- Redis-backed rate limiting is active on admin auth/mutations and feedback submit/read routes.
- Avoid committing secrets from `.env.local`.
- Keep provider failures graceful (clear error responses, no secret leakage).

## Agent Workflow Guidance

Before finishing a task:

1. Run relevant checks (`npm run lint`, and `npm run build` when appropriate).
2. Keep changes scoped to the user request.
3. Update docs when behavior, env requirements, or routes change.
4. Note residual risks if checks cannot be run locally.

## Reference Docs

- `README.md`
- `docs/architecture.md`
- `docs/api.md`
- `docs/operations.md`
- `CLAUDE.md`
