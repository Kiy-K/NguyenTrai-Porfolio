# Independent review

These reviews cover the original investigation at `9838e17`; the subsequent dependency/security review is recorded in [ci-followup.md](ci-followup.md).

Two independent review agents inspected the final diff against remote main `d5244614acc64bc53956aac7959802c20d433052`. Neither edited files or ran builds/browsers during scoring. They inspected the completed evidence after all 35 runs finished.

## Standards

**Pass; no blockers.** Independently parsed all 35 receipt/Lighthouse-report/trace triplets, matched raw LCP values, target revisions, complete cells and medians. Decode-sync is 15.64ms/0.58% better with 3/5 favorable pairs; fetch-high is 56.78ms/2.11% worse with 1/5. Both shipping gates are false. No app/dependency edits ship; deployment guard includes the exact draft branch.

Nonblocking findings addressed: the summarizer now rejects mixed animation state/settings and requires blocked-admin policy. Command/server logs are retained as normalized `.txt` and raw `.log.gz`. Generated next-env.d.ts and tsconfig.tsbuildinfo are excluded. Matrix HEAD validation still relies on the documented clean-target/build-manifest prerequisite; no dirty application source was scored.

## Spec

**Pass; no blockers.** Independently recomputed all 35 samples and paired deltas. All use patched Node 24.22.1, the same collector/replay hashes, CLS 0 and accessibility 100. Every scored sample retains its report and trace. Candidate geometry, preload reuse, optimized widths/bytes and observed-vs-simulated timings support the bounded negative conclusion. No unsupported client-boundary claim, layout manipulation, fallback removal or P4 change.

Earlier evidence gaps addressed: measured bundle accounting plus exact tool lockfiles/source hashes. Scored control identity remains e081fff; application/lockfile Git-blob equivalence to rebased remote main is explicit. Report-only satisfies issue #37's negative-result disposition.

Reviewers did not independently rerun measurements, tests, builds or browsers. Parent execution receipts record those gates. This review does not establish field/widget-on performance, live-provider behavior, production readiness or resolution of Next.js's advisory notice.
