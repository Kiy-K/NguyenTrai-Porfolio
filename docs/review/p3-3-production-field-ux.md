# P3.3 production UX and field performance verification

## Current verification — 2026-10-26 UTC

**Issue #39 field gate: pending data.** This is a fresh read-only verification of the deployed P7 release. The original report PR [#41](https://github.com/Kiy-K/NguyenTrai-Porfolio/pull/41) and one-color placeholder fix [#42](https://github.com/Kiy-K/NguyenTrai-Porfolio/pull/42) are confirmed merged. Their dated evidence remains below; it is not relabeled as today's measurement. No new application fix is supported by this sample.

This refresh changes only this report and an exact-branch deployment guard in `vercel.json` (`docs/issue39-production-ux-refresh: false`). It adds no collector, dependency, TanStack Query, provider configuration, or auth/storage/cache-policy change. Existing `<SpeedInsights />` stays in place. No merge, deployment, admin access, content mutation, upload, conversation, or microphone permission was performed.

### Current production receipt and bounded HTTP smoke

GitHub main, isolated checkout base, and Vercel production Git SHA: **`3728b0995f67c76c0130e1ce30eb24a349baa9c8`**. Two separate authenticated, read-only CLI metadata reads (project production target and deployment) agree on `READY`, target `production`, deployment **`dpl_E2iJwQHLnRgjbEqoAEEEt3KLpa87`**, ready **2026-10-24 13:21:05.852 UTC**, function region `sin1`. Public alias: **https://nguyen-trai-porfolio.vercel.app**. Function region is not a user-region measurement.

Final HTTP receipt: **2026-10-26 11:05:13.233–11:05:14.858 UTC**. Eight sequential unauthenticated GETs, two per route, following one valid public section/detail link in memory. Each HTML route had a nonempty title and h1; `/api/products` had its actual `{ products: [...] }` shape. No concrete product identifiers, HTML/JSON payloads, cookies, private deployment hosts, or content screenshots are published. This is sampled structural/link verification, not a complete HTML validator or full-site crawl.

| Route template | Status, both | Cache-Control | x-vercel-cache, both | Complete response ms, first / repeat |
| --- | --- | --- | --- | ---: |
| `/` | 200 | `public, max-age=0, must-revalidate` | HIT | 442 / 105 |
| `/sections/[id]` | 200 | `private, no-cache, no-store, max-age=0, must-revalidate` | MISS | 211 / 102 |
| `/products/[id]` | 200 | `private, no-cache, no-store, max-age=0, must-revalidate` | MISS | 175 / 116 |
| `/api/products` | 200 | `no-store` | MISS | 313 / 160 |

HTML returned `text/html; charset=utf-8`; API returned `application/json`. Timings are workstation wall time through complete body consumption, not TTFB, field vitals, or percentiles. **CDN MISS does not expose internal Redis hit/miss.** No purge or storage query occurred. Two earlier four-GET attempts stopped at a mistaken audit assertion expecting a top-level array; the source confirmed the object shape and the corrected run above passed. Total standalone HTTP smoke: **16 GETs**, including those diagnostics; no HEAD or load test. Browser navigations below were separate.

### Current Speed Insights field data and access limits

Dashboard first: the computer/browser inventory returned **no available browsers or apps**, so the dashboard and its Production UI filter could not be inspected. The Vercel connector's scoped project read returned **403 forbidden** for this team; its global metric catalog succeeded and listed Speed Insights metrics, but that catalog proves neither project samples nor dashboard access. Existing Vercel CLI authentication independently succeeded for the intended team/project; no new access was granted. These access limits are not evidence that instrumentation is disabled.

Vercel CLI **65.2.0**, Node **24.22.1**, project `nguyen-trai-porfolio`, scope `khois-projects-8dd1e46a`. The live LCP schema supports `p75`, `count`, `route`, `deviceType`, `environment`, `deploymentId`, and `country`. Three p75 and three count reads used identical requested bounds **2026-10-19 11:00–2026-10-26 11:00 UTC**, `--prod`, route/device grouping and limit 100. Returned query bounds aligned to **2026-10-19 08:00–2026-10-26 12:00 UTC**, four-hour buckets, filter `environment:production`. The last bucket extends past capture; this is not seven complete, uniformly sampled days. Values are whole-window `summary` results, never averages of bucket percentiles. Data was read before this audit's production smoke/browser visits.

| Route | Device | p75 LCP ms (n) | p75 INP ms (n) | p75 CLS (n) |
| --- | --- | ---: | ---: | ---: |
| `/` | desktop | 1820 (9) | 24 (2) | 0 (6) |
| `/` | mobile | 1724 (4) | absent | 0 (1) |
| `/sections/[id]` | desktop | absent | 56 (1) | 0 (1) |
| `/sections/[id]` | mobile | absent | 96 (2) | 0 (1) |
| `/products/[id]` | desktop | 444 (1) | 72 (7) | 0 (4) |
| `/products/[id]` | mobile | absent | 72 (2) | 0 (2) |

