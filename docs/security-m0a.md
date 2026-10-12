# M0A security containment and regression baseline

## Review scope and dependency provenance

Baseline commit: `29dcf48023e7e36b62a440d5ede8c61abfce9b40` on `main`.
Implementation branch: `security/m0a-containment`. The initial local-only pass performed no remote mutations. The owner subsequently
authorized pushing, merging, and deploying M0A, with a production Neon migration
reserved for a separate phase.

The working tree already contained changes to `package-lock.json` and
`next-env.d.ts`. Both were inspected and preserved byte-for-byte. The original
lockfile diff includes 205 changed package versions, additions, or removals;
it is pre-existing work. After release approval, a separate release lockfile was
generated from the committed baseline using `next@16.4.0` and compatible
`npm audit fix --package-lock-only --ignore-scripts` updates. That release lockfile
is staged independently; the original working lockfile stays untouched.

| Component | Committed lockfile | Working lockfile / installed locally |
| --- | --- | --- |
| Next.js | 16.2.3 | 16.4.0 |
| React / React DOM | 19.2.4 | 19.2.4 |

The release raises the manifest Next.js minimum to `^16.4.0`. The original
working lockfile retains its pre-existing root declaration; review its residual
diff separately after release. A clean `npm ci` in an isolated copy succeeded. This proves
local reproducibility, not the version deployed to production.

