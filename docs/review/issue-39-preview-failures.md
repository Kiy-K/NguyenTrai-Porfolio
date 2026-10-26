# Issue #39: avoid predictably rejected preview requests

## Diagnosis and scope

After the P3.3 report merge, the owner requested implementation specifically for reproducible preview failures. Read-only metadata confirmed production `ca0b838caeb6a53c6b72b05d09efa94a699635af`, deployment `dpl_48rHLLF4XAYsnCopkMt8Dr9z8sTn`, target production, READY at 2026-10-26 11:15:43.446 UTC. This fix is based on that source; it has not been deployed.

At **2026-10-26 11:19:42 UTC**, a bounded public HTTP reproduction followed home → section → detail links and requested preview metadata for an external link discovered in that detail. Four public page/API GETs total; no credentials, admin access, writes or direct provider request. The preview returned **400**, `Cache-Control: no-store`, and the route's generic **target rejected** error. The target host is outside the built-in allowlist. No authored URL, identifier, product payload, private export or production screenshot is published. An earlier browser-only diagnostic was stopped without a completed receipt; its GET/HEAD-only policy blocked admin and WebSocket requests. It is not additional passing evidence.

The HTTP error alone does not distinguish every validation branch or reveal production environment overrides. Local tests isolate the actual renderer mismatch: `SmartEmbed` sent every non-iframe URL to `LinkPreview`, which always started metadata loading, while the API correctly rejects unsupported domains. The synthetic unsupported-host case reproduces a needless API request without URL corruption or a provider failure. Allowed-host metadata and simulated provider failures are tested separately. Do not interpret this fix as proving that every production 400 has the same cause.

## Smallest fix

- Move the existing domain defaults, environment parsing and suffix match unchanged into `lib/preview-policy.ts`; API validation and server-rendered embeds use that one policy.
- Pass only the host eligibility boolean to the existing client card. Unsupported hosts start in the existing direct-link fallback, without a loading skeleton or metadata request. The original link remains usable, keyboard-focusable, and protected with `noopener`/`noreferrer`.
- Allowed hosts keep existing metadata loading, success/in-flight reuse, and error fallback. API URL/port/credential validation, DNS/IP blocking, redirect checks, rate limiting, timeouts, cache headers and metadata parsing remain in place. Host eligibility is not an SSRF safety verdict; the API still enforces all trust-boundary checks.
- No domain added, environment or provider setting changed, frozen measurement fixture edited, dependency added, or production data modified. The exact fix branch is deployment-disabled in `vercel.json` before its first push. No merge/deployment is authorized.

This removes predictably rejected requests; it does not enable previews for unsupported destinations, repair external media 403s, or promise a clean production console. The ElevenLabs limitation and sparse field-data gate remain as documented in the [P3.3 report](p3-3-production-field-ux.md).

## RED/GREEN and validation

`node --test tests/link-preview.test.cjs` on the base source: **1 failed / 1 passed**. The unsupported-host test expected zero metadata requests but observed `/api/preview?url=https%3A%2F%2Foutside.example%2Farticle`. This exercises the actual embed → client-card/effect path with synthetic fetch responses. After the fix, it renders the same direct-link fallback and makes zero requests. Allowed loading and iframe embedding remain covered. Additional checks exercise configured-domain replacement, subdomains and lookalike rejection.

Node **24.22.1**, npm **11.19.1**, unchanged lockfile: **141/141 regression tests**, lint, typecheck, credential-isolated webpack production build and **2/2 harness self-checks** passed. API tests cover allowed metadata, upstream 403 → no-store 502, unsupported/lookalike hosts, restricted DNS, URL credentials, nonstandard ports, unsafe redirects, rate limiting and fail-closed behavior. The Node test loader explicitly wraps the real sanitizer's CommonJS/default import boundary; no sanitizer behavior was changed.

Chromium **155.0.8059.12**, Playwright **1.64.0-alpha-1790635538000**, mobile **390×844** and desktop **1440×1000**: dedicated built-app preview checks passed. Each viewport observed **zero unsupported-host requests**, two allowed-host requests with mocked success/error responses, readable metadata, safe direct-link fallback, keyboard focus, no horizontal overflow and no runtime exceptions. Private synthetic screenshots were inspected. These are local functional regressions, not field Web Vitals, real-provider success, or a performance measurement.

The dedicated fixture launcher extends only the running synthetic server's module data. The frozen fixture file remains unchanged. One initial browser assertion selected two copies of an existing repeated article link and was corrected to select one. Running the general public suite against those dedicated preview fixtures timed out on `networkidle` because its requests were not mocked; that mixed setup is not a passing regression. Public/search suites passed at both viewports using their normal frozen-fixture server, separately from the dedicated preview suite.

## Reproduction

Use the [existing harness setup](../../scripts/ui-review/README.md) and pinned tools above. From the fix checkout, run tests/lint/typecheck, then `node scripts/ui-review/build.cjs` (it clears real credentials and pauses writes). Set an unused `UI_REVIEW_PORT` and a private `UI_REVIEW_OUTPUT` under `/tmp`.

1. Start `node scripts/ui-review/preview-server.cjs` on loopback. In another terminal with matching settings and `NODE_PATH` for Playwright, run `node scripts/ui-review/preview.cjs`. External requests are blocked and metadata responses mocked. Stop the server.
2. Start the ordinary `node scripts/ui-review/server.cjs` with its original fixtures. Run `public.cjs` and `search.cjs` at the same port, then stop the server. Do not run general suites against the dedicated preview fixtures.
3. Inspect the synthetic `preview-browser.json` and screenshots outside Git. Never reuse this fixture server or the mocked browser suite as production verification.

Independent standards/security and acceptance reviews found no findings. They checked the committed diff and retained receipts without new production requests; final hosted checks are recorded on the draft fix PR. Safari/WebKit, physical devices, screen readers, actual provider playback and post-deployment behavior are not covered. Production confirmation requires separately approved release work; no field-performance improvement is claimed.
