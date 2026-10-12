# Neon migration execution ledger

- Owner approved the separate production phase, all persistent records including credentials, and inline implementation of spec/plan.
- M0A PR #14 merged as da757a9 and deployed with Next.js 16.4.0; live home/bootstrap/status checks returned 200/403/401.
- URL prerequisite resolved by owner. Read-only Neon metadata: neondb, neondb_owner, PostgreSQL 18.6; initial public tables empty.
- Source inventory: 31 products, one feedback record, one credential record. No source writes or protected export yet.
- Ruling: feedback_idx_v1 is Redis search metadata, not an omitted persistent record — exclude only this exact key/type — unexpected keys still block migration.
- Ruling: owner login follows unpause, because login can upgrade legacy hashes and is itself paused — before unpause verify exact credential equality and existing session compatibility — premature unpause remains a risk unless checks pass.
- Ruling: release-backend/tooling changes are committed together after the final review — avoids shipping incomplete cutover controls — review diff is larger.
- Red/green: unauthorized pause, backend selection/configuration, no fallback, atomic provisioning, preserving payloads, unknown source records, raw-PII rejection, locked imports, live pause marker.
- Real SQL regressions found and corrected modern/legacy duplicate precedence. Nine synthetic checks pass, including idempotence, conflict rollback, concurrent append, existing password compatibility, and atomic provisioning. Test schemas cleaned up; Redis untouched.
- Fresh review found legacy upgrade during pause, in-Git backup paths, and incomplete destination identity/schema checks. Regression tests reproduced each; shared pause check, resolved outside-Git backup enforcement, endpoint/database pinning and schema preflight now implemented.
- Ruling: deployment build emits only a destination fingerprint — Vercel sensitive URL exports are unusable, and endpoint/database identity must be proved without exposing credentials — fingerprints reveal no password or connection URL.
- Ruling: pooling suffix normalizes in fingerprints — direct/pooled transport can address the same Neon endpoint — endpoint changes still produce a different fingerprint.
- Unit suite: 34 passing after fixes. Lint/TypeScript, clean install, production build, and production dependency audit pass on Node 24.21.0 in the isolated release snapshot. Full audit retains six high/two moderate development findings.
- Reviewer confirmed all three fixes and found no new blockers. Canonical release lockfile adds only the approved Neon dependency to M0A.
- Pending: PR/CI, verified production pause, protected export/import, PostgreSQL cutover, live write/access verification and receipt.
