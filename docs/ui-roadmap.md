# Nguyen Trai: UI/UX and Search Roadmap

**Status:** Proposed, awaiting owner review  
**Baseline:** `main` at `1c74f3d` (2026-10-17), after PRs #26, #27 and #28  
**Principle:** Small, testable PRs. Preserve the historical identity and production reliability.

## Objectives and non-goals

- Make the public site pleasant and predictable on mobile and desktop, with consistent typography, spacing, media and feedback.
- Replace public-facing AI search with a dedicated **local full-text search library**. Search must work without AI API keys, paid search infrastructure or user-content transmission to a model.
- Improve admin workflows without changing their security boundary.
- Measure improvements before adding more state-management or caching frameworks.

Do not rewrite Next.js, replace Neon/Redis, change media providers, deploy automatically, execute a rollback, or add AI features under this roadmap. Content and media URLs/IDs must remain intact. Keep the existing parchment/gold/burgundy palette and Vietnamese copy.

## Shipped baseline (do not redo)

- PR #16 and #20-#24: verified Neon persistence, least-privilege production account and recovery documentation.
- PR #26: pause-gated Neon-to-Redis reconciliation tool; **a real production rollback was not performed**.
- PR #27: shared 60-second public Redis cache-aside, with authenticated fresh reads and invalidation.
- PR #28: streamed, layout-matched skeletons for public content/admin authentication/link previews; production deployed.

## P0 — Replace AI search with MiniSearch (NEXT)

