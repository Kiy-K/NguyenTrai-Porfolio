# Issue 39: card placeholder contrast

P3.3's read-only production audit at main `df5f873eab7f34668e165f847e75608b92b68f63` demonstrated two desktop card-placeholder text nodes at **2.73:1**, using `#B8860B` on `#F4EBD0`, 20px normal-weight italic. The normal-text target is 4.5:1. No production identifiers, payloads or screenshots are published here.

The fix changes **one text color** in `components/ProjectCard.tsx` to existing rust `#8B3A3A`. Scope: the no-image branch used by `ProjectList`; its callers, images, dimensions, text, links, hover behavior and descriptions are otherwise unchanged. There are no type/export, fixture, dependency or storage changes. This is a reversible owned-UI repair; it does not repair ElevenLabs attribution ([vendor follow-up #40](https://github.com/Kiy-K/NguyenTrai-Porfolio/issues/40)). `vercel.json` disables Git deployments for this draft branch. No merge or deployment is authorized.

## Verification

- Node **24.22.1**, npm **11.19.1**, same repository lockfile. `npm test` **111/111**, lint, typecheck, and credential-isolated webpack production build passed.
- Existing `scripts/ui-review/public.cjs` and `search.cjs` passed on loopback synthetic content at **390×844** and **1440×1000**: route navigation, overflow, focus/Escape/menu behavior, reduced motion, accent-insensitive/offline search, sort/tags/pagination and no AI calls. Real storage/provider credentials were cleared.
- A separate rendered-placeholder check used the same synthetic fixture responder with all fixture `images` arrays replaced by `[]` **in process memory only**. This is necessary because the ordinary fixtures' visible published cards all have images and therefore do not exercise this branch.
- Chromium **155.0.8059.12**, Playwright **1.64.0-alpha-1790635538000**, axe-core **4.14.0**. The actual rendered placeholder computed `rgb(139, 58, 58)` on its media box's `rgb(244, 235, 208)` at both viewports. WCAG relative-luminance contrast is **6.382:1**; an assertion required ≥4.5. Scrolled placeholder into view, then ran axe `color-contrast`: no reported violations at either viewport; incomplete contrast checks elsewhere remain. This is not a WCAG-compliance claim.
- No synthetic Lighthouse performance metric is claimed. This color change has no field-performance result. Safari/Firefox, physical devices and screen-reader execution were not tested.

## Reproduction and limits

Follow the existing [UI review setup](../../scripts/ui-review/README.md), using this branch's build and an unused loopback port. Run the standard public/search suites first with unchanged fixtures. For the targeted check, stop the standard server and start it from this checkout with an in-memory fixture override:

```bash
UI_REVIEW_PORT=3392 UI_REVIEW_OUTPUT=/tmp/issue39-fix-local node -e \
  "const fixtures=require('./scripts/ui-review/fixtures.cjs'); for(const product of fixtures) product.images=[]; require('./scripts/ui-review/server.cjs')"
```

Open the local `http://127.0.0.1:3392/sections/tu-tuong-nhan-nghia` at each viewport with external requests blocked. Inspect `[class~="group/card"] div.text-xl.italic`; its background is the closest ancestor `[class*="aspect-"]`, not the transparent wrapper. Compute sRGB relative luminance from the rendered colors and assert `(Llighter + 0.05) / (Ldarker + 0.05) >= 4.5`. Run axe after scrolling that node into view. Retain only synthetic screenshots; stop the server afterward.

The first diagnostic selected a transparent wrapper/unrelated italic element and failed; the final scoped selector and actual parchment ancestor above corrected the diagnostic. The ordinary browser regression suites were not altered to make them pass. A duplicate dependency installation initially exceeded temporary-disk quota; the fix worktree then reused the report checkout's identical locked dependency tree. Build-generated files and the dependency symlink are excluded from this diff. The report checkout's successful build is separate from this fix checkout's successful build; neither is a cloud deployment.

Independent review disposition is recorded on the draft PR. The production report remains a separate PR for Issue #39.
