# P6 — SEO and discoverability

## Scope and behavior

Public home, configured sections and published article pages use Next.js metadata
with Vietnamese titles/descriptions, canonical URLs, Open Graph and Twitter cards.
The canonical origin is `https://nguyen-trai-porfolio.vercel.app`, verified against
the Vercel production project. Host headers, local APP_URL and preview aliases
cannot change canonical URLs. Update `PRODUCTION_ORIGIN` if the public domain changes.

Article descriptions use authored description, then authored fullDescription.
Missing copy stays absent. Titles and descriptions preserve the stored plain text
(the same format shown by the public renderer); React escapes metadata attributes.
Only absolute HTTP(S) image URLs without embedded credentials enter social metadata.
No default image, AI copy, external SEO service or dependency was added.

`/sitemap.xml` is dynamic and reads through existing public `getProducts` filtering
and the unchanged Redis/Neon/cache contract. It includes home, nine configured
sections (including currently empty ones), and unique valid published/legacy article
URLs. Drafts, archived/unknown statuses, malformed IDs/titles/renderer fields and internal routes
are excluded. Article IDs are encoded as a single path segment. Backend failures
propagate as generic framework 5xx rather than returning private data, a partial
success sitemap, or falling back to another backend.

No lastModified, publication dates or historical dates are inferred. The optional
legacy `createdAt` field does not establish publication time or latest modification;
new article creation currently records neither. Add dates only after establishing
reliable persisted editorial timestamps. No build/request time is used as content time.

JSON-LD uses WebSite on home, BreadcrumbList on sections, and Article plus
BreadcrumbList on article pages. Article headline/description/images and a matching
configured section come from actual data. No invented author, publisher, source,
publication date, search action or historical claim. Reference authors are never
promoted to article authors. `<` is escaped in serialized JSON to prevent script
termination; references remain in the existing safe public renderer and API.

Root metadata defaults to `noindex, nofollow` for administrative/login and other
internal pages; valid public pages override to `index, follow`. Missing, malformed
or unpublished article metadata invokes notFound without reading private storage.
Next.js streaming responses, including tested Twitterbot requests, may return
HTTP 200 with not-found UI and noindex once the page shell has streamed. Public
article APIs still return 404 for missing/private records. The sitemap excludes them.
This preserves existing streaming behavior; it does not promise hard 404 page status.
`/robots.txt` allows public crawling, discourages `/admin` and `/api/`, and advertises
the canonical sitemap. These hints are not access controls: existing session,
origin, rate-limit and API filtering boundaries remain authoritative.

## Phase 0 — verified before implementation

On 2026-10-24, latest main was `466d1e6`; PR #44 merged at 12:04:38Z.
Vercel production deployment `dpl_C8k8kTk7ese3JAWwq4FBb6zSWLz9` was READY on that SHA.
GET-only smoke checks: home/section/existing article/detail API 200; missing detail
API 404; fresh admin list 401; `/admin` redirected 307 to login. The public list
contained 31 articles and no explicit nonpublic statuses. No production article
was created, modified or deleted. Source and reference regressions verify the
API preserves references, public detail renders ordered escaped sources, and
legacy/media/private behavior remains compatible across both backend selections.

### Separately recorded limitation

None of the 31 public production articles contained references. Live
reference-bearing rendering cannot be verified without a production content change;
it is covered by synthetic tests and a local production-build browser fixture.
No P5 functional issue was found in the bounded read-only smoke checks.

## Validation and reproduction

Use pinned Node 24.22.1 and lockfile-installed Next.js 16.4.3. The existing isolated
build harness blanks real provider/storage credentials and pauses persistent writes.
Do not run browser fixtures against production credentials.

```sh
npm test
npm run lint
node scripts/ui-review/build.cjs
npm run typecheck
NODE_PATH=/path/to/playwright/node_modules UI_REVIEW_PORT=3356 UI_REVIEW_OUTPUT=/tmp/p6-seo node scripts/ui-review/seo.cjs
```

