# API Reference

All routes are Next.js Route Handlers under `app/api`.

## Mission Context

These APIs power a historical education platform focused on preserving Nguyễn Trãi's legacy and increasing awareness among younger audiences.

## `GET /api/products`

Returns all products from cached Redis reads.

### Success

```json
{
  "products": []
}
```

### Errors

- `500` if read fails unexpectedly

## `POST /api/products`

Creates a new product by appending to Redis array.

### Auth

- Requires active admin session cookie (`admin_session`)
- Session is IP-bound and expires after 3 hours

### Request body

```json
{
  "title": "string",
  "description": "string",
  "fullDescription": "string (optional)",
  "images": ["https://..."],
  "videos": [
    {
      "video": "https://... (optional)",
      "muxAssetId": "string (optional)",
      "muxPlaybackId": "string (optional)"
    }
  ],
  "video": "https://... (optional)",
  "muxAssetId": "string (optional)",
  "muxPlaybackId": "string (optional)",
  "teamMembers": "string (optional)",
  "section": "string"
}
```

Notes:

- If `id` is omitted, the route assigns `Date.now().toString()`.
- `videos` is optional and allows one or many video entries per product.
- Legacy single-video fields (`video`, `muxAssetId`, `muxPlaybackId`) are still accepted for backward compatibility.
- Redis must be configured (`UPSTASH_REDIS_REST_URL`) or route returns `500`.

### Success

- `201` with `{ success: true, product: ... }`

### Errors

- `401` if admin session is missing/invalid
- `403` if request `Origin` is missing/mismatched
- `429` if rate limit exceeded
- `500` for validation/storage failures

## `DELETE /api/products`

Resets `portfolio_data_v4` to `{ products: [] }`.

### Auth

- Requires active admin session cookie (`admin_session`)

### Success

- `200` with `{ success: true, message: ... }`

### Errors

- `401` if admin session is missing/invalid
- `403` if request `Origin` is missing/mismatched
- `429` if rate limit exceeded
- `500` if Redis is missing or operation fails

## `GET /api/products/[id]`

Returns one product by stringified ID comparison.

Notes:

- Returned `product` may include `videos[]` (multi-video format).
- Legacy fields (`video`, `muxAssetId`, `muxPlaybackId`) may also be present for backward compatibility.

### Success

```json
{
  "product": {
    "id": "..."
  }
}
```

### Errors

- `404` if not found
- `500` on read errors

## `POST /api/upload`

Uploads a multipart file to Cloudinary using `cloudinary.uploader.upload_stream`.

### Auth

- Requires active admin session cookie (`admin_session`)

### Form data

- `file` (required)
- `resourceType` (`image` | `video` | `auto`, optional; defaults to `auto`)

### Success

Returns Cloudinary upload result JSON (includes `secure_url`).

### Errors

- `400` when file missing
- `401` if admin session is missing/invalid
- `403` if request `Origin` is missing/mismatched
- `413` if file size exceeds route limit
- `429` if rate limit exceeded
- `500` on Cloudinary failure

## `POST /api/get-summary`

Generates a Vietnamese 2-3 sentence summary.

### Request body

```json
{ "text": "..." }
```

### Provider behavior

- Uses Gemini when `GEMINI_API_KEY` is configured
- Falls back to Mistral when Gemini key is unavailable
- Returns `500` if neither provider is configured
- If `BRAINTRUST_API_KEY` is set, logs LLM trace spans to Braintrust

### Success

```json
{ "summary": "..." }
```

### Errors

- `400` if `text` missing
- `500` provider/config/runtime errors

## `POST /api/suggest-title`

Returns 3 Vietnamese title suggestions for a partially typed title.

### Request body

```json
{
  "text": "partial title",
  "section": "section name"
}
```

### Provider behavior

- Gemini first, then Mistral fallback
- Attempts strict JSON parsing, then bracket extraction, then line fallback
- If `BRAINTRUST_API_KEY` is set, logs LLM trace spans to Braintrust

### Success

```json
{
  "suggestions": ["...", "...", "..."]
}
```

### Errors

- `400` if `text` missing
- `500` if providers unavailable or parsing fails

## `POST /api/search-projects`

Semantic ID matching over supplied project snippets.

### Request body

```json
{
  "query": "...",
  "projects": [
    {
      "id": "...",
      "title": "...",
      "description": "..."
    }
  ]
}
```

### Provider behavior

- Mistral only (`MISTRAL_API_KEY` required)
- Model instructed to return JSON array of relevant IDs
- If `BRAINTRUST_API_KEY` is set, logs LLM trace spans to Braintrust

### Success

```json
{ "matchedIds": ["id1", "id2"] }
```

### Errors

- `400` if query missing
- `500` if key missing, provider fails, or network error

