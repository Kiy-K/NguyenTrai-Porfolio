# Nguyen Trai: UI/UX, Search and AI Summary Removal Roadmap

**Status:** P0–P2 implemented locally; local P3 audit complete; release approval pending
**Baseline:** `main` at `1c74f3d` (2026-10-17), after PRs #26, #27 and #28  
**Principle:** Small, testable PRs. Preserve the historical identity and production reliability.

## Implementation status and GitHub review handoff

Current review preparation (2026-10-22) uses main `cbf43ec` with roadmap #29 and P2 #31 merged. P1 #30 and P3 #32 were merged into the P0 foundation, not main. The draft `review-ui-roadmap-integration` now combines that stack with latest main without conflicts. Its application source matches original `b862a2f` except the reviewed focus-contrast correction. Original branches and local files are preserved.

The existing focused reviews remain the source history: [P1 #30](https://github.com/Kiy-K/NguyenTrai-Porfolio/pull/30), [P2 #31](https://github.com/Kiy-K/NguyenTrai-Porfolio/pull/31), [P3 #32](https://github.com/Kiy-K/NguyenTrai-Porfolio/pull/32). The integration draft has independent P0/P1/P2/P3 review sections; P2 adds no further runtime diff against main. [Current integration evidence and gates](review/ui-roadmap/integration-review.md) supersede the older publication-state descriptions in the dated validation reports.

P0 MiniSearch and AI-summary removal are included prerequisites requiring explicit review. [Compatibility notes](review/ui-roadmap/p0-compatibility.md) distinguish original branch documentation conflicts from the conflict-free resolved integration. No merge or deployment is part of this preparation. P4 remains deferred.

## Objectives and non-goals

- Make the public site pleasant and predictable on mobile and desktop, with consistent typography, spacing, media and feedback.
- Replace public-facing AI search with a dedicated **local full-text search library**. Search must work without AI API keys, paid search infrastructure or user-content transmission to a model.
- **Remove AI-generated article summaries entirely**, including public buttons, their component and their API. Keep authored article descriptions and full text unchanged.
- Improve admin workflows without changing their security boundary.
- Measure improvements before adding more state-management or caching frameworks.

Do not rewrite Next.js, replace Neon/Redis, change media providers, deploy automatically, execute a rollback, or add AI features under this roadmap. Content and media URLs/IDs must remain intact. Keep the existing parchment/gold/burgundy palette and Vietnamese copy.

## Shipped baseline (do not redo)

- PR #16 and #20-#24: verified Neon persistence, least-privilege production account and recovery documentation.
- PR #26: pause-gated Neon-to-Redis reconciliation tool; **a real production rollback was not performed**.
- PR #27: shared 60-second public Redis cache-aside, with authenticated fresh reads and invalidation.
- PR #28: streamed, layout-matched skeletons for public content/admin authentication/link previews; production deployed.

## P0 — Retire public AI search and AI summaries

### P0a — Replace AI search with MiniSearch

**Decision:** Use [MiniSearch](https://github.com/lucaong/minisearch), an in-memory JavaScript full-text search library with prefix matches, typo tolerance and field boosts. At the current scale (~31 products at the last verified inventory), a local index is sufficient. [Fuse.js](https://www.fusejs.io/) is a simpler fallback if MiniSearch is demonstrably worse; do not introduce hosted search, embeddings, Orama vector search or Pagefind's build-time indexing.

**Planning baseline:** `components/ProjectList.tsx` combined substring matching with a debounced public POST to `/api/search-projects`. `app/api/search-projects/route.ts` called Mistral using a client-supplied project array. This was unnecessary and could fail without API keys.

**Implementation PR A (separate from this document):**
1. Add a small, typed, pure search adapter around MiniSearch; index **public products only**. Build the index once per change in the received product list (e.g. `useMemo`). Do not index credentials, admin records or private feedback.
2. Index title, tags, description and optional section. Use explicit boosts so an exact title match normally ranks above tags and descriptions. Keep the original product object untouched for display/navigation.
3. Normalize **both** indexed text and query for Vietnamese: Unicode decomposition, combining mark removal, lowercasing, `đ/Đ` normalization; preserve original accented text in the UI. Test `Nguyễn Trãi` / `nguyen trai` and `nhân nghĩa` / `nhan nghia`.
4. Support word-prefix matching and bounded fuzzy tolerance; avoid overly broad one-letter typo matches and overly permissive OR ranking. Define deterministic tie-breaks; make relevance the default order when a nonempty query is present, while preserving explicit alphabetical sorting.
5. Preserve section and tag filters, pagination and no-results/reset behavior. Reset to page one when query, sort or filters change. Use stable IDs and accessible search labels.
6. Remove the search-specific AI request/state/spinner/`Sparkles` indicator and its AI placeholder. Delete the unused `/api/search-projects` route **after** verifying references/tests; update architecture/operations docs and any observability references. AI summary removal is a separate P0b PR; leave AI title suggestions and shared provider dependencies untouched unless independently reviewed.
7. Keep search local to the browser; zero AI calls, zero new search API endpoints, zero additional server-side services. Search must still work offline when the already-loaded product list is present.

**Acceptance gate:** Regression tests cover no-key/offline search, Vietnamese accent folding (`đ` included), prefix and minor typos, title-vs-description ranking, tags, published-only results, deterministic sorting and pagination. Playwright checks keyboard/mobile search and zero requests to `/api/search-projects` or AI providers. Compare against the current UX using representative queries; record index size, bundle delta and latency samples. Run lint, typecheck, unit tests and production build.

### P0b — Remove AI summarization entirely

**Decision:** Retire on-demand summaries rather than hiding the button or replacing it with another summarizer. Editorial `description` and `fullDescription` belong to the original articles and must stay.

**Planning baseline:** `components/SummarizeButton.tsx` called `POST /api/get-summary`, routing to Gemini or Mistral. It was imported by `components/ProjectCard.tsx`, `components/ProductCard.tsx`, and `app/(public)/products/[id]/page.tsx`; those controls, component and API are now removed.

**Implementation PR B (independent, reviewable, no migration):**
1. Remove the summary button/UI from all public cards and product details, including imports, wrapper spacing and comments; preserve the normal description, article body, card links, share controls and media.
2. Verify all imports/callers, then delete the now-unused `components/SummarizeButton.tsx` and `app/api/get-summary/route.ts` instead of leaving a callable endpoint. Keep unrelated routes (`/api/suggest-title`) unchanged for now; do not expand scope to AI title suggestions without separate approval.
3. Remove summary-specific documentation and telemetry references (e.g. `docs/architecture.md`, `docs/operations.md`, `lib/braintrust.ts` references if no longer used); retain shared instrumentation and dependencies still needed by other features. Remove unused packages only after dependency/reference verification, not by assumption.
4. If any test or fixture expects summaries, update it deliberately. No generation, no background summaries, no AI API keys and no data rewrite; existing authored `description` fields are **not** generated summaries.
5. Keep the final layout coherent: closing the summary panel should not leave blank cards, mismatched heights or broken responsive skeleton transitions.

**Acceptance gate:** Source/reference scan shows no `SummarizeButton` import or call to `/api/get-summary`; public UI contains no `Tóm tắt bằng AI` control; removed endpoint is no longer exposed; card/detail pages render existing article text and media unchanged. Test desktop/mobile navigation and layout, run lint, typecheck, tests and production build. No production mutation or rollout without explicit owner approval.

## P1 — Public visual polish (small UI PRs)

- Audit and tighten typography hierarchy, section/card spacing, consistent card heights, image aspect ratio/crop, hover/focus states, empty states and mobile navigation.
- Simplify animation duration where it slows interaction; honor `prefers-reduced-motion`.
- Eliminate the remaining generic `Đang tải...` fallback in `app/(public)/page.tsx` if it can actually render; reuse the existing skeleton system instead of introducing a second one.
- Do not redesign historical imagery, replace site branding, or add new design-system packages without clear benefit.

**Acceptance gate:** Before/after screenshots at mobile `390×844` and desktop `1440×1000`, no horizontal overflow, consistent content layout, no regressions to skeleton, embedded media, navigation or Vietnamese text. Visual changes should remain reviewable in one to two PRs.

## P2 — Admin usability and maintainability

- Split the roughly 1,200-line `app/admin/page.tsx` into small form/media/feedback/security-action components, preserving current behavior and exact authentication requirements.
- Improve actionable validation, save/error/success feedback, upload progress and destructive-action wording. Keep upload progress as actual progress, not a fake skeleton.
- AI title suggestions remain a separate, deferred feature. Review their visibility when no provider is configured, but do not reintroduce AI search/summaries or enable AI keys.
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
| 2 | `refactor/remove-ai-summary` | Delete summary UI, component and endpoint; update docs/tests | separate from search PR |
| 3 | `ui/public-polish` | Typography, spacing, interactions | P0 PRs reviewed |
| 4 | `refactor/admin-sections` | Admin components and UX | independent tests |
| 5 | `perf/a11y-audit` | Measurement + targeted fixes | approved UI releases |
| 6 | optional `experiment/tanstack-admin` | Small reversible spike only | proven need |

One isolated concern per PR. Each PR must show changed-file scope, tests, before/after behavior, risk and rollback. Lint/typecheck/tests/build and independent review are required. No merge, production deploy, environment change or destructive operation without explicit owner approval.

## Sources

- Current repository: `components/ProjectList.tsx`, `app/api/search-projects/route.ts`, `components/SummarizeButton.tsx`, `app/api/get-summary/route.ts`, `components/ProjectCard.tsx`, `components/ProductCard.tsx`, `app/(public)/products/[id]/page.tsx`, `app/admin/page.tsx`, `docs/architecture.md`.
- [MiniSearch project/docs](https://github.com/lucaong/minisearch) for local full-text, fuzzy, prefix and field boosts.
- [Fuse.js documentation](https://www.fusejs.io/fuzzy-search.html) for the considered fallback.
- [Pagefind documentation](https://pagefind.app/docs/) for why build-time indexing is not the default here.
