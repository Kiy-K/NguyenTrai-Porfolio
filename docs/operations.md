# Operations Runbook

## Mission Context

Operational decisions should support the core product mission: preserve Nguyễn Trãi's legacy and expand youth awareness through reliable access to high-quality historical content.

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
- Add Gemini/Mistral keys: AI summary/title enabled; public search works locally without keys

## Data Operations

### Clear all content

Use admin button in `/admin` (`Xóa toàn bộ dữ liệu`) or call:

```http
DELETE /api/products
Content-Type: application/json

{ "confirm": "XÓA TOÀN BỘ" }
```

This resets the product list in the selected persistence backend; it does not clear feedback, credentials, or Redis temporary state.
This operation requires a valid admin session and the exact confirmation phrase (otherwise `400`). The response's `deleted` array holds everything that was cleared; keep it — the admin button saves it automatically as a JSON file. Server-side recovery otherwise relies on Neon point-in-time restore.

### Multi-video content writes

- In `/admin`, you can upload and attach multiple Mux videos before submitting a product.
- Product payload can persist these entries in `videos[]`.
- Legacy single-video fields are still accepted to keep old content playable.

## Admin Access Flow

1. For a new installation only, the owner configures a random `ADMIN_BOOTSTRAP_TOKEN` (at least 32 characters), enters it in the owner provisioning field on `/admin/login`, and calls `POST /api/admin/auth/bootstrap`. Empty or short configuration disables provisioning. Save the one-time password in a password manager, verify login, then remove the token. Existing administrators log in normally without this token.
2. Log in with that password (`POST /api/admin/auth/login`).
3. Admin session cookie is valid for 3 hours and tied to HMAC-hashed client IP.
4. Use `/api/admin/auth/logout` to invalidate current session.
5. Cross-site requests to sensitive admin endpoints are rejected by `Origin` checks.

## Feedback Operations

- Public submit route: `POST /api/feedback`
- PII fields (`name`, `class`, `email`) are keyed HMAC-SHA256 hashed before write.
- Stored in the selected backend with original source keys, `createdAt`, and `createdAtUnix`; PostgreSQL uses `portfolio.feedback`.
- Redis reads use `feedback_idx_v1`; PostgreSQL reads use bounded newest SQL queries.
- Feedback text is sanitized with `sanitize-html` before write.
- Duplicate bursts are throttled with short-lived Redis dedupe keys.
- IP-based rate limits are also enforced on feedback submission.
- Admin read route: `POST /api/admin/feedback/read` requires active session and password re-check.

## Link Preview Security

- Route: `GET /api/preview`
- External fetch targets are restricted to a domain allowlist (`PREVIEW_ALLOWED_DOMAINS` env var).
- Private/internal IP ranges and localhost-style targets are blocked.
- Redirect chains are validated hop-by-hop before each outbound request.
- Endpoint uses timeout + bounded read size and per-IP rate limiting; it fails closed (`503`) when Redis is unreachable.

## Build and Production

```bash
npm run build
npm run start
```

## Caching Notes

- Public product reads use the namespaced 60-second Redis cache; Neon remains the source.
- Successful Neon mutations invalidate it across instances. Redis cache failures fall back to direct Neon reads; a failed invalidation leaves at most the read-start +60s staleness bound.
- Admins can use authenticated `GET /api/products?fresh=1` for uncached content.
- Product APIs are no-store; product/section pages are dynamic. See [architecture](architecture.md) and [staging gates](redis-cache-validation.md).
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
- If uploading many videos for one product, verify each upload reaches `ready` in admin before submitting.

### AI errors (summary/title)

Symptoms:

- Summaries/suggestions fail with `500`

Checks:

- Set `GEMINI_API_KEY` for summary/title primary path
- Set `MISTRAL_API_KEY` as fallback
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
- Focused security tests run with `npm test`; lint and separate TypeScript checks run with `npm run lint` and `npm run typecheck`.
- Deployment verification and recovery prerequisites: [M0A security baseline](security-m0a.md).
- Section matching uses section names, not IDs.
- Product IDs are time-based strings when omitted.
- Product media may use either `videos[]` (multi-video) or legacy single-video fields.

## Neon migration

Follow [Neon migration operations](neon-migration.md) for protected export, endpoint verification, transactional import, write pause, cutover, and rollback. Keep sessions/rate limits in Redis and preserve the source records.
