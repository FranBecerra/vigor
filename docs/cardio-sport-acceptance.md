# Sport activity registry: acceptance checklist

Scope: the first manual activity registry, not a cardiovascular prescription generator or a live sensor recorder.

## Entry points

- Training → Cardio → Plan an activity / Record an activity.
- Training library → Activities → activity detail.
- Common History → completed activity → activity detail. Reservations are excluded.

## Manual runtime checks still required

Use a separate test account. Do not create synthetic records in an athlete's account or grant Health permissions for this checklist.

1. Plan a punctual padel class tomorrow. Change the sport and context, optional name, date/time and duration. Cancel: no document should be created.
2. Save the same class. Verify its date/time and Planned state in the activity list and Cardio home. It must not appear in completed History.
3. Open its detail and edit the reservation. Native date/time controls must remain readable in light/dark appearance and at larger text sizes. Canceling the picker must not change the date.
4. Record the class after its finish, entering a different actual duration and optional effort. Its original planned duration must remain visible; common History must contain one actual activity, not an additional completed reservation.
5. Record an unplanned football match. Leaving effort unanswered must not store zero or preselect an answer. Editing the record may add or clear effort with history-edit provenance.
6. Try a future actual record, a duration outside 1–1,440 minutes, an empty Other name and a cleared duration. Save must fail without losing the draft. A valid reservation may have a future date.
7. Reopen an actual record. It must offer Edit and red Discard, never convert it back to a planned activity. Cancel the discard confirmation, then confirm it. Discard hides the entry without physically deleting the aggregate or changing a strength routine.
8. Offline, create a new record after the collection has loaded. Local acceptance may return before cloud synchronization. Restore connectivity and verify synchronization. Do not describe pending acceptance as server confirmation.
9. Simulate immediate local write failure and later permission rejection. Verify error handling and draft retention before acceptance. After navigation/unmount, verify the list's server state; delivery of the original editor's error callback is intentionally lifetime-scoped, not a global notification service.
10. Switch accounts while a detail or draft is open and while an asynchronous save is pending. No previous-owner activity or draft may remain visible, and a stale editor must not navigate the new account after completion.
11. Edit the same record on another device before saving a captured draft. An already-observed revision mismatch must reject. Simultaneous offline edits are not an atomic conflict-resolution implementation and remain last-write-wins.
12. On both iOS and Android, check native date and time controls, preserved local clock time when changing only the date, keyboard interaction, scrolling and back/cancel navigation. Repeat with a device time-zone change and a date near a DST boundary.

## Verified automatically in this delivery

- Pure validation, planned/actual separation, original appointment retention, revision/effort provenance, recoverable discard and owner boundaries.
- Local repository acceptance/rejection and stale revision/account guards.
- Subscription replacement, unmount, ABA account changes, deterministic sorting and concurrent-save protection.
- Form staging, date selection, optional effort/clearing, rejected save retention, missing duration and duplicate taps.
- Planned/actual detail actions, confirmation, editing captured originals and mixed History navigation/filtering.
- Supported translation key/parameter parity; TypeScript; iOS JavaScript/Hermes export.

Native layout/device acceptance is not established by JavaScript tests or a successful bundle export. No sensor collection, Health import/export, recurrence, automatic substitution, schedule activation or Watch workflow is covered by this slice.
