# Independent review notes

Two separate read-only reviews checked standards/correctness and issue34 spec/evidence coverage. They did not run competing benchmarks during measurement. No app runtime diff or conclusion-changing measurement bug was found.

Standards review verified runtime-error rejection, asset hashes/cache-miss failure, actual widget presence/absence, pinned target revisions, build-only generated dirt and bounded claims. It requested a checked-in animation-summary path; `summarize-matched.cjs <output> animation-off` now provides it.

Spec review verified the numeric tables, all28primary+10conditional runs, retained outlier and LCP limitation. It requested paired vectors promised by the protocol (now in primary summary), representative redacted traces, archive/reproduction instructions and completed functional check evidence; all are included.

The public browser check initially failed on an immediate body-scroll assertion after native dialog closure. It now waits for React's actual scroll restoration before asserting; both Escape and breakpoint cleanup remain checked, and the final public/search/admin rerun passes. The failed attempt is preserved. This is a harness timing correction, not an application fix or a hidden failed metric sample.

Remaining limits: small sample size, ambient desktop activity, frozen/uncompressed intercepted external responses, changed LCP candidate, live-widget and field uncertainty, Chromium only, untested live uploads/playback. No general release approval or resolution of the unrelated PR33 review backlog is asserted.

## PR35 correction review

Separate standards/spec rereads checked the complete numeric-plus-attribution predicate, all38 original-report timing restorations, explicit derived phase metadata, normalized admin-script byte accounting, precise tool pins, fresh-directory rejection, shallow-history fetch and patched-Node validation. No blocker remained after normalizing terminal whitespace. These reviews do not claim old prefetch execution disappeared from TBT, or that the isolated collector smoke is a replacement comparative matrix. The LCP gate and original archive retention remain explicit.
