# P0b summary removal validation — 2026-10-17

Branch: `refactor/remove-ai-summary`, independent from `feat/search-minisearch`, based on `05638a4`. No merge, push, deployment, environment change or production data writes.

## Scope and behavior

Removed the summary control from ProjectCard, ProductCard and product details, including the detail wrapper. Deleted the component and endpoint. Removed summary-specific current API/provider/telemetry documentation. Authored descriptions/full descriptions, IDs, media references, navigation, share controls, title suggestions, security and shared provider instrumentation/dependencies are unchanged. Public AI search remains unchanged in this independent branch and is retired by P0a.

## Verification

| Gate | Result |
| --- | --- |
| Regression tests | 83 passed (baseline 81); removal/card tests failed before implementation and passed after |
| ESLint / TypeScript / webpack production build | Passed |
| Runtime source/reference scan | No summary component imports, API calls or generated-summary UI text |
| Retired endpoint | POST /api/get-summary returns 404 |
| Desktop 1440×1000 / mobile 390×844 | Passed |
| Section to detail navigation | Original title, description, full body, local image and share control present |
| Summary controls / summary requests | None |
| Horizontal overflow / framework overlay / uncaught page errors | None observed |
| Independent review | No functional/security findings; generated next-env change excluded |

Playwright used the existing local installation because the Browser plugin runtime described by the testing skill is unavailable. Target: `http://127.0.0.1:3340`, synthetic catalog only, a read-only Redis responder, writes paused, blank database/AI keys and blocked external browser traffic. The local Next server does not serve Vercel's analytics/speed-insights scripts: their two expected 404/MIME console errors are recorded in the browser receipt. No unexplained app runtime errors were observed. No external embedded-media playback or production CDN test was run.

## Evidence and reproduction

Run Node 24 `npm test`, `npm run lint`, `npm run typecheck`, `npm run build -- --webpack`, with storage and AI keys blank and PERSISTENCE_BACKEND=redis for the build. Full tests were run outside the sandbox because its child-runner restrictions produce incomplete/failing receipts. No real-service credentials are required for these checks.

Temporary evidence:

- `/tmp/nguyentrai-p0b-tests.log`, `nguyentrai-p0b-lint.log`, `nguyentrai-p0b-types.log`, `nguyentrai-p0b-build.log`.
- `/tmp/nguyentrai-p0b-browser.json`.
- `/tmp/nguyentrai-p0b-section-{1440,390}.png`, `nguyentrai-p0b-detail-{1440,390}.png`.
- Harness: `/tmp/nguyentrai-p0b-browser.cjs`; start `/tmp/nguyentrai-p0-server.cjs <worktree> 3340` first. The same synthetic fixtures as P0a preserve authored text and media.

The branch requires no migration. Any rollback would revert this isolated removal and rebuild, with owner approval; no data rollback is needed. Later public polish/admin/performance phases and production verification remain pending the roadmap gates.