The build command executes the production Webpack build. The browser script starts
and stops loopback production and read-only synthetic Redis servers, aborts external
browser requests, and checks desktop 1440×1000 and mobile 390×844. It verifies real
metadata tags, bot HTML without JS, JSON-LD parsing/escaping, sitemap XML/URLs,
private/missing pages, robots/admin noindex, references round-trip, page errors and
overflow. Playwright is an external review tool, not an application dependency.

Final validation on 2026-10-24:

- Full suite: **130 passed**, including ten SEO regressions and existing reference,
  cache/persistence, auth, sanitization, media and admin behavior tests.
- ESLint and TypeScript `tsc --noEmit`: passed.
- Node **24.22.1**, locked Next.js **16.4.3**, production **Webpack** build: passed.
  The identity check reported Redis/unconfigured Neon; real credentials were blank.
- Chromium 155 via pinned external Playwright **1.64.0-alpha-1790635538000**:
  **1440×1000** and **390×844** browser checks passed. Generated HTML includes the
  expected social image URL and `summary_large_image` on the image-bearing fixture.
  Sitemap XML contained 44 unique canonical URLs (home, 9 sections, 34 public
  synthetic articles), excluding malformed/private controls and untracked dates.
  No browser page errors or horizontal document overflow. Desktop/mobile screenshots
  were visually inspected; hostile literal text is deliberate injection-test data.
- [Exact-source browser receipt](evidence/p6/seo-browser.json),
  [desktop screenshot](evidence/p6/seo-public-1440.png),
  [mobile screenshot](evidence/p6/seo-public-390.png).
  Receipt source `d26ef67` includes final harness changes; app source is unchanged
  from built/reviewed `148c23b`. Later evidence/docs commits do not change runtime code.

The first sandbox-only test/build attempts could not execute subprocess-dependent
checks correctly. Unsandboxed reruns passed. One typecheck overlapped Next.js type
regeneration and failed on missing generated files; the final sequential post-build
typecheck passed. Browser setup initially had mismatched Playwright/Chromium; the
pinned external review version resolved it. No app dependency changed.

### Independent review

Two read-only reviewers independently examined `origin/main...HEAD`:

- **Standards:** zero remaining material findings. A malformed-image-source finding
  was fixed in `148c23b` and re-reviewed; ten SEO tests independently passed.
- **Spec:** zero remaining material findings. A malformed-media-array finding was
  fixed in `39e8e39`; image validation and final streaming documentation were
  re-reviewed through `d26ef67`. Ten SEO tests independently passed.

Reviewers did not independently rerun the full suite, production build or browsers;
those are implementer results above. Hosted security-baseline verification and
both CodeQL analysis jobs passed on the initial PR head. The aggregate CodeQL check
flagged a test-only lowercase script-wrapper extraction regex as unsafe HTML
filtering; the test now slices the known React-generated wrapper instead. This is
not a runtime sanitizer. Final hosted check status is recorded in the PR checks. No issue-tracker agent configuration was
present; the user's supplied P6 task served as the specification.

Implementation follows the official Next.js guidance for
[metadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata),
[sitemaps](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap),
[robots](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots),
and [JSON-LD escaping](https://nextjs.org/docs/app/guides/json-ld), fetched through
Context7 for this task.

## Risks and rollback

Search engine crawling, chosen snippets, rankings and rich-result eligibility remain
external decisions. Relative/invalid stored image URLs yield text-only cards.
Preview pages use production canonical URLs; deployment protection remains needed
for private previews. A backend outage yields a retryable sitemap/page failure.
No real provider, live Neon/Redis mutation, SEO submission or field ranking test
is part of this change. P7 and TanStack Query remain out of scope.

The feature branch is disabled in `vercel.json` before push to avoid automatic
preview deployment. Draft PR only; do not merge or deploy without explicit approval.
Rollback by reverting the P6 implementation commit(s). No data migration,
production article deletion, database change or cache invalidation is needed.
