# Finite recurring leisure activities — 2026-11-02

## Scope and implementation

Recurring appointments are a prerequisite for the unified hybrid calendar, not a new physiological programming rule. This increment adds explicit finite weekly/multiple-weekday/every-N-week/monthly planning, date/count preview, and independent occurrence edits/records/recoverable cancellation. It does not deliver bulk future-series edits, indefinite rolling expansion, the unified creator, sensor measurements or automatic cardio-equivalence decisions.

Use a single bounded schema-v2 private document for the whole series, with stable schema-v1 activity children. Native local-write acceptance queues one aggregate atomically; pending is not server-confirmed. Merge a single corrected child leaf so sibling actuals cannot be overwritten by a whole-parent save. Existing revision reads do not establish serializable same-occurrence conflict resolution across devices. Existing single activities remain unchanged; older binaries cannot read the new series schema.

Calendar policy preserves an IANA-zone local wall clock, skips nonexistent DST times, chooses the earlier future folded time and retains the exact selected anchor. Month days do not drift or roll over. Bounds are a required inclusive end within 366 civil days and 2–52 generated occurrences, with rejection rather than silent truncation. Upcoming cards exclude expired reservations without completing/deleting them.

## References checked before implementation

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/); retain the installed `@expo/ui/community/datetime-picker` IANA-zone contract. The versioned drop-in-reference URL was unavailable through the web tool; no package/API change was made.
- [React Native Firebase Firestore](https://rnfirebase.io/firestore/usage) and [Firestore nested writes](https://firebase.google.com/docs/firestore/manage-data/add-data): reuse native local persistence and merge one nested map rather than replacing sibling data.
- The supplied cardio research remains the physiological source; this slice adds scheduling only, with no new intensity, readiness or exercise-dose threshold.

## Verified acceptance

- Full final regression: **3,143 tests / 260 suites**, passing in 169.412 seconds. No threshold or timeout relaxation. An existing unrelated React missing-key console warning remains; it is not a failed test.
- Four scoped modules (`sportActivities`, `sportActivityRepository`, `sportActivitySeries`, `sportRecurrence`): **100% statements, branches, functions and lines** in the final full-suite coverage run. Cases include invalid owners/revisions/aggregate keys, rejected writes/retry, partial child merges, malformed calendars, DST gaps/folds, half-hour offsets, month boundaries and bounded expansion.
- TypeScript and `git diff --check` pass. Final simulator Release build succeeds; strict deep signature verification succeeds and the app is updated in place on the iPhone 18 Pro / iOS 27 simulator only.
- Device Hub: a synthetic two-week Tuesday/Thursday series previews nine appointments with the expected inclusive end. Expanding dates reveals the complete list. An injected first-save failure retains the draft and preview; retry saves nine activities in memory. Editing only the first occurrence to 75 minutes retains the nine-member series and exposes the explicit single-occurrence scope without repeat-authoring controls. Reopening verifies 75 minutes. Automated tests establish sibling-data preservation; the native summary does not expose all sibling durations.
- Final binary: monthly preview shows seven appointments from November 3, 2026 through May 3, 2027 at 22:00 Europe/Madrid, including the DST transition without wall-clock drift. Expanded dates and cancellation return to the memory-only fixture with no saved series. Startup succeeds. This is scoped semantic/visual acceptance, not physical scrolling or all-device acceptance.
- Host-only expansion sanity check: 52 weekly appointments in Europe/Madrid over 12 runs have a median of 3.00 ms and a maximum of 16.01 ms. This is not an iPhone latency guarantee. Expansion is memoized independently of unrelated notes/name input.

The fixture constructs synthetic series/edits only in memory and imports no activity repository or Health client. No real athlete appointment, Health record, permission, physical iPhone installation, infrastructure, commit or push is changed. Production account/cloud persistence, broad OS/device testing and physical performance remain separate acceptance work. Bulk this-and-future edits/cancellation, indefinite recurrence, rolling expansion, unified hybrid creation and measured sport-equivalence decisions are not delivered by this increment.
