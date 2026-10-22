# Issue #34: matched Node 24 mobile main-thread investigation

## Finding

**The large mobile TBT regression is not reproduced under the matched protocol.** There is no evidence here for a production UI fix targeting that alleged regression. This is a bounded result for the fixed homepage, synthetic data, Node24, Chromium and frozen widget snapshot; it is not statistical equivalence or field-performance sign-off.

Five mobile samples per revision/condition show median TBT **60 → 60.5 ms** with the widget off, and **218.5 → 230 ms** with it on. First-party script execution stays similar. After excluding admin-route script bytes consistently, release homepage JS is289 transferred bytes/739 decoded bytes larger; the unnormalized apparent reduction was due to baseline prefetch. The preregistered first-party regression threshold did not trigger. The earlier unmatched **609–665.5 ms** TBT measurements remain preserved historical observations; this experiment cannot retrospectively identify their cause. It does not establish that Node26, machine load or the live widget caused them.

**A separate mobile LCP difference remains:** widget-off median **2181 → 2658 ms**, with different largest elements (quotation versus portrait). Animation suppression retains most of that difference. Do not turn the negative TBT finding into a claim that every performance metric improved or that all release gates are closed. No runtime change, widget removal, attribution hiding, storage/auth/cache change or P4 work was performed.

## Frozen scope and evidence

- [Protocol and conditional ablation](protocol.md), frozen before each scored phase.
- Baseline **`97da6087a6969975fbb360c3ec966ac6c723fb6d`**; merged release **`a86a991899a84f4ceaa72b2931049331466ff061`**. Separate clean detached worktrees, exact locked installs, real webpack production builds. [Build/fixture/font/image hashes](build-manifest.json). Generated Next type-reference changes are recorded, with no changed app source.
- Node **24.21.0**; Lighthouse **13.5.0**; Puppeteer **25.14.0**; Chromium **155**, Playwright build1247 (Playwright **1.64.0-alpha-1790635538000** for functional checks). Linux7.2.10, Intel i7-13620H,16 logical CPUs. Primary one-minute load before samples ranges0.79–1.96; no installs/builds/tests ran during scored phases. Ambient desktop/system work cannot be fully excluded.
- Mobile390×844/deviceScale1: simulated RTT150ms, throughput1638.4Kbps, CPU slowdown4; full effective settings saved per run. Desktop1440×1000 uses official desktop config. Fresh browser/storage per sample; server homepage warmed before each block. Revision order alternates by round; widget-on precedes off within blocks, so that factor is not independently randomized.
- The identical [three-response snapshot](widget-assets.json) is replayed for every cell: widget embed **0.21.2**, public widget configuration and an existing image403 response. No live external network during scoring; widget shadow-root presence/absence asserted. No conversation or media upload. Replay response bytes are uncompressed; network byte/timing figures describe this controlled interception profile, not real CDN transfer behavior. Absolute scores should not be compared directly with historical live-network scores.
- All **28 primary** and **10 conditional animation** runs are preserved; no invalid scored runs or discarded outliers. Pre-scoring capture initially rejected the image403, then was corrected to preserve that response consistently. A temporary ablation launcher failed before any scored run; the checked-in matrix command was used successfully instead.

[Primary summary](results/summary.json), [per-run baseline](results/baseline/), [per-run release](results/release/), [animation summary](results/animation-summary.json). The per-run directories contain revision, runtime, load, settings, scores, network bytes/timings, task/execution/parse, unused-JS, LCP element and contrast diagnostics. The animation summary contains aggregate LCP/TBT/score only; its per-run details are in `results/baseline-animation-off/` and `results/release-animation-off/`. Primary collector/orchestrator was frozen at `2fec060`; conditional collector and summarizer at `6ce8197` plus the checked-in matrix's explicit animation-off selector. No app build changes between phases.

## Primary mobile results

Values are median **[min–max]**, five samples per cell. LCP/TBT in milliseconds.

| Revision / widget | Score | TBT | LCP | CLS |
| --- | ---: | ---: | ---: | ---: |
| Baseline / on | 96 [95–96] | 218.5 [211–251.5] | 1212 [1207–1221] | 0 |
| Release / on | 93 [67–95] | 230 [215.5–345] | 2486 [1661–11315] | 0 |
| Baseline / off | 98 [98–98] | 60 [53.5–62] | 2181 [2180–2255] | 0 |
| Release / off | 96 [96–96] | 60.5 [51–118] | 2658 [2593–2662] | 0 |

