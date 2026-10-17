# P0a local search validation — 2026-10-17

Branch: `feat/search-minisearch`, based on `05638a4`. This is a local implementation; no push, merge, deployment, environment change or production write was performed.

## Behavior and scope

MiniSearch 7.2.0 replaces public AI matching. Search indexes only the received public section products, preserves originals for display, and works offline after loading. Relevance is the default for nonempty queries; explicit title sorting, tag intersections and ten-item pagination remain available. The search API is deleted. Summaries and title suggestions are unchanged in this branch; P0b is independent.

Vietnamese title/tags/description/section share accent and đ folding. All query terms must match. Prefixes start at two characters; one edit is allowed only for terms with at least four characters. Boosts are title 6, tags 3, section 2, description 1. Ties use Vietnamese title and stable ID. No storage, content or media migration.

## Verification

| Gate | Result |
| --- | --- |
| Baseline unit suite / webpack build | 81 passed / passed |
| Changed unit suite | 87 passed, including six new search/list tests |
| ESLint / TypeScript / webpack production build | Passed |
| Independent review | No findings |
| Desktop 1440×1000 / mobile 390×844 | Passed |
| Keyboard search, sort, tag intersection, pagination reset, empty/reset | Passed |
| Offline `nguyem trai` search | 11 matching products; no request to retired endpoint or AI providers |
| Public section / product navigation | Correct section scope, hidden draft/archive, original article body and local image rendered |
| Removed search endpoint | POST returns 404 |
| Horizontal overflow / framework overlay / runtime errors | None observed |

Playwright was used because the Browser plugin runtime described by the frontend testing skill is not installed. The tests ran against `http://127.0.0.1:3330` with a read-only synthetic Redis responder, blank AI/database keys, writes paused, and external browser traffic blocked. A missing `/image.png` in the initial fixture was corrected to the repository's `/nguyen-trai.jpg` before final screenshots. The before screenshots used the smaller baseline fixture and are useful for comparing controls, not content/image fidelity. No embedded external media playback was exercised.

## Measurements

Synthetic catalog: 31 public products in one section, plus draft, archived and out-of-section exclusion fixtures. These timings are desktop Node measurements, not mobile CPU or production INP claims. One index build took 3.24 ms; serialized index size was 7,769 bytes. Each query was sampled 500 times.

| Query | Previous local substring matches | New matches | p50 / p95 ms |
| --- | ---: | ---: | ---: |
| Nguyễn Trãi | 11 | 11 | 0.038 / 0.097 |
| nguyen trai | 11 | 11 | 0.019 / 0.041 |
| nhan nghia | 11 | 31 | 0.047 / 0.094 |
| nguy tra | 0 | 11 | 0.022 / 0.049 |
| nguyem trai | 0 | 11 | 0.019 / 0.032 |
| dai cao | 10 | 10 | 0.023 / 0.029 |
| van hoc | 31 | 31 | 0.041 / 0.055 |
| no such match | 0 | 0 | 0.009 / 0.013 |

The expanded `nhan nghia` results reflect indexing the section name. The old AI path was not invoked or benchmarked; comparison counts describe its deterministic local substring portion only.

Whole-build client JS (45 chunks, webpack, same local setup): baseline 2,216,919 raw / 652,913 gzip bytes; search branch 2,234,731 raw / 659,763 gzip bytes. Delta: **+17,812 raw / +6,850 gzip bytes**. This aggregate is not a route-specific download budget.

## Evidence and reproduction

Use Node 24 for this checkout. Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build -- --webpack` (build with storage/AI keys blank and `PERSISTENCE_BACKEND=redis` to avoid remote reads). Some child test runners fail under the execution sandbox; the full 87-test receipt was collected outside it. Build emits expected missing-service warnings with integrations disabled.

Local, temporary evidence:

- `/tmp/nguyentrai-p0a-tests24.log`, `nguyentrai-p0a-lint.log`, `nguyentrai-p0a-build.log`.
- `/tmp/nguyentrai-p0a-browser.json`, `nguyentrai-p0a-benchmark.json`.
- `/tmp/nguyentrai-p0a-{1440,390}.png`, `nguyentrai-p0a-search-{1440,390}.png`, `nguyentrai-p0a-detail-{1440,390}.png`.
- Harnesses: `/tmp/nguyentrai-p0-server.cjs`, `nguyentrai-p0-fixtures.cjs`, `nguyentrai-p0-browser.cjs`, `nguyentrai-p0-benchmark.cjs`. Start the synthetic server, then run the browser and benchmark scripts. Browser harness uses the locally installed Playwright cache; it adds no project dependency.

Risk: local full-text matching changes ranking and intentionally does not infer semantic matches. Revisit external search only with catalog-size/latency evidence. Rollback would revert this isolated change and rebuild; no data rollback is needed. Merge, release and any rollback still require owner approval.
