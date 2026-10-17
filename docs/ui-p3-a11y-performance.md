# UI roadmap: accessibility, performance and CDN evidence

Historical measurement snapshot: 2026-10-17, source commit [`b862a2f`](https://github.com/Kiy-K/NguyenTrai-Porfolio/commit/b862a2f). Local downstream branch: `perf/a11y-audit`, combining the independently reviewed P0/P1/P2 commits for final verification. Main and production were not changed. This report distinguishes local lab evidence from the existing release's read-only CDN observations; it is not post-release approval.

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
- Admin: pending/rejected/offline auth hides all controls; accepted auth mounts sections. Whitespace validation, retained input after failed save, successful save, hashed feedback, image upload, real-byte progress handler with synthetic XHR events, cancel/ready media states, exact deletion phrase, Escape/focus restoration and parsed JSON recovery download pass in Chromium. All mutation requests were mocked. See [P2 validation](https://github.com/Kiy-K/NguyenTrai-Porfolio/blob/review-admin-sections/docs/ui-p2-admin-validation.md).
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

## Published draft-review evidence

The report above retains the original measurement snapshot, not a claim that new metrics were measured while publishing. The integrated `b862a2f` source is preserved on `review-ui-roadmap-integrated` with only the review-ref deployment guard added. Current main remains `05638a4` and includes roadmap PR #29. No main merge or deployment was performed.

Three focused drafts separate public polish, independent admin refactoring and this report. P1 targets `review-ui-p0-foundation`, since the canonical P0 commits are pending locally rather than open GitHub PRs. P3 targets the P1 review branch; the independent admin PR targets main. The P0 foundation resolves six original documentation conflicts while preserving both removals. See [P0 compatibility](review/ui-roadmap/p0-compatibility.md).

[Committed public before/after screenshots](review/ui-roadmap/screenshots/) and [public check receipts](review/ui-roadmap/results/) are inherited from the P1 base. Admin before/after screenshots and fresh receipts are in the [independent admin review branch](https://github.com/Kiy-K/NguyenTrai-Porfolio/tree/review-admin-sections/docs/review/ui-roadmap). [Portable Lighthouse summaries](review/ui-roadmap/results/lighthouse-summary.json), [vitals](review/ui-roadmap/results/vitals-before.json), [quiet after vitals](review/ui-roadmap/results/vitals-after-quiet.json), [CDN safe receipt](review/ui-roadmap/results/cdn-readonly.json), and the original integrated 99-test/build receipts are committed here. No private content payloads or service credentials are included.

Fresh branch checks: P1 **90 tests**, P2 independently on main **90 tests**, both lint/typecheck/webpack builds pass. Original P2 had 92 tests because its base included the two summary-removal regressions. Integrated `b862a2f` has 99 tests; that original complete source and evidence are preserved. Different counts reflect the included suites, not dropped test failures.

Release gates: accept canonical P0, retarget/rebase the P1/P3 stack against updated main and rerun the combined suite; obtain owner approval before merge/deploy; perform post-release read-only validation and field measurements. Native dialog behavior remains Chromium-only and live Cloudinary/Mux uploads are untested. The external-widget contrast failure remains **2.06–2.1:1** (accessibility score 96). Mobile performance was 95 → 93 under competing jobs, then 95 in a quiet repeat; no speedup or statistically established regression is claimed. P4 remains deferred. No automatic deployment is allowed for the five named review refs in `vercel.json`; main/runtime settings are unchanged.

Draft source reviews: [P1 public polish #30](https://github.com/Kiy-K/NguyenTrai-Porfolio/pull/30) and [P2 admin sections #31](https://github.com/Kiy-K/NguyenTrai-Porfolio/pull/31). Both are drafts and mergeable against their stated bases at creation. Fresh production-only dependency audit reports zero advisories; [safe audit summary](review/ui-roadmap/results/production-audit-summary.json). GitHub CI completion is a remaining gate until its checks finish.

### Review publication checks

The five review refs were pushed with their exact `git.deploymentEnabled` entries set to false. A Vercel read-only query after draft creation observed **zero deployments** since push preparation; [guard verification receipt](review/ui-roadmap/results/deployment-guard-verification.json). No Vercel project/runtime setting was edited.

GitHub reported existing default-branch dependency alerts. A fresh full npm audit was compared against an isolated latest-main snapshot: the same eight affected development packages (six high, two moderate) appear on both sides, with **no newly affected packages**; the production-only audit is zero. [Comparison receipt](review/ui-roadmap/results/dependency-audit-comparison.json). Packaging made no dependency changes. Remediation remains separate from this UI review; P4 is not expanded or implemented.
