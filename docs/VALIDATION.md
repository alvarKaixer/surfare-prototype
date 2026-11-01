# Research validation and claim scope

The Validation view is currently hidden from the shipped app; its source is preserved under `research/ui/`. It presents build-generated regression results, a held-out SMS classifier benchmark, the current local-only fallback, and an explicitly recorded live AI scenario run. These are different measurements and must not be combined into one accuracy claim.

## Current evidence

- The offline spam/ham model matches **838/860 labels (97.44%)**, with **92.29% balanced accuracy**, **98.25% precision** and **84.85% spam recall**. This measures the learned classifier, before the app's final safety policy. Its model hash matches the frozen benchmark coefficients.
- The current **local-only fallback** matches **112/860 labels (13.02%)** when every abstention counts as a miss: 739 outputs are unconfirmed, and 9 are wrong. Local non-matches deliberately do not certify benign meaning without AI. This is not the performance of the AI-enabled app.
- Regression pass counts come directly from the current Node test runner. Provider responses in these tests are mocked. A 100% regression pass rate does not mean 100% detection accuracy.
- The AI scenario file contains 12 authored English, Filipino and Taglish cases, balanced between threats and benign counterexamples. It is a live API check, not an independently sampled accuracy benchmark. Unavailable, incomplete, invalid and mismatching responses all count as misses. Free routing can use different models across cases.

The recorded AI run matched 10/12 expectations. One check returned no complete provider assessment; one was interrupted by a local development-server reload and returned HTTP 503. Both remain misses in the snapshot. This run does not establish 90% full-app accuracy or production uptime.

The earlier **94.19% final-assessment score** in `detection-benchmark.json` belongs to the pre-AI assessment policy. It is archived evidence, not a current app score. The dashboard does not display that historical pipeline score as current.

## Reproduction

```bash
npm run validation:report
# Start the local app separately before this explicit real-provider check:
npm run validation:ai
npm run build
```

`validation:report` runs every `tests/*.test.mjs` file and records runner counts, skipped/cancelled cases, groups, durations and a detection-code fingerprint in `.reports/validation/report.json`. The research command exits nonzero when a regression group fails; CI separately runs the complete test suite. This is an explicit research command, separate from production builds. Normal builds neither generate nor publish these reports.

If `.preview/datasets/prepared.json` is present, the script recomputes the spam model and current local-only pipeline on the frozen test partition. It neither trains the model nor adjusts rules. If the private development corpus is absent, only archived classifier metrics for an exactly matching model hash are available; the current local-only result is left unavailable. Public reports contain aggregate corpus statistics, not the raw corpus messages.

`validation:ai` sends the authored fixture in `tests/fixtures/semantic-smoke.json` through the running local assessment endpoint. It records the requested provider, actual model per result, exact expected and observed levels, unavailable cases, timings, suite hash and detection-code fingerprint in `.reports/validation/ai-smoke.json`. It consumes the configured provider's quota. It does not retry failures. The process exits nonzero if any case misses, while still saving all results. A detector change makes the prior AI score visibly stale until another full run is recorded. The inactive dashboard only reloads saved snapshots; it does not run providers or tests. Its reports must be explicitly served before that UI can be restored.

Historical snapshots remain in ignored local reports and are not deployment assets. Keep the local server stable during live checks. Do not build, modify its dependencies, or restart it during a run. Development interruptions must be retained and identified, rather than silently removed to improve a score.

## What would support a 90% full-app claim

Define the target population, task labels, severity policy and evaluation date before testing. Obtain a sufficiently large, independently labeled contemporary dataset with threats and benign counterexamples across supported languages. Preserve an untouched test partition. Measure the complete default pipeline, include unavailable results in the denominator, and report per-language results, recall, false alarms, abstentions and uncertainty alongside overall accuracy. OCR, QR interpretation, link reputation and image provenance require their own appropriately labeled evaluations.

The existing public datasets label **spam/ham**, not verified fraud or personal danger. The Philippine subset lacks per-message language labels. See the archived [detection report](DETECTION.md) for sources, licenses, checksums and the original split procedure.
