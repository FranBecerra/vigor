# Dated shared-capacity review — 2026-11-02

## Scope and limits

This is the dated-capacity prerequisite for joint dose allocation, not the allocation algorithm itself. At activation of a linked hybrid cardio proposal, show every dated cycle's estimated strength, forecast cardio, fixed planned/recorded activities and combined minutes against the saved shared budget. Reject an over-budget activation and per-workout ceiling violations rather than silently trimming either prescription. Existing non-hybrid activation is unchanged.

Respect civil cycles of 7–31 days and the block's IANA timezone. Partition sport intervals by elapsed overlap with local cycle boundaries, including midnight, fractional timezone offsets, DST and horizon edges. A recording supersedes its reservation; discarded/foreign activities do not count. A skipped cardio slot contributes no cardio minutes. A sport replacement counts the activity once, never both the reservation and prescription. This is time accounting, not physiological-equivalence or intensity inference.

The shared strength calendar resolver is reused by existing date coordination and the new budget review. Assigned strength replaces its original source-cycle forecast, including an assignment moved outside the horizon. Repeated strength-template estimates and provisional cardio growth remain explicitly labelled; complete strength horizon integration is still open. Unknown owned data is not silently zero load. Dates/source/activities/readiness changes invalidate the exact acknowledgement and stale activation callbacks. Failed writes preserve the reviewed draft and retry ID. Fixed leisure classes do not inherit the authored-workout duration ceiling.

No new schema, permission, account test record, Health query, infrastructure, physical install, commit or push is part of this increment. The existing repository's local-first/owner guards remain; this is not a serialized cross-device calendar-capacity transaction.

## Official references inspected before changes

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/).
- [React: avoid redundant derived-state effects](https://react.dev/learn/you-might-not-need-an-effect).
- [Intl.DateTimeFormat timezone/date parts](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat).

No new physiological programming rule is introduced, so no unsupported dose/intensity ratio is presented as evidence based.

## Acceptance

The production activation presentation is reused by a fabricated eight-day native fixture with memory-only stores. The scenario shows 130/100 minutes with a class, blocked activation, 70/100 after removing that synthetic reservation, renewed acknowledgement, an injected save failure and a stable retry. It must not call production account save hooks. Full-width rows and optional explanatory disclosure replace added pill navigation.

Final full regression passes **3,188 tests / 265 suites** in **167.076 seconds** (`/private/tmp/vigor-hybrid-capacity-accepted-tests.log`). `hybridCapacity` has **100% statements, branches, functions and lines** in that full-suite coverage run (`/private/tmp/vigor-hybrid-capacity-accepted-coverage`). TypeScript (`/private/tmp/vigor-hybrid-capacity-types.log`) and whitespace checks pass. No thresholds/timeouts are relaxed. Tests include 7/8/10/14/31-day cycles, midnight/DST/fractional offsets, partial horizon overlap, actual versus planned activity timing, missing/discarded/foreign/moved sport replacements, assigned strength moves, missing estimates, skipped/moved cardio, conditional future growth, limits, legacy activation and stale callbacks.

All unchanged date-coordination CPU budgets pass. The added dense shared-time case (248 days, 52 classes, 112 cardio and 248 strength entries) passes at p95 **4.77 ms** against a 50-ms budget (`/private/tmp/vigor-hybrid-capacity-performance-final.log`). These are synthetic CPU measurements, not native/physical responsiveness or physiological validation.

The initial sandboxed Xcode invocation cannot access simulator services and incorrectly reports the workspace unavailable. Retrying with access to Xcode's ordinary services succeeds: final Release build (`/private/tmp/vigor-hybrid-capacity-simulator-final.log`), strict deep signature verification and in-place simulator install pass. Device Hub on iPhone 18 Pro / iOS 27 opens the production app, then the local `cardio-check` route. The production activation panel with memory-only stores verifies four full-width cycle summaries, first-cycle 130/100 versus later 70/100, disabled activation even after acknowledgement, 70/100 after removing only the synthetic reservation, immediate acknowledgement reset, optional information disclosure, enabled activation after renewed confirmation, injected failure with the same review retained, successful retry and direct fixture return. No real proposal, activity, workout, Health record or permission is written. Native UI acceptance does not certify the real repository, device/OS matrix, physiological policy or physical-phone performance. No physical iPhone update is performed for this increment.
