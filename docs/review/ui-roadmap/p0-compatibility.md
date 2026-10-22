# P0 compatibility and review bases

Latest fetched main: `05638a4` (merged roadmap #29). There are no open P0 GitHub PRs at preparation time; `feat/search-minisearch` (`f79e574`) and `refactor/remove-ai-summary` (`b037912`) are preserved local branches.

The P0 branch-combination simulation reports documentation conflicts in exactly: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/architecture.md`, `docs/operations.md`, `docs/ui-roadmap.md`. No source conflict was reported. The existing combined P0 commit `97da608` already resolves these by keeping local search and removing only summary-specific UI/API/docs; AI title suggestions and shared provider dependencies are preserved. The review-only foundation uses that exact source plus the branch deployment guard.

`git merge-tree --write-tree --name-only review-admin-sections f79e574` and the same command against `b037912` both exit zero. They simulate combination without changing branches or working trees. The admin source can be reviewed on main independently of either P0 change.

P1 depends on the P0 foundation to keep its source diff and summary-free skeleton screenshots faithful. P3 depends on P1 and links the independent admin evidence. Do not merge the foundation by accident or duplicate P0 changes as new features; accept the canonical P0 work, retarget the drafts to updated main, resolve documentation wording as needed, and rerun integration checks first. No PR is merged or deploy performed in this handoff.

Original `perf/a11y-audit` remains exactly `b862a2f`; all original local changes/branches remain. Review-only Vercel config names five new review refs and sets only those false; it leaves main and runtime configuration unchanged. P4 remains evidence-gated.

## Current integration check — 2026-10-22

Main is now `cbf43ec`, containing P2 #31. The foundation is `6dd1149`, containing merged P1 #30 and P3 #32. `git merge-tree --write-tree origin/main origin/review-ui-p0-foundation` exits zero; the actual review-branch merge is conflict-free. Original pending P0 heads are preserved unchanged.

Merging `f79e574` into the combined review tree exits zero. Merging the standalone alternative P0b `b037912` still reports the same six documentation conflicts listed above, with no source conflict. Do not blindly merge that historical branch again: the combined source already contains its summary removals and resolved documentation. Review the P0a/P0b behaviors and tests as independent sections of the integration draft. There is no second removal or data migration to perform.

Only the darker focus-outline correction changes application source relative to `b862a2f`. Admin code exactly matches current main. The new exact review branch is also guarded against automatic Git deployments; main's deployment behavior is unchanged.
