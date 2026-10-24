# Reproduce issue 37

Read [primary protocol](protocol.md) and [A/B protocol](ab-protocol.md) before measuring. These are synthetic local lab runs, not deployed Vercel/CDN or field measurements. No secret env file is copied. Do not run builds/tests concurrently with scored samples.

Use the source SHA in each plan, Node **24.22.1** and npm **11.19.1** on PATH. The historical checkout lacks the current mise pin, so explicitly export the patched runtime's bin directory. Do not rely on the historical directory's default `node` (on the investigator's host it selected Node26 until PATH was pinned).

```bash
export PATH=/path/to/node-v24.22.1/bin:$PATH
node --version
npm --version
export HARNESS="$PWD/scripts/ui-review"
export UI_REVIEW_TOOLS=/tmp/nguyentrai-p32-tools
# Restore the exact two tool stacks actually used, including transitive dependencies.
node -e 'const fs=require("fs"); for(const label of ["lighthouse-stack","playwright-stack"]){const root=process.env.UI_REVIEW_TOOLS+"/"+label;fs.mkdirSync(root,{recursive:true});const lock=fs.readFileSync("docs/review/issue-37/tools/"+label+"-lock.json");fs.writeFileSync(root+"/package-lock.json",lock);fs.writeFileSync(root+"/package.json",JSON.stringify(JSON.parse(lock).packages[""]));}'
npm ci --prefix "$UI_REVIEW_TOOLS/lighthouse-stack" --no-audit --no-fund
npm ci --prefix "$UI_REVIEW_TOOLS/playwright-stack" --no-audit --no-fund
export NODE_PATH="$UI_REVIEW_TOOLS/lighthouse-stack/node_modules:$UI_REVIEW_TOOLS/playwright-stack/node_modules"
node "$UI_REVIEW_TOOLS/playwright-stack/node_modules/playwright/cli.js" install chromium
export CHROME_PATH="$(node -p "require('playwright').chromium.executablePath()")"
# Ensure full history before creating historical worktrees if this is a shallow clone.
git fetch --unshallow origin # only when git rev-parse --is-shallow-repository says true
# Use clean detached worktrees; change paths in a COPY of the committed plans if needed.
git worktree add --detach /tmp/nguyentrai-p32-baseline 97da6087a6969975fbb360c3ec966ac6c723fb6d
git worktree add --detach /tmp/nguyentrai-p32-current e081fff4317e75205b02066bf23668674425a791
# Bundles contain just each exact one-line experimental commit, requiring current main as prerequisite.
git fetch docs/review/issue-37/experiments/decode-sync.bundle HEAD
git worktree add --detach /tmp/nguyentrai-p32-decode-sync 213f95f # full SHA in ab-plan.json
git fetch docs/review/issue-37/experiments/fetch-high.bundle HEAD
git worktree add --detach /tmp/nguyentrai-p32-fetch-high 5f345d8
# In EACH target directory, before scoring:
npm ci --no-audit --no-fund
node "$HARNESS/build.cjs"
```

Next's security-advisory notice initially returned exit 1 after compilation in each new target; the identical retry passed. Keep that failed attempt separate. Do not upgrade dependencies inside a matched experiment. The baseline sanitizer differs from patched current; both use their exact lockfiles. This is an isolated historical measurement, not permission to run the historical app publicly.

The collector and matrix source were frozen before measurement. Primary and A/B use the identical collector SHA recorded in every receipt. Tool binaries, font/image/lockfile hashes and target build IDs are in [build manifest](build-manifest.json). Variant patches and exact commit bundles are in [experiments](experiments/).

```bash
export P31_ASSETS="$(mktemp -d /tmp/nguyentrai-p32-assets-replay.XXXXXX)"
printf '{}\n' > "$P31_ASSETS/manifest.json"
export P31_OUTPUT="$(mktemp -d /tmp/nguyentrai-p32-primary-replay.XXXXXX)"
node "$HARNESS/lcp-matrix.cjs" docs/review/issue-37/primary-plan.json
node "$HARNESS/summarize-lcp.cjs" "$P31_OUTPUT"
export P31_OUTPUT="$(mktemp -d /tmp/nguyentrai-p32-ab-replay.XXXXXX)"
node "$HARNESS/lcp-matrix.cjs" docs/review/issue-37/ab-plan.json
node "$HARNESS/summarize-lcp.cjs" "$P31_OUTPUT"
```

The inherited `P31_*` environment names keep the reused collector profile compatible. Widget is **off in every scored cell**; no live vendor response is fetched and the same empty manifest is hashed for all 35 samples. Unknown external responses invalidate a run. This is a controlled widget-off investigation, not a claim about widget-on performance. No widget-on confirmation is needed unless an arm passes the frozen benefit gate.

Each round starts the same loopback server, warms the document and AVIF optimizer widths 256/640/1920, then uses fresh Chromium/browser storage per sample. Optimizer warm-up receipts include MISS/HIT, duration, size/type/hash; first MISS is a separate cold-optimizer diagnostic, never a scored cold-browser sample. Alternating target order is explicit in the matrix. All reports, traces, receipts, plan copies and command output are retained under distinct phase directories. Do not overwrite existing files or drop outliers.

For fixed-viewport/browser assertions, start `node "$HARNESS/server.cjs"` from the chosen target and run, separately:

```bash
export UI_REVIEW_OUTPUT=/tmp/nguyentrai-p32-functional-new
node "$HARNESS/lcp-browser.cjs" # append baseline for historical geometry-only mode
node "$HARNESS/public.cjs"      # current target only
node "$HARNESS/search.cjs"      # current target only
```

All external browser calls are blocked; fallback serves local portrait bytes for the Wikimedia URL, then tests a synthetic failure. JavaScript-disabled cases prove preload download only: Next's streamed hidden segment is not revealed. Fixed-viewport screenshots and geometry are authoritative for settled layout. Lighthouse post-audit emulation is reset: do not use its final DOM rectangles/currentSrc as scored mobile geometry. Candidate callbacks, insight rectangles, trace PaintImage URL/width and ResourceTiming remain navigation evidence. CDP events after the audited navigation belong to teardown/resizing, not duplicate initial downloads.

Run `npm test`, `npm run lint`, `npm run typecheck`, the credential-isolated webpack production build, and `node --test scripts/ui-review/harness.test.cjs` after scoring. Keep real Neon, credentials, media uploads and production CDN checks outside this recipe. P4 is excluded.
