# Reproduce the UI review

These scripts capture **synthetic local** browser, screenshot, Lighthouse and interaction-vitals evidence. They make the former temporary harnesses reviewable. They do not deploy, mutate real storage, or exercise live media uploads. Run from the target checkout root; scripts may live in a separate checkout so the same harness can measure before/after trees.

## Tools

Use Node 24, the target tree's `npm ci`, and externally installed review tools. The original measurements used Playwright `1.64.0-alpha-1790635538000` (Chromium 155, build 1247) and Lighthouse `13.5.0`. Keep these versions fixed when comparing runs. Browser plugin not available in the measurement environment; these scripts use regular Playwright.

```bash
# From the evidence branch's checkout; app dependencies remain unchanged.
export HARNESS="$PWD/scripts/ui-review"
export UI_REVIEW_TOOLS="${TMPDIR:-/tmp}/nguyentrai-ui-review-tools"
npm install --prefix "$UI_REVIEW_TOOLS" --no-save --package-lock=false playwright@1.64.0-alpha-1790635538000 lighthouse@13.5.0
export NODE_PATH="$UI_REVIEW_TOOLS/node_modules"
node "$UI_REVIEW_TOOLS/node_modules/playwright/cli.js" install chromium
```

Keep `HARNESS` absolute when changing to a different target checkout. These are operator commands, not an application installation requirement. Existing matching tools may be used by setting `NODE_PATH` to their module directories.

## Build and serve the target

```bash
# In the target checkout (npm ci already completed).
export UI_REVIEW_PORT=3330
export UI_REVIEW_OUTPUT="${TMPDIR:-/tmp}/nguyentrai-ui-review-after"
node --test "$HARNESS/harness.test.cjs"
node "$HARNESS/build.cjs"
node "$HARNESS/server.cjs"
```

Leave the server running in that terminal. Run the remaining commands from another terminal with the same exports and target checkout. Stop it with Ctrl-C before changing targets. Port 3330 serves the app; port 3331 is the synthetic Redis responder. `UI_REVIEW_PORT` changes both ports together. The responder accepts only GET of `portfolio_data_v4`, rejects all other commands, binds to loopback, and uses [fixtures.cjs](fixtures.cjs): 31 published products in the measured section, two nonpublic controls and one published control in another section.

`build.cjs` and `server.cjs` force Redis selection, pause persistent writes, blank database/storage/provider credentials, disable bootstrap and use synthetic peppers. Existing `.env.local` files are not edited. Admin browser requests are intercepted before reaching the app; browser suites abort every nonlocal origin. Do not use the scripts as production servers.

## Capture and assert

```bash
node "$HARNESS/screenshots.cjs" after
node "$HARNESS/public.cjs"
node "$HARNESS/search.cjs"
node "$HARNESS/vitals.cjs" after
```

- `screenshots.cjs before|after`: identical fixture/viewports for home, section and detail; waits for fonts and finite animations.
- `public.cjs`: route identity, overflow, card heights, native-menu keyboard/Escape/resize/scroll cleanup, reduced motion and settled focus color on parchment. This assertion suite requires the corrected P1 source; use capture-only screenshots for older baselines.
- `search.cjs`: accent-folded query (11 matches), title sorting, tag intersection (6), pagination/reset/no-results, offline typo query, zero retired/provider requests and retired endpoint 404. It requires the P0 foundation. Receipts name the assertions instead of showing only the final detail URL.
- `vitals.cjs before|after|after-quiet`: identical search → title-desc → tag sequence at 1440×1000 and 390×844. `lcp`, `inp` and `interactionDuration` are milliseconds; `cls` is unitless. `interactionDuration` is the maximum Event Timing duration seen; `inp` is the bundled web-vitals page-lifetime INP estimate, so they need not be equal. These are lab observations, not field INP.

For admin checks, run the same build/server steps from `review-admin-sections`, then:

```bash
node "$HARNESS/admin.cjs"
```

This checks pending/rejected/offline/accepted auth, validation, failed-save retention, hashed feedback, image preview, synthetic XHR byte progress/cancel/ready, exact delete confirmation and a parsed recovery download. All auth, upload, save, feedback and delete calls are mocked. Screenshots and receipts go to `UI_REVIEW_OUTPUT`, never into the target checkout by default.

## Lighthouse and before/after comparison

Historical baseline source: `97da608` (ancestor of the published P0 foundation). Historical after source: `5a86d8c` (P1 replay before the focus correction). Current corrected source is `review-ui-public-polish`. Create separate checkouts with `git worktree add <directory> <revision>`, run `npm ci` in each, then use the same absolute `HARNESS`, ports, tools and build/server commands. Set distinct output directories and stop each server before starting the next. Capture `screenshots.cjs before` / `vitals.cjs before` on the baseline and `after` on the comparison tree.

```bash
export CHROME_PATH="$(node -p "require('playwright').chromium.executablePath()")"
node "$HARNESS/lighthouse.cjs"
```

`lighthouse.cjs` uses the historical profile: mobile 390×844/device scale 1 and desktop preset 1440×1000, performance/accessibility only, Vercel requests blocked. Unlike the fully isolated Playwright suites, Lighthouse allows the existing external ElevenLabs widget; its contrast failure and network variability remain part of that profile. No provider keys are enabled. Raw reports are retained locally; inspect them before sharing rather than committing network payloads by default.

Repeat sequentially on an otherwise quiet machine. Timings/scores will vary; preserve outliers, record tool/OS changes, and do not overwrite the dated original measurements with a new run. Generated JSON receipts include revision, Node version, UTC time, loopback origin and results. `server.cjs` exits on server/child errors; browser assertion failures exit nonzero.

The committed historic `results/*.json` are output evidence, not fixtures or a release approval. Firefox/Safari, real provider playback/uploads, post-release CDN checks and field performance remain separate gates. P4 remains deferred.
