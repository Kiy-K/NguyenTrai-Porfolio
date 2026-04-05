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
- Admin login: `http://localhost:3000/admin/login`
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
This operation now requires a valid admin session.

## Admin Access Flow

1. Bootstrap once via `/admin/login` (`POST /api/admin/auth/bootstrap`) to get a generated password.
2. Log in with that password (`POST /api/admin/auth/login`).
3. Admin session cookie is valid for 3 hours and tied to client IP hash.
4. Use `/api/admin/auth/logout` to invalidate current session.
5. Cross-site requests to sensitive admin endpoints are rejected by `Origin` checks.

## Feedback Operations

- Public submit route: `POST /api/feedback`
- PII fields (`name`, `class`, `email`) are SHA-256 hashed before write.
- Stored as Redis hashes keyed by `feedback:{uuid}` with `createdAt` and `createdAtUnix`.
- Duplicate bursts are throttled with short-lived Redis dedupe keys.
- IP-based rate limits are also enforced on feedback submission.
- Admin read route: `POST /api/admin/feedback/read` requires active session and password re-check.

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

For Braintrust LLM traces, set:

- `BRAINTRUST_API_KEY`
- `BRAINTRUST_PROJECT_NAME` (optional)

## Known Constraints

- Admin session is IP-bound; changing outbound IP can invalidate active sessions.
- Build/runtime still requires correct env vars for Redis/Mux/Cloudinary integrations.
- No automated test suite configured.
- Section matching uses section names, not IDs.
- Product IDs are time-based strings when omitted.
