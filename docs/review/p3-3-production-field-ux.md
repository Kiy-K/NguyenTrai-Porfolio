# P3.3 production UX and field performance verification

## Disposition

Issue [#39](https://github.com/Kiy-K/NguyenTrai-Porfolio/issues/39), verified 2026-10-24 UTC. **Field release gate: pending data.** Real Speed Insights history is available through the CLI, but each returned route/device/metric group has only 1–9 measurements, several groups are absent, and the current deployment filter returns no rows. The dashboard itself could not be inspected. Do not treat the observations below as a current-release pass.

The bounded public route smoke succeeded. Chromium mobile/desktop navigation and search worked. Two accessibility findings remain: a first-party card placeholder contrast defect (separate minimal fix branch `fix/issue39-placeholder-contrast`) and the vendor attribution limitation tracked in [#40](https://github.com/Kiy-K/NguyenTrai-Porfolio/issues/40). External resource failures prevent a clean-console/media sign-off. No performance optimization is supported by these findings; P4/TanStack Query remains optional and evidence-gated.

This PR changes this report and disables Git-triggered deployment for its own branch in `vercel.json`, following the existing per-branch guard pattern. It changes no application behavior, instrumentation, dependencies, auth, persistence or cache policy. No merge or deployment is authorized.

## Production receipt and scope

Source and Vercel Git SHA: `df5f873eab7f34668e165f847e75608b92b68f63` (main, PR #38). Vercel `get_project` and `get_deployment` independently returned `READY`, target `production`, deployment `dpl_6HuJWDmiUkfnSU1H31YHnKeGPPeE`, function region `sin1`. Ready timestamp `1792804932313` = 2026-10-24 01:22:12.313 UTC. Public alias tested: `https://nguyen-trai-porfolio.vercel.app`. The immutable deployment host was obtained from Vercel metadata but was not used for public smoke.

HTTP window: **01:32:41.560–01:32:45.483 UTC**. Eight sequential unauthenticated GETs: two each to home, one valid section, one published detail discovered through public links, and `/api/products`. No cookies, auth headers, admin login, writes, uploads, provider conversation or destructive endpoint calls. No HEAD requests or load test. Latency is client wall time through complete body consumption from this workstation, rounded milliseconds; it is neither TTFB nor a percentile.

| Route template | Status, both reads | Cache-Control | x-vercel-cache, both | Total ms, first / repeat |
| --- | --- | --- | --- | --- |
| `/` | 200 | `public, max-age=0, must-revalidate` | HIT | 584 / 98 |
| `/sections/[id]` | 200 | `private, no-cache, no-store, max-age=0, must-revalidate` | MISS | 1730 / 129 |
| `/products/[id]` | 200 | `private, no-cache, no-store, max-age=0, must-revalidate` | MISS | 199 / 64 |
| `/api/products` | 200 | `no-store` | MISS | 1034 / 84 |

HTML routes returned `text/html; charset=utf-8`, API `application/json`. Home had a title and portrait markup; section/detail links resolved; detail had title/heading markup; API had the expected array shape. This is bounded structural/link verification, **not** comprehensive HTML validation or a crawl of every article. CDN MISS is **not evidence of an internal Redis cache hit or miss**. No cache was purged and no production storage was queried directly.

## Real-user Speed Insights

Access was checked before browser smoke. The connected Vercel schema endpoint `GET /v2/observability/schema` returned `404 not_found: Observability Data not found`. This does not mean Speed Insights is disabled. There were no available signed-in computer/browser surfaces; the default Chrome tool could not locate `/opt/google/chrome/chrome`. Consequently dashboard measurements, UI production filter and Real Experience Score were **not visually verified**.

The documented CLI fallback succeeded with Vercel CLI **63.1.2**, Node **24.22.1**. `metrics schema vercel.speed_insights.lcp_ms` exposed `p75`, `count`, `route`, `deviceType`, `environment` and `deploymentId`. Six queries used `p75`/`count` for `vercel.speed_insights.lcp_ms`, `.inp_ms`, `.cls`, grouped by route and device type, project `nguyen-trai-porfolio`, scope `khois-projects-8dd1e46a`, `--prod`. The returned filter was `environment:production`.

The query's returned time bounds were **2026-10-17 00:00:00 to 2026-10-24 04:00:00 UTC**, granularity four hours. These are the CLI-aligned bounds for `--since 7d`, including a final bucket extending beyond capture time around 01:32 UTC; this is not seven complete days of uniform sampling. Values below are the API's whole-window `summary`, **not averages of bucket percentiles**. Counts are separately queried measurements per metric, not unique people or sessions. Raw private analytics exports remain outside Git; only these route-template aggregates are published.

| Route | Device | p75 LCP ms (n) | p75 INP ms (n) | p75 CLS (n) |
| --- | --- | ---: | ---: | ---: |
| `/` | desktop | 1820 (8) | 48 (7) | 0 (9) |
| `/` | mobile | 1724 (4) | absent | 0 (1) |
| `/sections/[id]` | desktop | 792 (5) | 40 (5) | 0.0002 (4) |
| `/sections/[id]` | mobile | absent | 96 (2) | 0 (1) |
| `/products/[id]` | desktop | 444 (4) | 72 (9) | 0 (6) |
| `/products/[id]` | mobile | absent | 72 (2) | 0 (2) |

CLS 0.0002 is rounded from 0.00019999999494757503. “Absent” means the query returned no group; it is not a fabricated zero/count. Targets are LCP ≤2500 ms, INP ≤200 ms, CLS ≤0.1. Returned values are numerically below those thresholds, but this sparse and incomplete history does **not** establish reliable route/device performance or a passed gate. The query covers production history across deployments, not just the inspected SHA. Synthetic/operator visits already present in field telemetry cannot be excluded.

Three additional `count` queries with filter `deploymentId:dpl_6HuJWDmiUkfnSU1H31YHnKeGPPeE`, retaining `--prod`, returned empty summaries for all three metrics. Current-release metrics are **pending data**, not confirmed zero traffic or proof of broken instrumentation; ingestion delay and sample availability are unresolved. No region/country subdivision was attempted because it would further fragment already inadequate samples. `sin1` is a deployment region, not a measured user region. Existing `<SpeedInsights />` in `app/layout.tsx` was retained without adding a collector.

### Field versus frozen synthetic lab evidence

[Issue #34](issue-34/report.md) found no supported large first-party TBT regression in its matched lab profile; its widget-off mobile LCP medians were 2181 → 2658 ms with a quotation/portrait candidate change. [Issue #37](issue-37/report.md) recorded primary widget-off local mobile LCP 2260 → 2703 ms, desktop 626 → 615 ms, and CLS 0. Its one-factor decode/priority arms failed the preregistered benefit threshold. Those experiments retain their original source, runtime, fixtures and collection conditions.

The field table measures real collected telemetry from different devices, networks, content, dates and deployments. Lab medians are not field p75; TBT is not field INP; historical widget-off accessibility scores omit the live vendor issue. Neither the lower field numbers nor local Lighthouse scores prove the current release improved. **No fresh Lighthouse run, pooled comparison or new performance score is claimed here.**

### Operator-only capture checklist

1. Open the project's Speed Insights dashboard with an authorized account. Confirm the project and **Production** environment, capture the exact UTC range and current deployment/date. Keep the private dashboard URL/export out of Git.
2. Capture p75 LCP/INP/CLS and each metric's actual count for `/`, `/sections/[id]`, `/products/[id]`, **mobile and desktop separately**. Record absent groups, sampling/ingestion caveats and dashboard data-quality notices. Do not substitute TBT or Real Experience Score. Subdivide by country only when counts support it.
3. Reconcile the dashboard with the CLI summaries; distinguish mixed-deployment history from post-release data. There is no claimed vendor minimum sample threshold here: 1–9 observations and missing cells are insufficient for this release decision. Collect a representative longer period, agree a sample sufficiency rule before judging it, and retain “pending data” until supported.
4. Reproduce the CLI reads below with the same range/filter across p75 and count; use a deployment filter for current-release attribution. Publish only sanitized route/device aggregates, never private exports or concrete product URLs.

```bash
vercel --scope khois-projects-8dd1e46a metrics schema vercel.speed_insights.lcp_ms
vercel --scope khois-projects-8dd1e46a metrics vercel.speed_insights.lcp_ms \
  --aggregation p75 --group-by route --group-by deviceType --since 7d \
  --project nguyen-trai-porfolio --prod --format=json
# Repeat with --aggregation count and metrics inp_ms / cls.
# For current-release counts also pass:
# --filter 'deploymentId:dpl_6HuJWDmiUkfnSU1H31YHnKeGPPeE'
```

CLI 65.2.0 is available; upgrade separately with `npm i -g vercel@latest` for compatibility. This audit did not change the installed CLI.

## Browser-local usability and accessibility

Automated production browser checks were separate from the eight HTTP requests: Chromium **155.0.8059.12**, Playwright **1.64.0-alpha-1790635538000**, axe-core **4.14.0**, fresh unauthenticated contexts, 390×844 and 1440×1000. These are emulated viewports on a desktop workstation, not physical phones. Browser requests were intercepted to abort all non-GET/HEAD methods, admin prefetch/navigation, and WebSockets. Search triggered zero AI/retired search/summary requests. Normal static assets and public read-only preview requests were allowed. No form was submitted, media played, attribution link activated or call started. Existing analytics could not send POST beacons under this policy.

The initial `networkidle` navigation timed out after 30 seconds on the live third-party page; subsequent checks used DOM/heading/font readiness with a bounded vendor wait. Initial widget captures preceded its controls rendering. A targeted follow-up waited for the attribution link and then measured the loaded widget; the early empty captures are not evidence of widget usability.

| Check | Mobile Chromium | Desktop Chromium |
| --- | --- | --- |
| Home, discovered section and detail | 200; one h1/title, no horizontal overflow | Same |
| Home portrait | Loaded, visible in viewport | Loaded, visible in viewport |
| Menu Enter / focus containment / Escape / focus return / scroll unlock | Passed | Mobile menu not applicable |
| Reduced motion | Emulated preference honored; hero animation 0.00001 s | Same |
| Search | Accented/unaccented query produced equal, nonempty results; no-results/reset passed | Same |
| Summary controls / AI search | Absent / zero attempted AI requests | Same |
| Runtime exceptions | None observed | None observed |
| WCAG-tag axe checks | No reported owned violations in initial snapshots; incomplete rules remain | Two placeholder contrast nodes failed on section |
| First-party tab sequence | Named navigation/category controls reachable; visible outlines observed | Same |

Search reproduction: follow a homepage category link, type `Nguyễn Trãi`, compare with `nguyen trai`, then an impossible query, then clear filters. The existing synthetic suite additionally covers typo search while offline, sorting, tag intersection, pagination/reset and navigation to authored article content. It uses fixtures, not production product payloads.

The card-placeholder failure is **owned UI**: `components/ProjectCard.tsx` renders 20px normal-weight italic gold `#B8860B` on parchment `#F4EBD0` when an image is absent. Live desktop axe measured **2.73:1**, expected 4.5:1. It was not flagged in the initial mobile snapshot; that is not proof it passes on mobile. The separate reversible fix uses existing rust `#8B3A3A` on that single text element. It does not change media, links, content, geometry, the gold palette elsewhere or vendor branding. Production remains unchanged pending approval of that PR.

Console/resource caveat: the main pass recorded three mobile and six desktop resource-error console entries; some requests were deliberately blocked admin prefetches (one/three respectively). A bounded two-navigation diagnostic observed **`/api/preview` 400** and a **Facebook CDN resource 403**. The selected detail rendered its existing “preview unavailable / open directly” fallback. No response payloads or content URLs were retained in Git, and the underlying cause of those resource failures was not established. This is **not a clean-console or successful external-preview/media-playback sign-off**. Leave provider/preview behavior unchanged until an owner can reproduce the failure and identify its cause; no allowlist/security relaxation is justified.

Live axe runs had incomplete `color-contrast` and, on some snapshots, `aria-valid-attr-value` checks. Accessible labels were checked by axe and by the existing synthetic menu/search tests; ad hoc name heuristics do not replace the browser's accessible-name calculation. Tab/focus checks sampled owned navigation and controls, rather than proving every interactive state. Contrast on hovered, disabled, media-overlay and all article-content variants remains outside this sample.

### ElevenLabs: retained limitation

The loaded vendor **shadow-root** attribution reproduces the historical failure:

| Viewport | Effective foreground / background (axe) | Contrast | Text |
| --- | --- | ---: | --- |
| 390×844 | `#b3b1ae` / `#fffdf8` | 2.10:1 | 10px, normal |
| 1440×1000 | `#aba592` / `#f4ebd0` | 2.06:1 | 10px, normal |

The attribution link's computed color was black with opacity 0.3. It had a name, received keyboard focus, matched `:focus-visible`, and Tab left the widget without a trap. Its computed outline was `none`; visible-focus quality requires further visual/vendor validation, since that property alone does not exclude other indicators. Two widget buttons had names. No conversation, consent flow or microphone/screen-reader audio session was exercised.

The [official widget customization documentation](https://elevenlabs.io/docs/eleven-agents/customization/widget), checked through Context7 and the vendor site, offers dashboard appearance colors and general `bg_color`, `text_color`, `btn_color`, `btn_text_color`, orb/text attributes and modality settings. The reviewed documentation did not identify a supported attribution-specific opacity/contrast/focus control. General color settings do not demonstrate a supported repair of the attribution. No agent configuration was changed. [#40](https://github.com/Kiy-K/NguyenTrai-Porfolio/issues/40) tracks the narrowly scoped vendor/operator follow-up; no external support message has been sent. Attribution remains visible, with no shadow CSS injection, branding removal or widget disablement.

### Coverage limits and next actions

- **Tested:** automated Chromium desktop/mobile viewport rendering, sampled keyboard behavior, axe diagnostics, private screenshot inspection, plus the isolated synthetic regressions below.
- **Not tested:** physical iOS/Android, WebKit/Safari, Firefox, VoiceOver/NVDA or another actual screen reader, live vendor conversation, microphone permissions, video playback or all published article variants. Only Chromium binaries were available; temporary disk quota also limited additional tooling. No cross-browser or WCAG-compliance claim is made.
- **Owner:** complete the dashboard and representative current-release field capture, then repeat the six route/device cells with adequate counts before a performance gate decision. Keep field data distinct from any later synthetic tests.
- **Owner/vendor:** pursue #40 via supported controls/support and validate contrast, Tab/Shift+Tab, visible focus and actual screen-reader announcements on Safari/VoiceOver and desktop; retain branding throughout.
- **Owner:** reproduce the preview 400/CDN 403 separately and decide whether a provider or authored-resource follow-up is needed; do not assume a cache/backend problem.
- **Owner review:** approve the separate one-color fix only after its evidence and regression results; neither this report nor that draft authorizes merge/deployment.

## Local regression receipt and reproduction

Source base `df5f873eab7f34668e165f847e75608b92b68f63`, Node **24.22.1**, npm **11.19.1**, existing lockfile. Report checkout: `npm test` **111/111**, `npm run lint`, `npm run typecheck`, credential-isolated webpack production build, harness **2/2**, and `scripts/ui-review/public.cjs` / `search.cjs` at both viewports passed. Tests initially failed under sandbox restrictions (rollback subprocess/harness execution); rerunning outside the sandbox passed. No production service credentials were used. The separate fix has its own validation receipt; do not relabel this report-checkout run as fix validation.

Use `npm ci`, then the existing [UI review instructions](../../scripts/ui-review/README.md) with externally installed pinned tools. Run `node scripts/ui-review/build.cjs`, then `node scripts/ui-review/server.cjs` with an unused `UI_REVIEW_PORT` and output under `/tmp`; run public/search suites with the same settings and `NODE_PATH` pointing at Playwright. The build/server clear real credentials, pause writes, and use the loopback-only fixture responder. Stop the server afterward. Build-generated `next-env.d.ts`/`tsconfig.tsbuildinfo` are excluded from the diff.

To reproduce production checks, use a fresh unauthenticated context with the read-only request policy above, discover section/detail URLs from public links **in memory**, and retain only route templates, status/headers and timings. Check `document.title`, h1, loaded portrait, overflow, menu Enter/Tab/Escape/focus return, emulated reduced motion and search equivalence. Inject axe locally into that browser context for diagnostics; wait for the live vendor attribution before contrast/focus checks. Do not publish DOM/HTML, actual article identifiers, full content URLs, screenshots containing production content, cookies, or raw analytics exports. Eight HTTP GETs and the bounded browser navigations are verification samples, not a load test.

Independent standards/spec review and PR disposition are recorded on the draft PR. Final acceptance still requires owner-approved review/merge; the field and vendor limitations remain explicitly open.

References: [Speed Insights CLI metrics](https://vercel.com/docs/speed-insights/accessing-metrics-with-vercel-cli), [dashboard usage](https://vercel.com/docs/speed-insights/using-speed-insights), [Issue #34 frozen lab report](issue-34/report.md), [Issue #37 frozen lab report](issue-37/report.md).
