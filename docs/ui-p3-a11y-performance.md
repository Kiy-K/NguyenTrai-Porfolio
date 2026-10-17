# UI roadmap: accessibility, performance and CDN evidence

Observed 2026-10-17. Local downstream branch: `perf/a11y-audit`, combining the independently reviewed P0/P1/P2 commits for final verification. Main and production were not changed. This report distinguishes local lab evidence from the existing release's read-only CDN observations; it is not post-release approval.

## Local environment and reproduction

Next.js 16.4.0 webpack production build, Node 24, Chromium 155 (Playwright build 1247) from the existing cache, Lighthouse 13.5.0. Synthetic 31-product catalog, read-only local Redis responder, writes paused, database/AI keys blank. Browser mutation/provider calls in admin tests are intercepted locally. Playwright blocks external traffic; Lighthouse allows the existing third-party widget and blocks Vercel analytics. These are different test profiles, reported separately.

Build/test commands: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build -- --webpack`. Build with storage/AI variables blank and `PERSISTENCE_BACKEND=redis`. Temporary harnesses:

- `/tmp/nguyentrai-p0-build.cjs <checkout>` builds with those no-service settings.
- `/tmp/nguyentrai-p0-server.cjs <checkout> 3330` starts the built app and synthetic responder.
- `/tmp/nguyentrai-p1-browser.cjs` checks public desktop/mobile interactions; `/tmp/nguyentrai-p2-browser.cjs` checks isolated admin workflows on port 3340.
- `/tmp/nguyentrai-p1-vitals.cjs before|after|after-quiet` runs the same search/sort/tag interaction sequence and captures PerformanceObserver LCP/CLS plus INP from Next's bundled web-vitals. These are lab page-lifetime samples, not real-user field INP.
- Lighthouse CLI: `CHROME_PATH=<cached Chromium binary> node <cached lighthouse>/cli/index.js http://127.0.0.1:3330/ --chrome-flags='--headless --no-sandbox' --only-categories=performance,accessibility --output=json --output-path=<report> --screenEmulation.width=390 --screenEmulation.height=844 --screenEmulation.deviceScaleFactor=1 --blocked-url-patterns='*vercel*' --quiet`. Desktop adds `--preset=desktop` and uses 1440×1000. No package was added to the project.

## Lighthouse homepage results

Baseline is the combined P0 snapshot before P1; after is P1 before the independent admin commit. The admin extraction does not change public route code. Scores are single-run lab observations, not statistical improvement claims.

| Profile | Performance | Accessibility | LCP ms | CLS | TBT ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Mobile before | 95 | 96 | 2,256 | 0 | 202 |
| Mobile after, concurrent lab jobs | 93 | 96 | 2,180 | 0 | 268 |
| Mobile after, isolated repeat | 95 | 96 | 2,179 | 0 | 227 |
| Desktop before | 100 | 96 | 572 | 0 | 17 |
| Desktop after | 100 | 96 | 575 | 0 | 19 |

The mobile performance-score dip did not persist when repeated without competing browser jobs. Blocking-time samples still vary (202–268 ms); there is no claimed speedup or statistically established regression. Rerun matched multi-sample measurements after an approved release. CLS remained zero throughout.

The remaining Lighthouse accessibility failure is inside the existing third-party ElevenLabs widget attribution: 10px text at contrast 2.06–2.1:1 versus the expected 4.5:1. Its generated attribution/link styles were not changed or hidden. It explains the unchanged 96 score and remains an external-widget follow-up. App-owned search placeholder contrast, keyboard outlines, mobile menu behavior and admin label/status associations were improved.

Raw JSON: `/tmp/nguyentrai-p1-{before,after}-lighthouse-{mobile,desktop}.json` and `/tmp/nguyentrai-p1-after-lighthouse-mobile-2.json`.

## Controlled section interactions

| Profile | Before LCP ms | Quiet after LCP ms | Before / after CLS | Before / after INP ms |
| --- | ---: | ---: | ---: | ---: |
| Desktop 1440×1000 | 132 | 124 | 0 / 0 | 16 / 16 |
| Mobile 390×844 | 112 | 108 | 0 / 0 | 24 / 16 |

