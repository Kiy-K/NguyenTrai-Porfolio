# PR #38 CI security follow-up

The first hosted `verify` job failed at `npm audit --omit=dev --audit-level=high`, after tests, lint, typecheck and build passed. [Original failure](https://github.com/Kiy-K/NguyenTrai-Porfolio/actions/runs/40046182408/job/120728324278). The original locked production tree reported six advisories: one critical, four high and one moderate. This is a dependency remediation, not an LCP optimization.

## Targeted changes

| Dependency | Before | After | Scope |
| --- | --- | --- | --- |
| Next.js and its runtime/compiler packages | 16.4.0 | 16.4.3 | Patch update; React unchanged |
| Root Zod | 4.3.6 | 4.6.6 | Same-major validation fix |
| body-parser | 2.3.0 | 2.4.0 | Within Express's existing dependency range |
| fast-uri | 3.1.8 | 3.1.9 | Within AJV's existing dependency range |
| next-cloudinary's URL loader | 5.10.4 | 5.11.0 | Scoped override removes vulnerable nested Zod 3 |

The [Next advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw) and [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) identify patched releases. Current audit receipts preserve the full advisory identifiers and affected dependency paths. No `npm audit fix --force`, Cloudinary downgrade, audit exception or workflow relaxation was used. The original high-severity gate remains unchanged.

Cloudinary is used by `components/VideoPlayer.tsx`, so removing it is not safe. Its current direct dependency pins a vulnerable loader. The override is limited to `next-cloudinary`, rather than forcing Zod 4 into code written against Zod 3. Loader 5.11.0 removes Zod but is deprecated in favor of 6.0.0, and brings utility 4.1.0 plus types 2.0.0-beta.3. This tradeoff is explicit: keep the smallest same-major change with tested API compatibility, and replace the override when the parent supports a maintained fixed loader. Deprecation alone is not a claim of a security vulnerability or proof of compatibility.

The compatibility regression covers image/video URL generation and the actual `CldVideoPlayer → getVideoPlayerOptions` path, using the app's string width/height, Cloudinary source URL, publicId, default poster state and aspect ratio. Expected outputs were checked against the original loader before replacement. No video URL format or player component code changes.

## Validation and frozen evidence

**Passed on Node 24.22.1/npm 11.19.1:** clean `npm ci`, 111 tests, lint, typecheck, production webpack build and local desktop/mobile public/search/portrait/fallback checks. Independent review passes with no blockers and confirms the actual player-options compatibility check. The formerly failing audit is rerun after the clean install; it reports **zero production vulnerabilities**. [Post-patch receipts](results/ci-followup/) are separate from original investigation receipts. Hosted status remains visible on [PR #38](https://github.com/Kiy-K/NguyenTrai-Porfolio/pull/38).

The original 35 Lighthouse samples and their source/lockfile hashes are unchanged. They measure the earlier dependency profile, not this security-patched PR head. No new LCP improvement is claimed and no new performance-scored arm is invented after seeing the results. The original report-only optimization decision still applies to its frozen experiment.

No merge, deployment, production resource change, live media upload/playback or P4 work occurred. The exact branch deployment guard remains active. Local synthetic checks do not establish real provider behavior or the runtime/security state of an already deployed site.
