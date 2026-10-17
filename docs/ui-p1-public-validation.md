# P1 public polish — local validation, 2026-10-17

Branch: `ui/public-polish`, stacked on reviewed P0 search and summary-removal changes. The original independent P0 branches remain available. No main merge, push, release, environment change or production write.

## Changes

- Preserve Vietnamese copy, historical imagery, Playfair typography and parchment/gold/burgundy colors. Reduce mobile hero/section padding and long entrance delays; keep a single short hero entrance. Add explicit hero image sizes/preload for the existing above-the-fold portrait.
- Use a consistent 16:10 card image frame, readable wrapped titles and faster hover transitions. Match the existing skeletons to the new image frame, summary-free cards and mobile page spacing.
- Replace the offscreen mobile drawer with a labelled native modal dialog. Closed links leave the keyboard sequence; the browser handles modal focus and Escape. Closing restores focus, resizing to desktop closes the modal, and body scroll is restored. No new dependency.
- Add visible palette-matched keyboard outlines, improve search placeholder contrast, enlarge tag targets and suppress motion delays when reduced motion is requested.
- Remove the homepage's dead category Suspense boundary: CategoryLayout is a synchronous client component with no suspending read. No replacement loading system was added.

## Evidence

- 90 tests pass on the P1 snapshot, including the new mobile-dialog regression plus both P0 suites. Lint, typecheck and webpack build pass. Independent review found only loading-shell mobile spacing drift; that was corrected before handoff. Mechanical Impeccable scan returned `[]`.
- Playwright at 390×844 and 1440×1000 checks home/section/detail identity, meaningful content, no horizontal overflow or uncaught page errors, consistent card heights, native menu keyboard opening, modal Tab sequence, Escape/focus restoration, body scroll restoration, desktop resize cleanup and reduced motion. Native Chromium permits the browser-chrome tab stop between modal focus cycles; background app links remain inert.
- Screenshots were captured before/after at both sizes: `/tmp/nguyentrai-p1-{before,after}-{home,section,detail}-{390,1440}.png`, plus `/tmp/nguyentrai-p1-mobile-menu.png`. Synthetic section data uses the repository's real local portrait asset; no editorial content/media references were changed.
- Artifacts: `/tmp/nguyentrai-p1-browser.json`, `nguyentrai-p1-tests.log`, `nguyentrai-p1-lint.log`, `nguyentrai-p1-types.log`, `nguyentrai-p1-build.log`, `nguyentrai-p1-design-scan.json`.

Harness: `/tmp/nguyentrai-p1-browser.cjs`, using the synthetic read-only app at `http://127.0.0.1:3330` and existing cached Playwright. External browser traffic is blocked. The Browser plugin runtime described by the frontend testing skill is not installed. Performance/accessibility measurements are recorded separately in `docs/ui-p3-a11y-performance.md` on the downstream audit branch.

Scope limits: embedded-media playback and real provider uploads were not exercised. Shared media rendering and providers remain unchanged. Native dialog behavior was tested in Chromium; Safari/Firefox are not claimed verified. Reverting the scoped UI commit requires no data migration; release/rollback still requires owner approval.
