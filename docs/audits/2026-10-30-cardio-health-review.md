# Voluntary cardio Health review — 2026-10-30

## Scope and evidence boundaries

Read-only, single-screen review of available workouts in the preceding 42 elapsed days. No workout import, changed dose, stored baseline, Health upload, new quantity read or physical iPhone deployment. Requests are user-initiated only. Recorded time and Health activity labels are not measured intensity or current tissue tolerance.

Official references checked before implementation:

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) and its Router reference.
- [Apple HKWorkout](https://developer.apple.com/documentation/healthkit/hkworkout): activity, active duration, workout-summary distance and component activities.
- [Health authorization](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data): read grants are not disclosed; empty data does not establish inactivity or denial. The iOS 27 limited-access API is availability-guarded and cannot establish full authorization when no earliest date is returned.
- Installed iOS 27 HealthKit headers corroborate the query/activity APIs and their deployment-target availability.

## Contracts exercised

- 1,000-record cap; truncation produces no automatic totals.
- Exact UUID duplicates; conflicting UUIDs; cross-source external identity only when measurements and classification match exactly.
- Unresolved positive-time overlaps excluded until source selection or explicit row exclusion; no automatic source-priority guess.
- Manual/mixed entries remain labelled and excluded from automatic totals; own Vigor exports are excluded.
- Missing distance is unknown. Summaries stay separate by actual activity classification, not a pooled running/cycling fitness assumption.
- No read/prompt on mount or foreground. Availability check and authorization are separate from grants. Background, blur, clear, unmount, account round trips and unresolved auth invalidate results/late callbacks.
- Initial row rendering is bounded to 20 entries; additional entries require Show more. Aggregation uses the complete validated result, not the visible page.
- Source/exclusion/new-read changes clear the ephemeral Finish review acknowledgement. No selection changes Health records or enters a saved plan.

## Automated/native verification

Focused pure review, native adapter and lifecycle hook have 100% statements, branches, functions and lines in `/private/tmp/vigor-cardio-health-coverage-final.log`. Component tests cover all visible lifecycle states, overlap/source selection, exclusions, acknowledgement, partial/empty/manual/mixed data and bounded row rendering. Four-language keys/interpolations and purpose-string retention are covered.

Final verification:

- Full regression: **2,906 tests / 250 suites**, 136.558 seconds (`/private/tmp/vigor-cardio-health-final-regression.log`).
- TypeScript passes (`/private/tmp/vigor-cardio-health-final-types.log`); whitespace checks pass.
- Scoped pure review/client/hook coverage: **100% statements, branches, functions and lines**; 51 tests / 4 suites (`/private/tmp/vigor-cardio-health-coverage-final.log`).
- Final focused UI/lifecycle/localization run: 12 tests / 3 suites (`/private/tmp/vigor-cardio-health-final-ui.log`).
- Final signed simulator Release: **BUILD SUCCEEDED**, including the HealthKit additions (`/private/tmp/vigor-cardio-health-acceptance-native.log`). Strict deep signature verification passes; the existing simulator installation is updated without resetting storage.
- Pure synthetic aggregation: 1,000 observations, 5 warm-up runs followed by 30 measured samples; p95 **1.73 ms**, maximum **1.80 ms** on this Mac (`/private/tmp/vigor-cardio-health-cpu.log`). This is not HealthKit query latency, native rendering or physical-device responsiveness.

## Device Hub scoped acceptance

Use the authenticated `cardio-health-check` fixture on the iPhone 18 Pro simulator. It injects a synthetic bridge into the production hook/panel. Connect/refresh buttons in that fixture **never** access Health or request real permissions.

Verified on iPhone 18 Pro / iOS 27 through native accessibility and representative screenshots:

1. Initial disclosure and explicit Connect appear with no automatic load.
2. Fabricated overlapping runs are excluded: initial running total is 1 session / 30 minutes, alongside cycling 1 / 20 minutes. Manual entries are labelled and excluded; the missing cycling distance is not rendered as zero.
3. Watch-only selection resolves overlap and produces running 2 / 60 minutes, cycling 1 / 20 minutes. Returning to all sources and unchecking Partner resolves the same overlap without deleting records.
4. Finish review displays the ephemeral acknowledgement. Changing source removes it. Read again restores the original selected rows/overlap; Clear returns to the initial disclosure.
5. Empty, failed read/retry, unavailable and truncated scenarios remain distinct. Truncation has no totals and disables Finish review. Error retry remains safely in the recoverable error state for the deliberately persistent failing fixture.
6. Fixture Back returns to Training. Production Cardio → review → Back retains Cardio; Settings → review → Back retains Settings. Neither production entry requests permission or reads Health before Connect; the production Connect is not pressed.
7. Exit Settings to Training/Cardio. No workout is started and no athlete setting, workout, Health record or permission is changed. The physical iPhone is untouched.

Coordinate scrolling returns `noWindowsAvailable` even while screenshots and semantic actions work. Rebinding recovers semantic controls, not the scroll gesture. Do not infer that the Mac is locked or claim physical-scroll/full long-list layout acceptance. Limited-access messaging, pagination and background/account races are covered by automated tests, not a real Health dataset or physical background-session test.

## Still open beyond this increment

Real authorized Health query acceptance on the athlete's device must be performed by the athlete after an explicitly requested deployment. Actual device query latency, broader OS/device testing and any history-to-planner transfer are not verified by fabricated data. A reviewed, provenance-preserving and explicitly consented baseline-transfer/privacy contract remains required before using Health-derived values in a saved plan. The existing starting heuristic is unchanged.