Next.js requires Node >=20.9.0, verified in the installed package and
[official documentation](https://nextjs.org/docs/app/getting-started/installation).
Local tooling is Node 26.10.0 / npm 11.19.1; lint, TypeScript checks, all 13 regression tests, and the production build also
passed on Node 22.23.3. CI uses Node 22 LTS. The release was also validated on production's Node 24.21.0 runtime. The user's
concurrent Neon dependency setup is excluded from M0A and retained locally for
the separate migration phase. No new M0A package dependencies were added:
Node's test runner and the installed TypeScript compiler run the tests.

## Security impact

- Bootstrap is disabled unless the server-only `ADMIN_BOOTSTRAP_TOKEN` contains
  at least 32 characters. Use a cryptographically random value, not a memorable
  phrase. Requests must provide the matching `x-admin-bootstrap-token` header;
  token comparison uses fixed-size SHA-256 digests and constant-time comparison.
  Unauthorized requests are rejected before rate-limit or credential Redis I/O.
- Existing same-origin checks and authorized bootstrap rate limits remain.
- A single Lua command checks key existence and writes the existing credential
  hash schema. Concurrent provisioning returns a password only to the winner.
  Existing complete, legacy, or partial credential keys are never overwritten.
- Existing login, legacy hash upgrade, session lifetime, cookie protections,
  IP binding, content keys, and media integrations remain unchanged.
- Both login navigation callbacks and the proxy use a shared redirect validator.
  Destinations must be plain `/admin` or administrative descendant paths.
  Query/fragment suffixes are retained. External URLs, schemes, controls,
  backslashes, encoded pathname components, dot segments, sibling paths, and
  login loops fall back to `/admin`.

Owner provisioning remains available through the login page's masked token
field. Configure the token only for first setup, save the generated password
immediately, verify login, then remove the token. Never put it in a URL, logs,
source control, or a `NEXT_PUBLIC_` variable. Existing admin access requires no
bootstrap token. Bootstrap cannot retrieve or reset a password.

## Relevant Next.js advisories checked (2026-10-12)

- [App Router CSP nonce XSS, GHSA-ffhc-5mcf-pf4q](https://github.com/vercel/next.js/security/advisories/GHSA-ffhc-5mcf-pf4q):
  published affected range includes 16.2.3; local 16.4.0 is outside that range.
- [AVIF image optimizer RCE, GHSA-2xp9-vwfh-vxw4](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4):
  fixed on the 16.x line in 16.3.3. This project enables AVIF image optimization;
  confirming the deployed version is urgent if it still uses 16.2.3.
- [Node ImageResponse RCE, GHSA-vcvr-r3jv-pc5j](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j):
  affected >=16.2.0 <16.3.6; exploitation requires attacker-controlled SVG values
  in Node `next/og`. Local 16.4.0 is outside the affected range.
- [Image optimizer SSRF, GHSA-cjq9-62q9-8jv4](https://github.com/vercel/next.js/security/advisories/GHSA-cjq9-62q9-8jv4):
  relevant because this project has remote image allowlists. The retrieved vendor
  page uses `16.3.?` placeholders for the fix range; it does not establish an
  exact patched version. Do not treat an audit with no Next.js findings as proof
  this advisory is resolved in production.
- The [vendor advisory list](https://github.com/vercel/next.js/security/advisories)
  also includes recent cache poisoning and cache leakage advisories. Compare
  their finalized affected ranges with the actual deployment before release,
  particularly for this application's cached App Router content.

## Local verification

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 13 focused tests passed, including unauthorized/disabled bootstrap,
  same-origin enforcement, concurrent provisioning, preserving partial/legacy
  credentials, PBKDF2 verification, storage failure, redirect attacks, both client
  navigation callbacks, secure login cookies, and existing IP-bound sessions.
- `npm audit --json`: completed with exit 1: 8 findings, 6 high and 2 moderate,
  zero critical. Reported packages: `@next/eslint-plugin-next`,
  `eslint-config-next`, `fast-glob`, `micromatch`, `braces`, `brace-expansion`,
  `@tailwindcss/typography`, `postcss-selector-parser`. A separate
  `npm audit --omit=dev --json` passed with zero findings, so the reported
  findings are in the development dependency graph. No force fix was run.
- Clean `npm ci`, followed by `npm run build`: passed in a disposable source copy
  excluding environment files, with an empty integration environment and only a
  public Cloudinary placeholder. Missing Redis/pepper warnings are expected.
  The first attempt using symlinked dependencies hit a Turbopack filesystem-root
  error; installing from the preserved lockfile resolved it. Original generated
  Next typings were untouched.
- Minimal GitHub Actions runs install, lint, typecheck, tests, build, and audit
  without service secrets. The full audit reports all findings as a nonblocking
  step; a separate production audit blocks high-severity findings. The eight
  development findings remain visible and require follow-up; no force downgrade
  or advisory exclusion was applied.

Tests compile actual modules and replace external Redis/framework I/O in memory;
client callback tests use mocked hooks, not a browser. The race fixture models
Redis's atomic eval contract but does not execute Lua. Live Redis/Upstash Lua
integration, browser rendering, hosted CI execution was not verified during the initial local-only pass.
Subsequent production build logs confirm Next.js 16.2.3 at deployment
`nguyen-trai-porfolio-8op7kspmr-khois-projects-8dd1e46a.vercel.app`, baseline commit
`29dcf480`, with the project configured for Node 24.x. Authorized read-only
Upstash checks returned PONG, confirmed an existing credential hash and
passwordHash field, and verified Lua EVAL/unpack support without data writes. Executing the actual
provisioning script through enforced read-only `EVAL_RO` returned 0 for the
existing key. The absent-key/concurrent write path still needs disposable-database
integration evidence. No local Redis server/CLI is installed. These limits must not be
interpreted as production approval.

## Production verification and recovery prerequisites

Human review was requested after local verification and the owner approved
pushing, merging, and deploying on 2026-10-12. An authorized
operator must complete the following separately; none are automated by M0A:

1. Identify the active deployment, release commit, build logs, install command,
   Node runtime, and lockfile hash. Read the packaged artifact's actual Next.js
   and React versions (for a Node artifact, use
   `node -p "require('next/package.json').version"` and corresponding React
   package checks). Match them to current vendor advisories. Do not infer the
   deployment from this checkout, package ranges, or response headers.
2. Preserve the current deployment artifact and securely back up the credential
   hash, session configuration, and content data using an approved operator
   procedure. Establish an owner identity and a tested restore/rollback path
   before provisioning or credential recovery. Do not expose hashes or secrets
   in review evidence. A rollback must retain containment rather than reopen
   public bootstrap.
3. Verify current administrator login and retain the existing auth pepper and
   Redis connection settings. Changing the pepper can invalidate existing
   IP-bound sessions. Provisioning must never be used to replace valid credentials.
4. Exercise the Lua command and concurrent provisioning against a dedicated
   disposable Redis/Upstash environment, including existing and partial records,
   before release. Confirm deployed Redis supports `EVAL` with this hash schema.
5. For a genuinely new installation only, configure the owner token securely,
   provision once over HTTPS, save the returned password, verify access, then
   disable provisioning. If the successful response is lost, retry returns 409:
   the generated password cannot be recovered. Stop and use an approved owner
   recovery process; never delete credential keys or reset content opportunistically.
6. If existing access is lost or a partial credential record exists, require a
   separately reviewed owner recovery operation, backup, and explicit approval.
   M0A intentionally provides no public reset endpoint or destructive recovery
   command. Verify administrator access after release and preserve media/content.

## Proposed follow-up issues

- **M0B: Deployment and dependency provenance.** Verify the live release and
  finalized advisory ranges, resolve the eight audit findings with reviewed
  compatible updates, align Next.js ESLint tooling, and continue tracking patched framework releases.
- **M0B: Recovery and integration evidence.** Test atomic provisioning on
  disposable Upstash, verify owner recovery/backup and lost-response procedures,
  add browser tests, and review trusted proxy IP handling and secret fallback
  behavior without silently invalidating sessions.
- **M1: Incremental auth module boundaries.** Separate credential provisioning,
  password verification, and session storage behind existing interfaces; expand
  route regression coverage while preserving Redis schemas and media references.
- **M1: Content repository reliability.** Address read-path initialization writes
  and concurrent content updates separately, with regression tests and an approved
  data recovery plan. No content persistence changes belong in this containment PR.