Counts are metric measurements, not unique visitors or sessions. “Absent” means no returned group, not a fabricated zero. Targets remain p75 LCP ≤2500 ms, INP ≤200 ms, CLS ≤0.1; these mixed-deployment observations are numerically below targets but **1–9 samples and missing groups do not pass the release gate**. Operator/synthetic traffic already in telemetry cannot be excluded. Country subdivision would fragment this inadequate sample further and was skipped.

Three additional count reads retained `--prod` and added `deploymentId:dpl_E2iJwQHLnRgjbEqoAEEEt3KLpa87`. They returned only **homepage desktop LCP n=1 and CLS n=1**, with INP and all other cells absent. One further deployment-filtered LCP p75 read returned **1820 ms (n=1)**. No current-release INP or CLS percentile is claimed. A single measurement is not a representative distribution; current-release disposition remains **pending data**, with ingestion/sampling uncertainty unresolved.

Reproduction, using the same range for p75 and count and keeping raw exports private:

```bash
vercel --scope khois-projects-8dd1e46a metrics schema vercel.speed_insights.lcp_ms --format=json
vercel --scope khois-projects-8dd1e46a metrics vercel.speed_insights.lcp_ms \
  --aggregation p75 --group-by route --group-by deviceType --limit 100 \
  --since 2026-10-19T11:00:00Z --until 2026-10-26T11:00:00Z \
  --project nguyen-trai-porfolio --prod --format=json
# Repeat with count and metrics inp_ms / cls.
# For current-release attribution, retain --prod and add:
# --filter 'deploymentId:dpl_E2iJwQHLnRgjbEqoAEEEt3KLpa87'
```

Operator-only: open the project's Speed Insights dashboard with an authorized account; confirm Production, exact UTC range, deployment/date, actual per-metric counts and dashboard sampling notices. Capture the six route/device cells above, reconcile with CLI summaries, and retain missing cells. Agree a representative sample-sufficiency rule before evaluating the gate; no vendor minimum or arbitrary passing count is asserted here. Publish route-template aggregates only. See [official CLI metrics guidance](https://vercel.com/docs/speed-insights/accessing-metrics-with-vercel-cli).