The sequence types `nguyen trai`, explicitly sorts descending, and selects a tag. An earlier competing-load after sample had mobile LCP 368 ms; a quiet repeat returned 108 ms. Preserve that outlier in `/tmp/nguyentrai-p1-after-vitals.json`; do not interpret these small samples as production gains. Event timing is frame-quantized. Other receipts: `/tmp/nguyentrai-p1-before-vitals.json`, `/tmp/nguyentrai-p1-after-quiet-vitals.json`.

## Keyboard, layout and workflow checks

- Public home, section and detail at both viewport sizes: meaningful content, correct navigation, no horizontal overflow, consistent card rows, no framework overlay or uncaught page errors. Before/after screenshot paths and exact scope are in [P1 validation](ui-p1-public-validation.md).
- Native mobile menu: keyboard open, modal sequence/background inertness, Escape, opener focus, scroll restoration, desktop breakpoint close; reduced-motion durations checked. Loading shells were aligned after independent review.
- Admin: pending/rejected/offline auth hides all controls; accepted auth mounts sections. Whitespace validation, retained input after failed save, successful save, hashed feedback, image upload, real-byte progress handler with synthetic XHR events, cancel/ready media states, exact deletion phrase, Escape/focus restoration and parsed JSON recovery download pass in Chromium. All mutation requests were mocked. See [P2 validation](ui-p2-admin-validation.md).
- No new state/cache framework, hosted search, AI keys or media provider changes. Existing unit/security/persistence/cache tests remain green.

Remaining local limits: Chromium only; external embedded video playback and actual Cloudinary/Mux uploads were not exercised. Lighthouse is not a complete manual screen-reader or contrast audit. The external-widget failure remains explicit.

## Existing production: read-only CDN samples

Origin: `https://nguyen-trai-porfolio.vercel.app`. Six unauthenticated GETs at 2026-10-17T07:01:12Z; no mutation, deploy, cache purge or configuration change. Content bodies were consumed only to choose one public product route and otherwise discarded; receipts contain no content payload, product ID, credentials or private metadata.

| Route | Status | Cache-Control | x-vercel-cache | Samples ms |
| --- | --- | --- | --- | --- |
| `/api/products` | 200, 200 | `no-store` | MISS, MISS | 5,358 / 199 |
| `/sections/tu-tuong-nhan-nghia` | 200, 200 | `private, no-cache, no-store, max-age=0, must-revalidate` | MISS, MISS | 1,844 / 1,126 |
| `/products/[public-id]` | 200, 200 | same private/no-store directive | MISS, MISS | 319 / 95 |

These observations match the intended uncached CDN policy. See the current [Vercel response-header documentation](https://vercel.com/docs/headers/response-headers) and [CDN cache criteria](https://vercel.com/docs/cdn-cache) for the header interpretation. All six were misses; no hit-rate or Redis-cache effectiveness claim follows. The slow first API sample is recorded without attributing it to a cold start, database or network. CDN MISS does not expose the internal 60-second Redis cache state. Raw safe receipt: `/tmp/nguyentrai-cdn-readonly.json`; GET-only harness: `/tmp/nguyentrai-cdn-readonly.cjs`.

## Release gate and optional follow-ups

The final integrated local suite has 99 passing tests, with lint/typecheck/build gates recorded in `/tmp/nguyentrai-roadmap-final-*.log`. The final combined build also passed the public layout/menu, offline search and mocked admin workflow browser suites; the integrated admin receipt is `/tmp/nguyentrai-roadmap-admin-browser.json` (the public/search receipts retain their P1/P0a names). Independent reviews found no blocking public/admin findings; documentation was checked against the raw receipts. No main merge, push or deployment occurred; post-release read-only validation and field performance remain pending an explicitly approved release.

P4 remains evidence-gated: the current catalog fits a small local index; extracted admin components remove the immediate maintenance pressure without TanStack Query. There is no evidence here to add hosted search or to delete legacy Redis data. No optional infrastructure/dependency work was performed. Any code rollback would revert the relevant scoped commit and rebuild; data/media require no migration under these changes. Production rollback still requires owner approval.
