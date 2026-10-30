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

## Saved cardio proposals: acceptance checklist — 2026-10-29

Additional scope: modality-specific intake, easy-session authoring and relative-cycle proposals that can be saved, reopened and archived. These are not activated or dated mesocycles. Do not install on the athlete's physical phone until the athlete asks for a functional rollout.

Use a separate test account for the following native checks. Automated component/repository tests cover the corresponding behavior, but do not establish real native layout or offline delivery acceptance.

1. Training → Cardio → Plan cardio: choose running, cycling or machines. Leave current comfortable duration unknown, then inspect the conservative full-session duration. Repeat with a smaller explicit current duration; include warm-up and cool-down in the total.
2. Review an eight- or ten-day cycle with the active strength context. Missing source rhythm requires explicit strength placements. Do not infer dates, weekly class placements or hours of separation. Review omitted requests and any demanding-work proximity warning, including the cycle boundary.
3. An empty proposal name or zero scheduled cardio sessions cannot be saved. Cancel before saving: no document is written. Enter a name and save once; repeated taps must not create duplicate proposal IDs.
4. Return to Cardio home, reopen the named saved proposal, then open a cardio session. The relative positions, exact durations, effort ranges and walking guidance must match the reviewed snapshot. It must say Saved proposal · not active and must not mark work as performed.
5. After initial reads, save while offline and restart the app. Confirm the saved proposal survives and its pending-sync label is visible until cloud confirmation. Restore connectivity. Simulate a later server rejection and verify error/retry remains visible even after a rollback snapshot.
6. Change the active strength routine or its current scheduling context separately. Reopen the saved proposal: show a review warning and preserve its original positions and prescriptions. Failed strength reads must not imply compatibility.
7. Archive: cancel confirmation first, then confirm. The proposal disappears from the normal list, but its document and prescription remain with an archive timestamp. Strength, sports and completed History remain unchanged.
8. During loading, failure, pending save or archive, switch accounts and retry. Old records, ABA closures and late navigation must never cross owner boundaries. Keep the draft after immediate write failure; avoid promising cloud success from local acceptance.
9. Check portrait layout, sheets, larger text, VoiceOver labels, both appearances, Android back and iOS cancellation. Reopening session details should not displace or duplicate the cycle content.

Still pending: dated coordination with fixed/improvised sports, activation, progressive multi-microcycle plans, cardio execution/history and live sensors/Watch. No runtime acceptance of those features is implied here.

## Functional easy foundation flow — 2026-10-29

This increment supersedes the proposal-only scope above for activation, finite date coordination and time/effort execution. Automatic progression/interval authoring, recurring-class expansion and sensors/Watch remain separate, not implemented capabilities of this delivery.

- Generate/save an easy proposal, choose a start date and 1–8 cycles, inspect the dated review and acknowledge unresolved context before activation. A known active block or uncertain/changed strength source must prevent a new activation.
- Check an eight-day cycle across DST and a fixed weekday sport appointment. Sport retains its real date; strength forecasts are labelled and do not overwrite assigned dates. Compare forced overlap and per-cycle availability/time/session/active-day flags before and after Find less conflicting days.
- Adjust a pending opportunity: move it, skip/restore it, or explicitly use a sport reservation/actual record. A reservation must never become completed cardio, a sport can be linked only once in a block, and removed/date-changed records must be flagged. Actual sport history is not duplicated.
- Start a session, pause, wait, resume, leave/reopen the screen and background it. Pauses must not count, transitions must not reset the clock, reaching target time alone must not complete a workout, and transition persistence must not require a server read. Missing native cache must block an uncertain replacement rather than overwrite progress.
- Start a different day's opportunity: require review of today's date/context and do not silently reschedule the block. Outside-horizon starts must not imply validated compatibility.
- Finish, confirm actual duration and optional session effort, save and return to Training. Common History contains only actual completed cardio. Correct the result while retaining its original finish time; discard requires confirmation. A shortened session shows its actual time, not the planned target beside a completed check.
- End a block after resolving active sessions. Actual history remains; pending work must not be marked completed. Simulate multiple devices producing simultaneous active blocks/sessions: expose the conflict and block new starts without silently deleting one.
- Test local pending writes, cache/read failures, immediate/delayed rejection, captured revision conflicts, concurrent taps and account/ABA/unmount boundaries. Simultaneous offline writes to one document are not transactional conflict resolution. Check real backend/offline behavior in a separate test account before claiming device acceptance of persistence.

The internal `cardio-check` route supplies fabricated data and an in-memory store to the production timeline and execution panel. Native checks through that route cannot establish Firestore sync, background phase audio, sensor accuracy or Watch behavior. Never create those synthetic records in the athlete's account or install on the physical iPhone during this implementation turn.

## Reviewed easy-duration progression — 2026-10-29

New activations use `REVIEWED_DURATION_V1`; saved legacy blocks remain frozen. This is duration-only progression, not interval authoring, sensor coaching or a complete hybrid-authoring rollout.

1. Activate a new block with headroom between current comfortable duration and available time. Compare per-cycle total minutes, confirmed/provisional labels and the adaptation repeat for unknown capacity. A full time budget must explain why no increase fits.
2. Open a provisional future opportunity. Until its preceding review is accepted, starting it must use the last confirmed dose, not the optimistic duration displayed in the forecast.
3. After the saved civil microcycle ends, review easy-session tolerance, recovery and discomfort. Before that boundary, during a running/paused session or with unreadable context, do not confirm a progression. Repeat with 8-/10-/31-day cycles and DST.
4. Full, compatible actual exposures and positive responses can propose at most one minute per session, within session/cycle ceilings. Missing effort stays unknown; a positive cycle-level answer does not fabricate per-session effort. Skipped, shortened, duplicated or sport-replaced exposures, difficult effort, unknown responses or symptoms must not authorize an increase.
5. Save a repeat or explicitly accept the proposed increase. Compare the next started session's detached prescription, segments and total with the confirmed dose. Actual history, dates, sports and legacy snapshots must remain unchanged.
6. Change a captured review's workout revision or block revision before acceptance. Reject the stale fingerprint/repository revision. Verify failed-save draft retention, pending-sync/rejection reporting, concurrent taps and owner/unmount guards on a separate test account. These are not cross-document transactions.
7. A next microcycle already started must not be rewritten. The last microcycle can save an evaluation without increasing a nonexistent next dose. Symptoms are not a medical-clearance result; repeating a plan does not instruct an athlete to train through pain.

`cardio-check` → **Preview completed cycle (fixture)** stages a fabricated completed cycle and production review in memory only. It cannot establish backend/offline or physical sensor acceptance.
