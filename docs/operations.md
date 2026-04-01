# Operations Runbook

## Local Development

### 1. Install + run

```bash
npm install
cp .env.example .env.local
npm run dev
```

### 2. Verify baseline

- Home page: `http://localhost:3000/`
- Admin page: `http://localhost:3000/admin`
- API list: `GET /api/products`

## Environment Setup Strategy

You can run with partial integrations enabled:

- Redis only: content CRUD works, no AI/media extras
- Redis + Cloudinary: image upload works
- Redis + Cloudinary + Mux: full media pipeline
- Add Gemini/Mistral keys: AI summary/title/search enabled

## Data Operations

### Clear all content

Use admin button in `/admin` (`Xóa toàn bộ dữ liệu`) or call:

```http
DELETE /api/products
```

This resets Redis key `portfolio_data_v4` to an empty list.

## Build and Production

```bash
npm run build
npm run start
```

## Caching Notes

- Product reads are cached for 30 minutes (`unstable_cache`).
- Mutation endpoints call `revalidatePath('/', 'layout')`.
- A client auto-refresh runs every 30 minutes to refresh stale tabs.

## Troubleshooting

### Redis-related issues

Symptoms:

- Empty product lists despite expected data
- `500` from product write routes

Checks:

- Confirm `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- Ensure Redis key format is `{ products: [...] }`

### Cloudinary upload failures

Symptoms:

- `/api/upload` returns `500`

Checks:

- Validate `CLOUDINARY_URL`
- Verify upload preset/account permissions
- Inspect server logs for Cloudinary error message

### Mux upload never reaches ready

Symptoms:

- Admin upload state stuck on processing
- Polling endpoint reports errors/timeouts

Checks:

- Confirm `MUX_TOKEN_ID` + `MUX_TOKEN_SECRET`
- Verify `APP_URL` is valid for your deployment origin
- Confirm `NEXT_PUBLIC_MUX_DATA_ENV_KEY` is set for player telemetry context

### AI errors (summary/title/search)

Symptoms:

- Summaries/suggestions fail with `500`
- Search returns provider error message

Checks:

- Set `GEMINI_API_KEY` for summary/title primary path
- Set `MISTRAL_API_KEY` for search and as fallback
- Confirm outbound network access to provider endpoints

## Observability

OpenTelemetry is initialized in `instrumentation.ts` via `@vercel/otel`.

If you need custom propagation targets, set:

- `OTEL_PROPAGATE_CONTEXT_URLS` as comma-separated URL prefixes

## Known Constraints

- No authentication on `/admin` or API routes (currently open).
- No automated test suite configured.
- Section matching uses section names, not IDs.
- Product IDs are time-based strings when omitted.
