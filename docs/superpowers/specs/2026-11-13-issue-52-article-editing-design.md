# Issue #52: Safe administrator article editing

Approved by the owner in this session. Source: https://github.com/Kiy-K/NguyenTrai-Porfolio/issues/52.

## Intent and scope
Administrators can correct one existing article without recreating it, losing media, exposing private records, or overwriting another edit. Reuse the existing article form and validation. No migrations, production writes, media deletion, article deletion, section changes, redesign, new providers, deployment or automatic merge.

## Approach
Add a searchable list at `/admin`, loaded only after authentication through the existing uncached `GET /api/products?fresh=1`. Select one article, prepopulate `ArticleForm`, and provide Save/Cancel, dirty-state warnings, and recoverable errors. Existing create behavior stays available.

Extract the existing input schema and bounded JSON reader for POST/PATCH reuse. PATCH accepts only editable fields and a concurrency token; protected fields and unrecognized stored legacy fields remain server-owned. Tokens describe the complete stored record, not only editable fields; expose tokens only in authenticated admin responses.

Neon edits conditionally replace the unique matching JSONB array element in a single atomic UPDATE with a current-record comparison. Concurrent changes to other records survive, order stays unchanged, stale edits return 409, missing IDs return 404, and duplicate IDs fail closed. Success invalidates the shared public Redis cache using the existing contract. A failed save never invokes media deletion.

Redis rollback editing returns an explicit, documented 503 unsupported response without mutation. This is the issue's permitted fail-closed alternative to implementing a second CAS backend. Unsafe read/modify/write and unconditional replacement are rejected because they lose concurrent writes.

## Preservation and security
Retain original IDs (including numeric legacy IDs), createdAt, status, tags, unmodified legacy data, media identifiers, image/video order, neighboring records, and outer document fields. Explicitly clearing an editable optional field is distinct from omitting it. Do not normalize untouched historical media into a lossy representation.

PATCH enforces strict origin, write pause, admin session/IP, rate limits, bounded input, schema validation, no-store responses and nonsensitive errors. Draft/private data never travels through public endpoints for this workflow.

## Verification and delivery
Use Node 26.13.0 and Bun 1.4.4 (current installed versions), existing dependencies and tests. Exercise endpoint guards, validation, malformed/oversize input, metadata stripping, legacy preservation, missing/duplicate IDs, stale concurrent edits, atomic SQL behavior, Redis fail-closed behavior and cache invalidation. Run full tests, lint, typecheck and production build; smoke public cards/detail/search/SEO and authenticated editing at 390×844 and 1440×1000 with keyboard interaction. Obtain independent findings-only review and resolve actionable findings. Open a draft PR with exact evidence, limitations and rollback instructions.

## Workspace constraints
The initial working tree contains unrelated and toolchain changes. Preserve them; do not silently stage them with the feature. No production credentials or private article data in fixtures, screenshots, logs or PR evidence.
