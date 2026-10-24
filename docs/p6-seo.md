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
Next.js streaming clients may receive HTTP 200 with not-found UI and noindex;
HTML-limited crawlers (tested with Twitterbot) receive HTTP 404 before streaming.
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

Validation results and independent review: pending final checks below.

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
