# Frozen A/B follow-up (before variant builds/scoring)

The first primary traces show current 256w AVIF is 10,136 bytes, early and parser/preload-discovered; a representative observed breakdown is 14.8ms document TTFB + 12.7ms discovery delay + 31.8ms load + 407.2ms presentation delay. Decode Image itself is about 5.9ms wall-clock in that trace, not 407ms. These observations are NOT the simulated 2678ms LCP subparts. Both revisions already emit the portrait in SSR HTML despite the client fallback boundary.

Test two one-factor variants against unchanged current in a fresh phase:

1. `decode-sync`: add `decoding="sync"` to existing next/image. Tests browser presentation scheduling after early download, preserving client state, fallback, preload, sizes and geometry.
2. `fetch-high`: add `fetchPriority="high"` to existing next/image. Tests the Lighthouse-discovery hint (currently false), preserving the existing single preload. This is not legacy `priority` or an additional preload. Early current requests suggest a negative result is plausible.

No static import/format/width arm: current AVIF is already optimized to the smallest available >=192px width, identical actual portrait, and 10KB. No server-only arm: the image is already in initial HTML and removing the boundary would remove fallback. No geometry arm: changing candidate area would alter intended layout without evidence of a bottleneck. No animation arm: already investigated in #34; no new evidence warrants it.

Same frozen collector, tools, empty widget replay, warm optimizer, synthetic server, settings and metrics as primary. Five mobile plus two desktop per variant/current. Alternate target order each round; no tests/builds/installs during scores. Keep all samples/outliers. Apply primary thresholds (>=100ms and >=5% median, 4/5 favorable pairs, TBT <=+50ms, CLS0, no accessibility regression). Only a passing arm earns a separate confirmation block of five mobile/two desktop per control/winner, followed by frozen widget-on replay and functional/image-fallback gates. If no arm passes, report-only with all app variants rejected. Do not pool phases or continue searching variants speculatively.

Lighthouse teardown resets viewport, so `presentation.image` and `presentation.quotation` are post-audit snapshots and must NOT be used as mobile geometry/selection evidence. Use PerformanceObserver candidate rectangles, LCP insight rectangles, trace PaintImage/srcset/URL, ResourceTiming and CDP navigation requests for scored evidence. A separate fixed-viewport Playwright diagnostic will record settled image/quote geometry, currentSrc, fonts, preload reuse, no-JS rendering and fallback. CDP events after Lighthouse navigation are preserved but not counted as duplicate audit image requests.
