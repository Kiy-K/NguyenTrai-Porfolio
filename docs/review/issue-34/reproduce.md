# Reproduce issue #34

Read [protocol](protocol.md) before running. Use Node24.21.0 on PATH (verify `node --version`), Lighthouse13.5.0, Puppeteer25.14.0 and Chromium155/build1247. External tool setup is in [the shared guide](../../../scripts/ui-review/README.md); no app dependency is added. Install the pinned tools outside the app and set `NODE_PATH` to their module directory and `CHROME_PATH` to that Chromium binary.

```bash
# From this review checkout; choose fresh paths if they already exist.
export HARNESS="$PWD/scripts/ui-review"
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
node "$HARNESS/matched-lighthouse.cjs" capture
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

Each scored child launches a fresh Chrome, replays the fixed snapshot, validates widget state, rejects runtime errors or missing assets, records effective settings and writes full Lighthouse/trace gzip files alongside per-run JSON. Servers are stopped between revision blocks. Wait for all scoring to finish before builds, tests or browser regressions. The matrix must complete28/10 runs; do not replace selected outliers.

The primary summary checks complete sample counts, identical runtime/browser/asset manifest and matched screen/throttle/blocked patterns. It preserves median/min/max and the frozen diagnostic threshold. Conditional results use the explicit `animation-off` summarizer command above and are saved in [animation-summary.json](results/animation-summary.json); do not use the default primary mode against that smaller matrix.

Then run `npm test`, `npm run lint`, `npm run typecheck` and public/search/admin suites from the release target, using the absolute shared harness and external Playwright tools. All calls remain local/synthetic. No production measurement or deployment is part of this recipe.