**Lab comparison:** the frozen [#34](issue-34/report.md) widget-off mobile LCP medians were 2181 → 2658 ms with a candidate change and no supported large first-party TBT regression. [#37](issue-37/report.md) recorded widget-off mobile 2260 → 2703 ms, desktop 626 → 615 ms, CLS 0, and failed decode/priority benefit gates. Those local medians and TBT are not field p75 or INP. Today's sparse telemetry has different devices, content, dates and deployments; it establishes no causal improvement. No new Lighthouse run, score, pooled sample, or performance optimization is claimed.

### Current browser and accessibility matrix

Automated browser window **11:03–11:09 UTC**, Chromium **155.0.8059.12**, Playwright **1.64.0-alpha-1790635538000**, axe-core **4.14.0**. Fresh unauthenticated contexts, service workers blocked, all non-GET/HEAD requests aborted, admin navigation/prefetch aborted, AI/retired-search endpoints aborted and counted, WebSockets closed. Static assets and public read-only preview/vendor configuration GETs were allowed. No form submitted, media played, call/chat started, or attribution link activated; analytics POSTs could not be sent. Private screenshots were inspected locally and kept outside Git.

| Check | Mobile Chromium 390×844 | Desktop Chromium 1440×1000 |
| --- | --- | --- |
| Home / discovered section / discovered detail | 200; one h1 and title; no horizontal overflow | Same |
| Hero | Loaded and visible; screenshot inspected | Same |
| Menu | Enter opens, initial focus inside, Escape closes/returns focus, scroll unlocks | Mobile menu not applicable |
| Reduced motion | Hero ancestor animation duration `0.00001s` | Same |
| Search | Accented/unaccented equivalence, nonempty results, no-results/reset | Same |
| AI requests / summary buttons | Zero / absent on sampled section | Same |
| First-party focus and names | Sampled back control named, `:focus-visible`, solid outline | Same |
| Runtime exceptions | None observed | None observed |
| axe WCAG-tag checks on three routes | No owned violations reported; incomplete checks remain | Same |
| Console errors / failed responses | 4 console entries; external 403 twice, preview 400 once | 6 console entries; same failed-response categories |

Menu detail: two initial one-home browser attempts stopped on an overly strict eight-Tab containment assertion. In the completed run, five of eight Tab stops were in the native dialog and three were reported as body/browser focus; no background application control received focus. The existing isolated three-Tab menu regression passed. This is sampled native-dialog behavior, not proof of an exhaustive focus trap. All diagnostic attempts remained read-only. The completed main audit made six page navigations, with two additional homes for each of two targeted widget passes; including the two early home attempts, **12 top-level browser navigations** total. Asset/prefetch traffic is additional and was not a load test.

The previously fixed placeholder is confirmed painted rust `rgb(139,58,58)` on parchment `rgb(244,235,208)` in both live viewport samples (two nodes each): **6.382:1**, versus the historical 2.73:1. No repeat code fix is needed. The sampled detail had no main image elements; this is not a successful article-media/playback test. Its preview 400 and external 403 responses remain unresolved, alongside deliberately blocked admin prefetches (one mobile, three desktop). No security/allowlist change is justified by these symptoms. This is **not a clean-console/media sign-off**. Axe incomplete rules included `color-contrast` and mobile `aria-valid-attr-value`; automated checks do not establish WCAG compliance or screen-reader usability.

### ElevenLabs vendor limitation, revalidated

Unfocused attribution remains vendor-owned shadow content: home contrast **2.10:1 mobile** (`#b3b1ae` / `#fffdf8`) and **2.06:1 desktop** (`#aba592` / `#f4ebd0`), 10px normal text against the intended **4.5:1**. Section mobile also measured **2.09:1** on white. The link currently reads “ElevenAgents”, so the initial text-filter probe for “ElevenLabs” missed it; the completed axe pass and targeted `a[href*="elevenlabs.io"]` checks inspected the loaded widget instead.

Targeted keyboard checks at both sizes found an accessible text name, opacity **0.3 unfocused → 1 focused**, `:focus-visible`, and Tab leaving the attribution. Focus screenshots show the darker underlined link; computed outline and box shadow are none, so absence of an outline alone is not evidence of absent focus feedback. The two widget buttons have Vietnamese accessible labels. This improves the precision of the earlier focus limitation but is not an actual screen-reader or complete widget interaction sign-off.

Official [customization](https://elevenlabs.io/docs/eleven-agents/customization/widget) and [widget configuration](https://elevenlabs.io/docs/api-reference/widget/get) documentation were refreshed through Context7 and the vendor site. General appearance/text controls are supported; the retrieved configuration schema also lists a general `focus_color`. No reviewed documentation established an attribution-specific opacity/contrast repair. General focus/color controls are not proof of such a repair. Keep the existing narrow follow-up [#40](https://github.com/Kiy-K/NguyenTrai-Porfolio/issues/40) open; do not duplicate it. Owner/vendor should request a supported unfocused attribution contrast fix and verify screen-reader/Safari states. No external support message or agent configuration change was made. Branding remains visible; no shadow CSS injection or widget disabling.

### Regression receipt, remaining gates, and disposition

Isolated checkout base as above; Node **24.22.1**, npm **11.19.1**, unchanged lockfile. `npm ci --ignore-scripts`; **136/136 tests**, lint, typecheck, existing credential-isolated webpack production build, **2/2 harness self-checks**, and existing public/search browser regressions at both viewports passed. The initial sandbox suite/harness runs failed at subprocess/loopback boundaries; the build first failed parsing its TypeScript subprocess output. Each succeeded outside the sandbox. Synthetic browser tests block external origins and use only the loopback fixture responder, with real credentials blank and persistent writes paused. They are regression evidence, not field metrics or production backend evidence. Build-generated files are excluded from this PR. Reproduce via [the existing harness instructions](../../scripts/ui-review/README.md), pinned tools above, and `UI_REVIEW_PORT=3340` / a private output directory under `/tmp`.

Independent standards and Issue #39 acceptance review outcomes will be recorded on the draft PR before handoff. This branch is deployment-disabled before its first push. Application behavior is unchanged; no new failing first-party behavior has been demonstrated that warrants a separate fix PR.

- **Pending data / owner:** inspect the dashboard, obtain representative post-release route/device counts, then judge the field gate. P4/TanStack Query remains optional and evidence-gated.
- **Pending vendor / owner:** #40 unfocused attribution contrast; validate supported settings and screen-reader announcements with branding retained.
- **Pending diagnosis / owner:** public preview 400 and external 403; reproduce the authored-resource/provider cause before any fix. Do not infer Redis behavior from CDN headers.
- **Coverage not performed:** physical iOS/Android, Safari/WebKit, Firefox, VoiceOver/NVDA, microphone/chat/call flow, video playback, all articles or every focus/hover/disabled state. Only Chromium binaries were available locally; no broader browser or accessibility claim is made.
- **Approval gate:** draft report review only. Merge/deploy, production mutations, and any new application fix require the separately scoped approval requested in Issue #39. The issue's owner-approved merge criterion remains open.

## Historical record — 2026-10-24

Everything below is the original dated pre-fix/deployment evidence. Its pending actions and PR descriptions describe that capture, not the current state; the refresh above supersedes them for the current release.

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