The release widget-on sample3 has **score67 / LCP11315ms** and is retained. Its TBT is not609ms or higher; score/LCP variation must not be interpreted as the original main-thread symptom. Widget-off paired TBT deltas by round are **+4, +6.5, +58, −11, +3.15ms**. These do not meet the frozen combined100ms/20% median-increase threshold. Five samples and a diagnostic threshold cannot rule out smaller regressions or other routes/devices.

## Main-thread and JS attribution

Mobile medians, milliseconds unless marked bytes:

| Evidence | Baseline/on | Release/on | Baseline/off | Release/off |
| --- | ---: | ---: | ---: | ---: |
| Script execution, all URLs | 513.3 | 514.0 | 295.8 | 291.5 |
| Script parse/compile | 113.0 | 111.6 | 20.9 | 20.2 |
| First-party script execution | 285.7 | 278.1 | 287.2 | 283.3 |
| Widget script execution | 208.7 | 214.3 | 0 | 0 |
| Listed long-task duration | 519 | 515 | 231 | 224 |
| Script transfer bytes, replay profile | 1,720,247 | 1,717,961 | 163,011 | 160,725 |
| Decoded script resource bytes | 2,068,403 | 2,064,607 | 511,304 | 507,508 |
| Unused-JS estimated bytes | 1,114,315 | 1,114,694 | 49,621 | 49,845 |

First-party execution with the widget off is1.5ms higher in the baseline and5.2ms higher in the release than with it on, small differences in these observations rather than proof of equality. The widget's approximate TBT contribution (difference of medians, not paired causal decomposition of each task) is **158.5ms baseline /169.5ms release**. Representative on-run long tasks include the unchanged widget URL at231/239ms and shared first-party chunk `794-0ac5e2f0e81d2e0d.js` at173/197ms. Full task lists and network timings are in each per-run JSON. `ElevenLabsConvaiWidget.tsx` and `app/layout.tsx` are identical across revisions. The A/B supports substantial vendor cost in both; it does not show the UI update introduced that cost.

## Desktop controls

Two samples per cell; medians [min–max]. This is a small control set, not desktop statistical proof.

| Revision / widget | Score | TBT ms | LCP ms |
| --- | ---: | ---: | ---: |
| Baseline / on | 91 [90–92] | 6.5 [4–9] | 1987 [1831–2142] |
| Release / on | 100 [100–100] | 4.75 [4–5.5] | 552 [529–575] |
| Baseline / off | 100 [100–100] | 0 | 622 [621–622] |
| Release / off | 100 [100–100] | 0 | 595 [529–661] |

CLS is zero throughout. These controls do not reproduce a new desktop main-thread problem. Do not discard the lower historical-layout desktop/widget scores merely because older unmatched reports showed100.

## Conditional animation ablation and LCP limits

The trace identifies the mobile baseline quotation as LCP, versus the release portrait. The responsive layout, image sizing/preload and candidate geometry changed, so LCP is not measuring the same element. All desktop cells identify the portrait.

A pre-paint universal CSS override disables animations/transitions in local browser pages only. Five mobile/widget-off samples per revision retain LCP medians **2112ms baseline /2606ms release** (ranges2110–2159 /2597–2654). TBT is **59 /96.5ms** (51–65 /57–103). The roughly494ms LCP gap remains; turning off animation alone is not a supported fix. No hydration ablation is justified by a first-party TBT increase in the primary traces. Image/render/LCP-candidate investigation remains a separate follow-up if performance sign-off requires it; no speculative image-priority or animation production edit was made.

## Validation, remaining gates and disposition

- Historical pinned app targets passed **100/100 tests** under Node24.21.0; their [original gate output](results/historical-node24-gates.txt) did not print runtime version. Current integrated validation under patched Node24.22.1 is recorded in [new gates](results/node24-gates.txt). Lint/typecheck pass; both pinned production builds pass. [Normal gates](results/node24-gates.txt), [baseline build](results/build-baseline.txt), [release build](results/build-release.txt).
- Public/menu/focus/scroll cleanup/reduced-motion, offline search and intercepted admin workflows pass at both viewports under Node24. [Final browser output](results/browser-checks.txt), [public](results/public-browser.json), [search](results/search-browser.json), [admin](results/admin-browser.json). A [first attempt](results/browser-first-attempt.txt) failed by inspecting scroll state before React cleanup; the shared public harness now waits for actual restoration before asserting. It passed on rerun without changing app code. No provider behavior was changed; actual Cloudinary/Mux upload/playback remains unverified.
- New collector/matrix/summarizer pass syntax checks and [lint](results/new-harness-lint.txt); the summarizer asserts sample counts, matching tools/settings/assets and basic median calculations. Independent standards/spec reviews found no conclusion-changing issue; their requested paired vectors and reproducible animation-summary command are now included. [Review notes](review-notes.md).
- Existing ElevenLabs attribution contrast remains **2.06–2.1:1 versus4.5:1**. Widget-enabled accessibility remains96; attribution was neither hidden nor restyled. Widget-off is strictly an experimental ablation, not a product accessibility fix.
- Recommend replacing the claim of a large **code-attributable TBT regression** with this bounded non-reproduction result after owner review. Keep LCP variability/candidate differences, live third-party network behavior, field data and post-release read-only CDN checks separate. Do not grant blanket release approval from these samples.
- All other unresolved PR33 review comments remain outside this issue's investigation. This work does not claim to resolve that review backlog. P4 remains deferred.

