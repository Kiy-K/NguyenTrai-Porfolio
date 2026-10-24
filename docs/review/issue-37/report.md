# Issue 37: mobile LCP investigation

## Disposition

**Report-only: neither preregistered one-factor arm produced a reproducible mobile LCP benefit. No application code, dependency, image, preload, geometry or animation change ships.** Preserve the existing fallback and current responsive layout. This report is separate from issue 34's TBT finding and excludes P4.

## Matched historical/current diagnosis

New measurements use historical `97da6087a6969975fbb360c3ec966ac6c723fb6d` and current `e081fff4317e75205b02066bf23668674425a791`. The investigator initially used local main at `e081fff`; final remote verification found main at `d5244614acc64bc53956aac7959802c20d433052` (merged #35). [Exact Git-blob equivalence proof](main-equivalence.json) confirms all application/config/lockfile blobs are identical; the intervening changes are issue #34 docs/harness/tests and its deployment guard. The draft is rebased onto remote main. Measurements retain their original `e081fff` source identity, rather than being relabeled as runs of `d524461`. Both targets use Node 24.22.1, Lighthouse 13.5.0, Puppeteer 25.14.0, chrome-launcher 1.2.2 and Chromium 155/build1247. Exact source, binary, fixture, font and portrait hashes are in [build-manifest.json](build-manifest.json). Lockfiles are revision-specific; current includes PR #36's patched sanitizer. No application compatibility edits were required on the historical baseline. Next generated next-env.d.ts's type reference during builds, recorded in manifest status. Before PATH was pinned, an unsuccessful historical dependency installation selected Node26; it was rerun under24.22.1 before any build or measurement.

The [primary protocol](protocol.md), [A/B protocol](ab-protocol.md), plan files and collector were frozen before their measurements. All scores use identical synthetic content, blocked admin prefetch, cold browser/storage, warmed server/optimizer and the same empty widget-off replay profile. No live third-party response enters any scored run. This isolates the widget-off issue #37 symptom and does not establish widget-on performance or field equivalence. Effective throttling, viewports, host load and timestamps are in each receipt. No installs/builds/tests ran during scoring; ambient desktop/OS load cannot be excluded.

Primary mobile: five sequential samples per target; desktop: two per target. Values are median [min–max], milliseconds unless noted. Preserve the high historical LCP sample; no outliers were removed.

| Target | Mobile LCP | Mobile TBT | Desktop LCP | Desktop TBT |
| --- | ---: | ---: | ---: | ---: |
| Historical | 2260 [2166–2596] | 133 [106.5–134.5] | 626 [611–641] | 12 [10–14] |
| Current | 2703 [2647–2767] | 189.5 [150–214] | 615 [587–644] | 16.5 [16–17] |

CLS 0 and widget-off accessibility 100 in all primary samples. The443ms mobile difference persists on patched Node; it compares different LCP elements. Historical TBT is lower in this phase; do not claim TBT equivalence or pool these timings with issue #34's older Node/runtime/prefetch conditions. This task is not a new disposition of the earlier 609–665ms TBT reports.

### Candidate geometry and waterfall

All historical mobile samples identify the quotation; all current mobile samples identify the portrait. Representative observed candidates: historical quotation at 136ms, LCP size 38,293; current navigation brand text at 116ms followed by portrait at 468ms, size 33,856. These observed times are distinct from Lighthouse's simulated 2260/2703ms medians.

Fixed 390x844/DPR 1 geometry after font readiness:

| Element | Historical box and location | Current box and location |
| --- | --- | --- |
| Portrait pixels inside border | 184x184 at(103,457), fully visible | 184x184 at(103,318), fully visible |
| Quotation | 262x156 at(64,677), fully visible | 291x65 at(49.5,538), fully visible |

The old narrower text column wraps the quotation across four lines; current displays two lines. Bounding-box area is not the browser's exact painted-glyph LCP area, but the trace confirms the ranking change. The portrait itself is not larger on mobile. Enlarging quotation text or hiding the portrait would game the metric and is excluded. [Historical screenshot](screenshots/baseline-mobile.png), [current screenshot](screenshots/current-mobile.png), [fixed-viewport receipts](results/browser/).

Current already emits **one image preload plus the image in initial production HTML**, with matching responsive srcsets/sizes. The historical image is also in initial HTML, but lazy with default100vw and no image preload. [SSR attributes](ssr-image.json). The client component and `useState` fallback do not prevent resource discoverability. Do not replace them with server-only markup without evidence; the fallback requires a client handler. The [Next.js image implementation](https://github.com/vercel/next.js/blob/canary/packages/next/src/client/image-component.tsx) documents the client event-handler requirement; installed16.4.0 source was inspected as well.

The same original JPEG is 325,059 bytes and hashes identically. Actual mobile responses are **AVIF**, historical 640w/33,413 bytes versus current 256w/10,136 bytes. Current DPR 3 selects 640w; desktop DPR 1 selects 256w instead of historical 1920w. The original JPEG is not the scored transfer. Both formats are enabled in next.config; Chromium negotiates AVIF. No static-import or smaller-width arm was warranted: current's configured widths already select the smallest available width >=192px. No formats/config changes ship.

Representative current audited request starts at27.5ms, requestStart47.8, responseStart57.5, responseEnd59.3; parser/preload discovery, one optimized navigation image request. Historical image resource starts114.7ms, responseStart125.5, responseEnd126.6. Request initiators, initial/changed priorities and waterfall live in every receipt and full report. Lighthouse flags the explicit high-priority hint as absent on current, despite early discovery; the A/B tests that hint without duplicating preload.

### Observed subparts and render delay

Current mobile observed insight medians [min–max], **not simulated LCP decomposition**:

| Subpart | ms |
| --- | ---: |
| Document TTFB | 14.77 [11.95–16.60] |
| Resource discovery/load delay | 12.15 [10.73–12.99] |
| Resource load duration | 31.83 [30.99–35.98] |
| Element render delay | 384.07 [351.61–407.16] |

`ResourceTiming.responseStart-requestStart` gives image request TTFB (representative 9.7ms); this differs from document TTFB and includes local interception/transport scheduling. Load duration above spans discovery/fetch completion according to the Lighthouse insight. Raw timing definitions are retained instead of forcing a false sum against simulated2703ms. Independent medians need not add to the median candidate timestamp. Historical quotation has no image-load subparts: observed document TTFB 14.91ms and render-delay 122.87ms medians.

Current fonts become ready around 198–227ms, before final portrait LCP at 412–468ms. A representative full trace has one AVIF `Decode Image` event of 5.915ms wall-clock (2.208ms thread time), with paint near the late portrait candidate. This does not make the384ms presentation gap a 384ms image decode. HTML/stream reveal, main-thread scheduling, hydration/error replay and rendering can contribute; the evidence does not isolate the client state boundary as the cause. Installed next/image also resets img.src after mount when an onError handler exists, to replay pre-hydration errors. Removing the handler would change failure behavior and is not an acceptable speculative fix.

Cold optimizer diagnostics are separate: current's first 256w AVIF MISS took 229ms,640w 574ms,1920w 1479ms; all scoring followed warm-up. Per-round HIT/MISS/type/size/hash receipts make server state explicit. This does not estimate cold Vercel edge/image-cache performance and no CDN cache was purged.

Lighthouse restores emulation after auditing. Consequently final `presentation.image`/`quotation` rectangles and currentSrc in collector receipts can describe its post-audit viewport and are NOT used as mobile geometry. Use trace-time candidate rectangles, insight rectangles, ResourceTiming and trace PaintImage URLs/widths. Extra CDP requests during teardown/resizing are not duplicate initial preloads. The fixed-viewport browser suite supplies settled layout. With JavaScript disabled, the current preload still downloads the optimized image, but the streamed hidden segment is not revealed; this is discovery evidence only, not visual no-JavaScript support.

## Controlled one-factor A/B

Five mobile and two desktop samples per arm/control, all sequential in the same fresh phase. Median [min–max]:

| Arm | Mobile LCP ms | Mobile TBT ms | Desktop LCP ms | CLS | Accessibility |
| --- | ---: | ---: | ---: | ---: | ---: |
| Unchanged current control | 2695 [2646–2808] | 203 [159–277.5] | 588 [580–597] | 0 | 100 |
| Synchronous decode | 2680 [2643–2788] | 187 [158–267.5] | 596 [583–609] | 0 | 100 |
| Explicit fetch priority high | 2752 [2703–2887] | 251 [219–298] | 600 [575–625] | 0 | 100 |

Decode-sync difference of medians is **-15.64ms (-0.58%)**, with 3/5 favorable paired deltas: `[-20.48, +33.99, -51.44, -57.65, +33.71]ms`. Fetch-high is **+56.78ms (+2.11%)**, with 1/5 favorable deltas: `[-22.56, +101.26, +8.02, +35.57, +241.11]ms`. These do not pass the preregistered >=100ms/5% median reduction and 4/5 favorable pairs. Small improvements or different real-device conditions are not ruled out; these arms do not justify shipping here. No winner exists for a confirmation or widget-on block. All 21 A/B samples and 14 primary samples, including their spread/outliers, remain committed; no scored run failed or was replaced.

The high-priority arm makes the discovery checklist pass but does not improve LCP. The synchronous arm retains the late portrait candidate. Faster discovery/decode hints cannot be inferred to solve the render gap. The unchanged control's separate primary/A-B medians (2703/2695ms) are close here, but phases are not pooled. The broad candidate/layout difference is more informative than pretending the historical quotation and current portrait measure the same element.

Exact experimental commits and one-line patches are preserved in [experiments](experiments/), with source bundles permitting reconstruction without publishing experimental application branches. The control is unchanged current, measured again in the same phase. Do not compare a later arm against the earlier primary control to claim improvement.

## Bundle accounting

[Raw bundle accounting](bundle-evidence.json) uses only Script resources from each audited mobile navigation; admin prefetch is blocked in all targets. Primary historical/current transfer medians are 160,436/160,721 bytes; decoded 506,769/507,508 bytes. A/B unchanged current, decode-sync and fetch-high transfer 160,721/160,728/160,739 bytes; decoded 507,508/507,522/507,529 bytes. The experimental props add 7/18 transferred bytes and 14/21 decoded bytes respectively. None of those experimental application changes ship. Investigation tools/docs/tests are not imported by the app. Application and dependency source delta from current main is zero. Final standalone-install build hashes are not byte-identical: both builds emit 44 JS chunks; total emitted JS is 2,231,021→2,231,023 bytes (+2), independently gzipped totals 658,044→658,031 bytes (-13). These include non-homepage/admin chunks and are not navigation transfer estimates. Hashes/totals are recorded in bundle-evidence.json; this build variation is not claimed as an optimization. No byte-equivalence assumption is made from unchanged source alone.

Exact tool dependency lockfiles, installed package source hashes and canonical file-list hashes are committed in [tools](tools/), in addition to the Node/Chromium binary and collector hashes. [Reproduction](reproduce.md) restores those lockfiles, avoiding transitive tool drift.

## Regression gates and limits

Patched Node **24.22.1**, npm **11.19.1**, on the final rebased branch:

- **109/109 tests pass**, including the new incomplete/mixed-cell/outlier and benefit-threshold checks; the reused harness safety/provenance suite passes 2/2.
- **Lint, typecheck and credential-isolated production webpack build pass**, with a standalone locked dependency installation. Next initially stops after compilation to display a security advisory; the unchanged retry exits 0. The first failure and successful retry are both retained. Passing the build does not resolve or sign off that advisory.
- Desktop/mobile public and offline-search Playwright suites pass. Fixed 390/1440 viewports and DPR3 show the real portrait, expected optimized URL, no overflow and retained alt text; fallback success and remote failure are synthetically exercised with one fallback attempt and no retry loop. Reduced motion, menu focus/Escape/resize/scroll cleanup use the existing public suite.
- [Standards and spec independent reviews](review-notes.md) both pass with no blockers; both recompute the final metrics, and the standards reviewer also checks all 35 raw receipt/report/trace sets. [Raw integrity receipt](raw-integrity.json) and [SHA256 evidence manifest](artifact-manifest.json) preserve provenance.
- [Validation command output/status](results/validation/) and [exact reproduction](reproduce.md) are committed. Reports/traces for all 35 scored samples are committed, rather than depending on a temporary local archive. Command/server logs include normalized text and original gzip bytes. Earlier local symlink-based validation passed too; an attempted standalone install exhausted temporary quota. Only this task's disposable dependency copies were removed, then a fresh locked install and final gates passed. Scores and raw evidence were not affected.

Limitations: synthetic widget-off samples on one Linux host, five mobile/two desktop runs per cell, simulated throttling and warm optimizer. No winner, so no confirmation/widget-on phase was warranted. Do not generalize this negative result to real mobile hardware, field LCP, cold CDN optimization or live third-party timing. Real media uploads/playback, production resources and P4 were not exercised. No production route was fetched, no provider interaction or real upload occurred, and no environment/storage/auth/cache resource was changed. The branch's exact automatic-deployment guard is included before pushing. No merge or deployment is authorized by this draft.