## `POST /api/mux/upload-url`

Creates a one-time Mux direct upload URL.

### Auth

- Requires active admin session cookie (`admin_session`)

### Success

```json
{
  "uploadUrl": "https://storage.googleapis.com/...",
  "uploadId": "..."
}
```

### Errors

- `401` if admin session is missing/invalid
- `403` if request `Origin` is missing/mismatched
- `429` if rate limit exceeded
- `500` if Mux credentials missing or API call fails

## `GET /api/mux/asset/[uploadId]`

Maps Mux upload/asset lifecycle to frontend-friendly statuses.

### Auth

- Requires active admin session cookie (`admin_session`)

### Success

- Upload waiting:

```json
{ "status": "uploading" }
```

- Processing:

```json
{ "status": "processing", "assetId": "..." }
```

- Ready:

```json
{ "status": "ready", "assetId": "...", "playbackId": "..." }
```

- Error state:

```json
{ "status": "error" }
```

### Errors

- `401` if admin session is missing/invalid
- `429` if rate limit exceeded
- `500` when Mux lookup fails

## `POST /api/feedback`

Creates a new feedback record as a Redis hash and indexes it with RediSearch schema.

### Request body

```json
{
  "name": "string",
  "class": "string (optional)",
  "email": "string",
  "text": "string",
  "rating": 1,
  "videoId": "string (optional)"
}
```

### Behavior

- `name`, `class`, and `email` are keyed HMAC-SHA256 hashed before storage.
- Raw PII values are never written to Redis.
- Feedback text is sanitized with `sanitize-html` before write.
- Stored key format: `feedback:record:{uuid}` (Redis Hash).
- Route ensures feedback RediSearch index schema (`feedback_idx_v1`) exists before write.
- Timestamp fields are stored as `createdAt` and `createdAtUnix`.
- Deduplication key with `SET NX EX` blocks rapid spam retries in a short window.

## `GET /api/preview`

Fetches link metadata for rich link previews.

### Query

- `url` (required): full `http`/`https` URL

### Security behavior

- Strict URL validation via `zod` + `new URL(...)`.
- Only domains in `PREVIEW_ALLOWED_DOMAINS` (or built-in defaults) are allowed.
- Subdomains are allowed only under those approved domains.
- Requests to localhost/internal/private IP ranges are blocked (IPv4 + IPv6).
- Redirects are followed manually with repeated allowlist/IP checks for every hop.
- Non-standard ports are rejected.
- Per-IP rate limit is enforced.

### Performance behavior

- Outbound fetch uses Next.js revalidation cache (`next: { revalidate: 3600 }`).
- API response uses `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.
- HTML parsing is bounded to ~50KB and timeout-protected.

### Success

```json
{
  "success": true,
  "uuid": "....",
  "id": "....",
  "createdAt": "2026-04-05T..."
}
```

### Errors

- `400` invalid payload
- `429` duplicate submission detected in dedupe window
- `429` IP rate limit exceeded
- `500` storage/runtime errors

## `POST /api/admin/auth/bootstrap`

One-time admin credential bootstrap.

### Behavior

- Generates random password server-side.
- Stores only salted `PBKDF2-SHA256` password hash in Redis.
- Returns plaintext password only on initial bootstrap.

### Errors

- `409` if credentials already initialized
- `403` if request `Origin` is missing/mismatched
- `429` if rate limit exceeded

## `POST /api/admin/auth/login`

Authenticates admin with password and creates a 3-hour IP-bound session.

### Request body

```json
{
  "password": "string"
}
```

### Success

- `200` with `{ success: true, expiresAt }` and sets `admin_session` httpOnly cookie (`SameSite=Strict`).

### Errors

- `401` invalid password/session creation failure
- `403` if request `Origin` is missing/mismatched
- `429` if rate limit exceeded

## `GET /api/admin/auth/status`

Checks whether the current cookie session is valid for the caller IP.

### Success

- `200` with `{ success: true, ... }`

### Errors

- `401` if missing/expired/invalid session

## `POST /api/admin/auth/logout`

Invalidates current admin session and clears cookie.

### Errors

- `403` if request `Origin` is missing/mismatched

## `POST /api/admin/feedback/read`

Reads hashed feedback records for admin tooling.

### Auth

- Requires active admin session cookie **and** admin password in request body.

### Request body

```json
{
  "password": "string",
  "limit": 50
}
```

### Response

- Returns only hashed identity fields (`nameHash`, `classHash`, `emailHash`) plus non-PII content fields.
- Excludes internal dedupe keys.

### Errors

- `401` if admin session is missing/invalid
- `403` if request `Origin` is missing/mismatched or password is incorrect
- `429` if rate limit exceeded