**Decision:** Use [MiniSearch](https://github.com/lucaong/minisearch), an in-memory JavaScript full-text search library with prefix matches, typo tolerance and field boosts. At the current scale (~31 products at the last verified inventory), a local index is sufficient. [Fuse.js](https://www.fusejs.io/) is a simpler fallback if MiniSearch is demonstrably worse; do not introduce hosted search, embeddings, Orama vector search or Pagefind's build-time indexing.

**Existing code:** `components/ProjectList.tsx` currently combines substring matching with a debounced public POST to `/api/search-projects`. `app/api/search-projects/route.ts` calls Mistral using a client-supplied project array. This is unnecessary and can fail without API keys.

**Implementation PR (separate from this document):**
1. Add a small, typed, pure search adapter around MiniSearch; index **public products only**. Build the index once per change in the received product list (e.g. `useMemo`). Do not index credentials, admin records or private feedback.
2. Index title, tags, description and optional section. Use explicit boosts so an exact title match normally ranks above tags and descriptions. Keep the original product object untouched for display/navigation.
3. Normalize **both** indexed text and query for Vietnamese: Unicode decomposition, combining mark removal, lowercasing, `đ/Đ` normalization; preserve original accented text in the UI. Test `Nguyễn Trãi` / `nguyen trai` and `nhân nghĩa` / `nhan nghia`.
4. Support word-prefix matching and bounded fuzzy tolerance; avoid overly broad one-letter typo matches and overly permissive OR ranking. Define deterministic tie-breaks; make relevance the default order when a nonempty query is present, while preserving explicit alphabetical sorting.
5. Preserve section and tag filters, pagination and no-results/reset behavior. Reset to page one when query, sort or filters change. Use stable IDs and accessible search labels.
6. Remove the search-specific AI request/state/spinner/`Sparkles` indicator and its AI placeholder. Delete the unused `/api/search-projects` route **after** verifying references/tests; update architecture/operations docs and any observability references. Do not remove unrelated summary/title endpoints or model dependencies without a separate review.
7. Keep search local to the browser; zero AI calls, zero new search API endpoints, zero additional server-side services. Search must still work offline when the already-loaded product list is present.

**Acceptance gate:** Regression tests cover no-key/offline search, Vietnamese accent folding (`đ` included), prefix and minor typos, title-vs-description ranking, tags, published-only results, deterministic sorting and pagination. Playwright checks keyboard/mobile search and zero requests to `/api/search-projects` or AI providers. Compare against the current UX using representative queries; record index size, bundle delta and latency samples. Run lint, typecheck, unit tests and production build.

## P1 — Public visual polish (small UI PRs)

- Audit and tighten typography hierarchy, section/card spacing, consistent card heights, image aspect ratio/crop, hover/focus states, empty states and mobile navigation.
- Simplify animation duration where it slows interaction; honor `prefers-reduced-motion`.
- Eliminate the remaining generic `Đang tải...` fallback in `app/(public)/page.tsx` if it can actually render; reuse the existing skeleton system instead of introducing a second one.
- Do not redesign historical imagery, replace site branding, or add new design-system packages without clear benefit.

**Acceptance gate:** Before/after screenshots at mobile `390×844` and desktop `1440×1000`, no horizontal overflow, consistent content layout, no regressions to skeleton, embedded media, navigation or Vietnamese text. Visual changes should remain reviewable in one to two PRs.

## P2 — Admin usability and maintainability

- Split the roughly 1,200-line `app/admin/page.tsx` into small form/media/feedback/security-action components, preserving current behavior and exact authentication requirements.
- Improve actionable validation, save/error/success feedback, upload progress and destructive-action wording. Keep upload progress as actual progress, not a fake skeleton.
- Evaluate whether the AI title/summarization affordances should be hidden while no providers are configured; **do not** reintroduce AI search or enable AI keys.
- Preserve confirmation and recovery behavior for bulk delete; never allow admin controls to appear before session validation.

**Acceptance gate:** Existing admin/security tests plus Playwright checks for pending/rejected/offline/accepted authentication, form validation, media state, feedback read and clear-all confirmation. No production data writes for the test suite.

## P3 — Accessibility, performance and production verification

- Run Lighthouse, keyboard-only checks and Playwright on mobile/desktop; capture baseline and after metrics for LCP, CLS and INP rather than guessing gains.
- Review visible labels, focus order, empty/error announcements, contrast and reduced-motion behavior.
- Verify actual Vercel CDN `Cache-Control`/`x-vercel-cache` for dynamic product routes and the no-store product API; the isolated cache staging suite did not test Vercel CDN behavior.
- Record cache hit/miss and latency samples without putting credentials, content payloads or private metadata in logs.
- Validate production read-only behavior after each approved release. Keep rollback receipts and Neon/Redis backups protected.

**Acceptance gate:** A reproducible performance/accessibility report with before/after data and any remaining trade-offs; no unexplained regressions.

## P4 — Optional follow-ups, only with evidence

- **TanStack Query:** Trial on one admin panel only if manual client fetch/mutation state is a measured maintenance problem. Do not add it to public Server Components or duplicate the existing Redis server cache.
- **Search at larger scale:** Revisit an external search service or server-built index only if index download, query latency or update semantics become unsatisfactory. This is not needed for the current catalog.
- **Legacy Redis cleanup:** Revisit after a stable Neon soak period and verified recovery controls, not as part of UI/search PRs. Dependabot #15 can be reviewed separately.

## PR sequence and release rules

| Order | Branch/PR topic | Scope | Dependencies |
| --- | --- | --- | --- |
| 1 | `feat/search-minisearch` | Replace AI search; tests; docs | none |
| 2 | `ui/public-polish` | Typography, spacing, interactions | search PR reviewed |
| 3 | `refactor/admin-sections` | Admin components and UX | independent tests |
| 4 | `perf/a11y-audit` | Measurement + targeted fixes | approved UI releases |
| 5 | optional `experiment/tanstack-admin` | Small reversible spike only | proven need |

One isolated concern per PR. Each PR must show changed-file scope, tests, before/after behavior, risk and rollback. Lint/typecheck/tests/build and independent review are required. No merge, production deploy, environment change or destructive operation without explicit owner approval.

## Sources

- Current repository: `components/ProjectList.tsx`, `app/api/search-projects/route.ts`, `app/admin/page.tsx`, `docs/architecture.md`.
- [MiniSearch project/docs](https://github.com/lucaong/minisearch) for local full-text, fuzzy, prefix and field boosts.
- [Fuse.js documentation](https://www.fusejs.io/fuzzy-search.html) for the considered fallback.
- [Pagefind documentation](https://pagefind.app/docs/) for why build-time indexing is not the default here.
