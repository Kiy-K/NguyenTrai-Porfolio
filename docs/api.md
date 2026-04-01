# API Reference

All routes are Next.js Route Handlers under `app/api`.

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

### Request body

```json
{
  "title": "string",
  "description": "string",
  "fullDescription": "string (optional)",
  "images": ["https://..."],
  "video": "https://... (optional)",
  "muxAssetId": "string (optional)",
  "muxPlaybackId": "string (optional)",
  "teamMembers": "string (optional)",
  "section": "string"
}
```

Notes:

- If `id` is omitted, the route assigns `Date.now().toString()`.
- Redis must be configured (`UPSTASH_REDIS_REST_URL`) or route returns `500`.

### Success

- `201` with `{ success: true, product: ... }`

### Errors

- `500` for validation/storage failures

## `DELETE /api/products`

Resets `portfolio_data_v4` to `{ products: [] }`.

### Success

- `200` with `{ success: true, message: ... }`

### Errors

- `500` if Redis is missing or operation fails

## `GET /api/products/[id]`

Returns one product by stringified ID comparison.

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

### Form data

- `file` (required)
- `resourceType` (`image` | `video` | `auto`, optional; defaults to `auto`)

### Success

Returns Cloudinary upload result JSON (includes `secure_url`).

### Errors

- `400` when file missing
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

### Success

```json
{ "matchedIds": ["id1", "id2"] }
```

### Errors

- `400` if query missing
- `500` if key missing, provider fails, or network error

## `POST /api/mux/upload-url`

Creates a one-time Mux direct upload URL.

### Success

```json
{
  "uploadUrl": "https://storage.googleapis.com/...",
  "uploadId": "..."
}
```

### Errors

- `500` if Mux credentials missing or API call fails

## `GET /api/mux/asset/[uploadId]`

Maps Mux upload/asset lifecycle to frontend-friendly statuses.

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

- `500` when Mux lookup fails
