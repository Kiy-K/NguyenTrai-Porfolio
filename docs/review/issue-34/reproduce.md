# Reproduce issue #34

Read [protocol](protocol.md) before running. Historical measurements used Node24.21.0. Use patched **Node24.22.1** on PATH for new work (verify `node --version`); record this as a new profile. Lighthouse13.5.0, Puppeteer25.14.0, chrome-launcher1.2.2 and Chromium155/build1247 remain fixed. External tool setup is in [the shared guide](../../../scripts/ui-review/README.md); no app dependency is added. Install the pinned tools outside the app and set `NODE_PATH` to their module directory and `CHROME_PATH` to that Chromium binary.

```bash
# From this review checkout; choose fresh paths if they already exist.
export HARNESS="$PWD/scripts/ui-review"
# A shallow CI checkout may not contain the old ancestor; fetch history first.
if [ "$(git rev-parse --is-shallow-repository)" = true ]; then git fetch --unshallow origin; fi
git fetch origin main
git cat-file -e 97da6087a6969975fbb360c3ec966ac6c723fb6d^{commit}
# Exact scored and functional browser tools, outside application dependencies.
export UI_REVIEW_TOOLS=/tmp/nguyentrai-p31-tools
npm install --prefix "$UI_REVIEW_TOOLS" --no-save --package-lock=false lighthouse@13.5.0 puppeteer-core@25.14.0 chrome-launcher@1.2.2 playwright@1.64.0-alpha-1790635538000
export NODE_PATH="$UI_REVIEW_TOOLS/node_modules"
node "$UI_REVIEW_TOOLS/node_modules/playwright/cli.js" install chromium
export CHROME_PATH="$(node -p "require('playwright').chromium.executablePath()")"
git worktree add --detach /tmp/nguyentrai-p31-baseline 97da6087a6969975fbb360c3ec966ac6c723fb6d
git worktree add --detach /tmp/nguyentrai-p31-release a86a991899a84f4ceaa72b2931049331466ff061
export P31_BASELINE=/tmp/nguyentrai-p31-baseline
export P31_RELEASE=/tmp/nguyentrai-p31-release
export P31_ASSETS=/tmp/nguyentrai-p31-assets
export P31_OUTPUT=/tmp/nguyentrai-p31-matrix
# In EACH target worktree, sequentially before scoring:
npm ci --no-audit --no-fund
node "$HARNESS/build.cjs"
```

Do not copy `.env.local` to either worktree. Use the credential-isolated committed build/server. The experiment snapshot has all public GET response bodies in the separate local evidence archive, with byte hashes in [widget-assets.json](widget-assets.json). Restore its `nguyentrai-p31-assets/` directory under `/tmp` for the exact frozen responses used here. Asset bodies are kept outside Git; the archive contains synthetic reports and public vendor responses, never production content or secrets.

To capture a NEW snapshot instead, start `node "$HARNESS/server.cjs"` from the release worktree and, in another terminal with the same tool exports and target cwd, run:

```bash
# Both paths must be NEW and EMPTY; the collector rejects reused directories.
export P31_ASSETS="$(mktemp -d /tmp/nguyentrai-p31-assets-new.XXXXXX)"
export P31_OUTPUT="$(mktemp -d /tmp/nguyentrai-p31-capture-new.XXXXXX)"
node "$HARNESS/matched-lighthouse.cjs" capture
# Preserve this new asset directory, then choose a distinct empty matrix output.
export P31_OUTPUT="$(mktemp -d /tmp/nguyentrai-p31-matrix-new.XXXXXX)"
```

Stop that server before the matrix. Capture is the only step permitting live public external GETs. It never starts a conversation. Compare all hashes against the committed manifest; a changed response produces a different experiment and must be documented, not claimed as exact reproduction. Do not overwrite the original snapshot/results. Failed HTTP responses are preserved; missing responses invalidate scored samples.

Run the matrix from the review checkout (not from a target; it launches each pinned server itself):

```bash
node "$HARNESS/matched-matrix.cjs"
node "$HARNESS/summarize-matched.cjs" "$P31_OUTPUT"
# Conditional animation phase; use a distinct output directory.
export P31_OUTPUT=/tmp/nguyentrai-p31-animation
node "$HARNESS/matched-matrix.cjs" animation-off
node "$HARNESS/summarize-matched.cjs" "$P31_OUTPUT" animation-off
```

Each scored child launches a fresh Chrome, replays the fixed snapshot, validates widget state, rejects runtime errors or missing assets, records effective settings and writes full Lighthouse/trace gzip files alongside per-run JSON. Servers are stopped between revision blocks. Wait for all scoring to finish before builds, tests or browser regressions. The primary matrix requires **28 runs**; animation-off requires **10 additional runs**; do not replace selected outliers.

The primary summary checks complete sample counts, identical runtime/browser/asset manifest and matched screen/throttle/blocked patterns. It preserves median/min/max and the frozen diagnostic threshold. Conditional results use the explicit `animation-off` summarizer command above and are saved at `$P31_OUTPUT/animation-summary.json`; [the committed reference](results/animation-summary.json) is the historical comparison; do not use the default primary mode against that smaller matrix.

Then run `npm test`, `npm run lint`, `npm run typecheck` and public/search/admin suites from the release target, using the absolute shared harness and external Playwright tools. All calls remain local/synthetic. No production measurement or deployment is part of this recipe.

## Restore original omitted evidence without rescoring

After extracting the retained archive, restore original timings using the checked-in transformer:

```bash
node "$HARNESS/restore-matched-evidence.cjs" /tmp/nguyentrai-p31-matrix /tmp/nguyentrai-p31-animation "$PWD/docs/review/issue-34/results"
node "$HARNESS/summarize-matched.cjs" "$PWD/docs/review/issue-34/results"
```

The transformer verifies every score-bearing TBT/LCP value and each existing network item against the original report before restoring timing fields. Its manifest identifies all source report hashes and explicitly derived phase metadata. It never changes observed timestamps, source revisions, runtime versions, scores or task diagnostics. Use archive-backed restoration only for the original28+10 samples, not a new snapshot. Future blocked-prefetch/patched-Node runs have changed conditions and need their own matrix and conclusions.
