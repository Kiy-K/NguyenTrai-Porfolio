# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (uses Turbopack)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint check
npm run clean    # Clean Next.js build cache
```

No test framework is configured in this project.

## Environment Variables

Copy `.env.example` to `.env.local`. Required variables:
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — database (all content stored in Redis key `portfolio_data_v4`)
- `CLOUDINARY_URL` + `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` — image/video uploads
- `GEMINI_API_KEY` — AI title suggestions and summarization
- `MISTRAL_API_KEY` / `AI_MODEL` — alternative AI provider
- `MUX_TOKEN_ID` + `MUX_TOKEN_SECRET` — video hosting (server-side only, never exposed to client)

## Architecture

### Data Flow

All content is stored in a single Redis JSON blob at key `portfolio_data_v4` with shape `{ products: Product[] }`. Reads go through `lib/data.ts` → `getProducts()`, which is wrapped in Next.js `unstable_cache` (15-minute TTL, tagged `products`). Writes go through `POST /api/products`, which appends to the array and calls `revalidatePath('/', 'layout')` to bust the cache.

### Content Model

The `Product` interface (`data/products.ts`) is the single content type. The `section` field (a slug from `lib/constants.ts`) determines which of the 9 category pages a product appears on. Products without a section appear nowhere in category views.

### Route Structure

- `/` — hero + `CategoryLayout` (links to the 9 sections)
- `/sections/[id]` — filters all products by `section === id`, renders `ProjectList`
- `/products/[id]` — full product detail with optional video
- `/admin` — single-page content management UI (create, upload, delete)
- `/api/products` — GET (list), POST (create), DELETE (clear all)
- `/api/products/[id]` — GET single product
- `/api/upload` — Cloudinary upload handler
- `/api/suggest-title` — AI title suggestion (called with 800ms debounce from admin form)
- `/api/search-projects` — search/filter endpoint

### Mux Video Integration

Videos are uploaded via **Mux Direct Upload** — the file goes straight from the browser to Mux, bypassing our server, making 1–2 GB uploads reliable.

**Flow:**
1. Admin picks a file → frontend calls `POST /api/mux/upload-url` (server creates a Mux Direct Upload, credentials never leave server)
2. Frontend XHRs the file directly to the one-time Mux URL (PUT), tracking upload progress
3. Frontend polls `GET /api/mux/asset/[uploadId]` (3 s interval) until `status === 'ready'`
4. On ready: `muxPlaybackId` and `muxAssetId` are stored in Redis alongside the product

**Rendering:** Product detail page checks `product.muxPlaybackId` first (renders `<MuxVideoPlayer>`), then falls back to `product.video` (Cloudinary URL via `<VideoPlayer>`) for older entries.

**Key files:** `app/api/mux/upload-url/route.ts`, `app/api/mux/asset/[uploadId]/route.ts`, `components/MuxVideoPlayer.tsx`

### AI Features

Two AI features exist: title suggestions in the admin form (`/api/suggest-title`) and content summarization (`SummarizeButton` component → `/api/get-summary`). Both support Gemini and Mistral as providers, selected via env vars.

### Styling

Tailwind CSS v4 with a fixed historical/vintage palette defined as CSS variables in `globals.css`:
- `--parchment`: `#F4EBD0`
- `--ink`: `#2C1E16`
- `--gold`: `#B8860B`
- `--accent`: `#8B3A3A`

Font: Playfair Display (Google Fonts, loaded in `app/layout.tsx`).

### Image Handling

All production images are hosted on Cloudinary. The `next.config.ts` remote patterns whitelist `res.cloudinary.com`, `upload.wikimedia.org`, `i.ytimg.com`, and `picsum.photos`. Use `next/image` for all images to get AVIF/WebP optimization.

### Utility Scripts

- `clear-redis.ts` — standalone script to wipe the Redis `portfolio_data_v4` key
- `replace-colors.js` / `replace-font.js` — project-wide search-replace scripts for theming