No production route was fetched during this investigation, and no deploy, environment change, storage mutation or cache purge occurred. The exact investigation branch has an automatic-deployment guard. Any future production change requires owner approval and subsequent read-only verification.

## Full traces and retained artifacts

Five [representative URL-redacted full traces](traces/) cover both mobile widget conditions and the release's score67/LCP11315ms outlier. [Trace hashes/redaction manifest](traces/manifest.json). Timing and task structure are retained; URL query strings/fragments are removed. Per-run diagnostics/network byte/timing summaries are committed for all38 samples.

Committed text logs normalize terminal whitespace; original byte-for-byte logs remain in the archive.

All38 original full Lighthouse reports/traces, the exact public frozen response bytes and synthetic regression artifacts are retained in **`/tmp/nguyentrai-issue-34-evidence.tar.gz`**. [Archive size/hash and retention note](artifact-manifest.json). This local archive is not uploaded to GitHub and must be preserved before `/tmp` cleanup. It permits exact snapshot replay without committing vendor asset code or public agent configuration bodies. [Reproduction commands](reproduce.md).

## Corrections after PR review

Latest main's Node24.22.1 security update is merged into this review branch; both review-branch deployment guards are preserved. These documentation/harness corrections do not deploy the investigation or change application behavior.

- All38 original network timing arrays were restored from their full Lighthouse reports. Request/end values are milliseconds since navigation start. [Restoration source hashes and provenance](results/restoration-manifest.json). Primary `animation=on` is derived from the frozen pre-ablation collector, explicitly labeled as enrichment; original observations remain intact.
- The full first-party threshold now combines numeric TBT growth with attributable script/task growth. Unit tests cover TBT-only false attribution and both corroborating cases. The original result remains false for both numeric and attribution stages; this is not proof of statistical equivalence.
- Historic baseline prefetched admin/login scripts; original totals and TBT remain untouched. Additional normalized fields exclude admin-route scripts on both revisions: mobile median transferred homepage JS is **1,717,672 →1,717,961 bytes with widget**, **160,436 →160,725 without**; decoded homepage JS is **2,063,868 →2,064,607** and **506,769 →507,508**. Baseline admin scripts account for2575 transferred/4535 decoded bytes; release mobile samples have none. The former lower-byte claim was unsupported without this attribution. Historical TBT still includes any prefetch execution, a limitation of these observations.
- Future collection blocks those admin requests in both revisions, records the policy, and pins/records Puppeteer and launcher versions. It requires new empty asset/output directories for capture, preventing mixed snapshots. Fresh corrected-profile samples must not be pooled with these historical runs.
- Baseline97da608 remains an ancestor of main; reproduction now explicitly fetches full history for shallow checkouts. Build/lint log exit statuses are identified as original execution-record annotations, not freshly generated historical outputs. Original raw logs and metrics remain in the unchanged archive.

The separate LCP difference, field/runtime uncertainty and third-party contrast follow-up remain open. No claim of a new matched performance experiment or a resolved cloud runtime-security rollout is made by this correction.

### Correction validation

Patched Node24.22.1/npm11.19.1: **107/107 tests**, lint, typecheck and credential-isolated production build pass. Six focused tests cover attribution false positives, corroborating cases, exact timing fields, admin classification and reused capture/matrix directory rejection. Historical100-test output is preserved separately; current gate output prints versions and exit statuses.

A [single corrected-collector smoke check](results/corrected-collector-smoke.json) passes runtime/tool hashes, timing-field checks, frozen asset validation and widget state with admin prefetch blocked. Its score68/TBT311ms/LCP11314.8ms is retained, not hidden or pooled: this uses a different runtime/prefetch profile and lint ran concurrently. It validates harness execution only and does not resolve the known LCP issue or constitute a new matched experiment. No new live external asset capture or production request was made.

Final independent standards/spec review found no remaining blocker. Committed gate text is whitespace-normalized; its raw correction output is retained at `/tmp/pr35-correction-node24-gates-raw.txt`. No PR35 merge or deployment is part of these fixes.
