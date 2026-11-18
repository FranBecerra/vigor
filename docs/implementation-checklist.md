# Vigor delivery checklist

Updated: 2026-11-18. Product decisions live in PRD.md; this checklist tracks delivery, not a second specification.

Legend: `[x]` implemented and automated checks passing; `[ ]` open. Native acceptance is tracked separately and is never implied by unit tests.

## Development installation recovery — 2026-11-18

- [x] Diagnose the previous physical build's provisioning expiry on November 17 at 19:32 UTC. Renew app/widget provisioning with Xcode, build Release, verify the strict/deep signature and install over the existing iPhone 13 application. The new app profile expires November 25 at 08:33 UTC. Signed app entitlements match the renewed profile.
- [x] Athlete confirmed Vigor opens after the previous iOS developer trust error. Evidence is in `/private/tmp/vigor-nov18-renew-build.log`, `/private/tmp/vigor-nov18-install.log` and `/private/tmp/vigor-nov18-launch.log`.

## Priority order agreed 2026-11-17

1. **Joint hybrid generator — immediate priority.** Complete automatic priority-aware joint dose allocation, future strength prescriptions that account for cardio placement, coherent review and integrated activation. The goal is to keep the chosen strength/cardio priority and avoid unnecessary leg-running overlap while respecting the user's available sessions and time. Existing bounded joint proposal generation is a foundation, not completion.
2. **Measured cardio recording in the iPhone app.** Expand beyond the current duration-only timer/export so a Vigor-started session records actual timing and, when supported, distance and heart-rate data with source, units, sample times and coverage. Outdoor location, indoor equipment/manual entry, unavailable sensors and paused time need explicit behavior. Do not infer measured data from the prescription. Verify HealthKit write behavior for each supported metric and retain a truthful sensor-free path.
3. **Defer the Vigor watchOS companion.** Do not begin the companion app until the iPhone cardio flow and measurement quality are polished. Keep paired-watch start/control/mirroring as a later phase, separate from verifying that Apple Health imports a workout recorded by Apple Watch.

Before adding or materially changing cardio execution screens or menus, present three detailed Vigor-style image options and wait for the athlete's selection. The above priority order does not approve a new visual design.

### Joint hybrid generator — calendar priority

- [x] Use the selected priority to rank unavoidable adjacent running and lower-body sessions when coverage and overall overlap tie. Share the rule between relative calendar search and strength structure comparison, including the cycle boundary.
- [x] Verify both priority directions, coverage preservation, missing strength placements and the editor's priority handoff with automated tests. TypeScript and all 3,475 tests across 297 suites pass.
- [ ] Verify the priority-dependent preview on the simulator with the production editor.
- [ ] Complete joint dose allocation beyond frequency and calendar preferences, and integrate activation of the reviewed strength and cardio prescriptions.

### Hybrid hypertrophy dose and monthly cardio review

- [x] Evaluate hybrid hypertrophy frequency against one target dose, shared availability and room for cardio. Preserve explicitly chosen counts.
- [x] Prefer comparable stable pulls to unsupported barbell rows in hybrid hypertrophy generation.
- [x] Use 28-day history medians and repeated easy evidence to offer a second shorter session at the usual total dose.
- [x] Author and run a timed run/walk pattern for newly generated beginner sessions without an established duration.
- [x] Pass TypeScript, 3,499 automated tests across 298 suites, and the Release simulator build. The intermediate full-gym fixture fits its target in four 75-minute slots.
- [ ] Check new authoring and interval playback end to end in Device Hub. The simulator Release reached sign-in without an active account, blocking both flows. The session was closed. Evidence: `/private/tmp/vigor-dose-monthly-acceptance/`. Verify longer-term cardio tolerance with the existing microcycle review.

## Cardio export to Apple Health — 2026-11-17

- [x] Queue eligible iPhone timer workouts after saving in Vigor, with the existing write opt-in, modality and measured active time. Retry without duplicates and leave linked workouts in their original source. TypeScript and all 3,473 tests across 297 suites pass.
- [x] Verify the finish and save flow in Device Hub with a synthetic running session and 60 seconds of active time. Session closed. The simulator Release also builds with the new native Health bridge linked. Evidence: `/private/tmp/vigor-cardio-export-acceptance/`.
- [ ] Verify that a real timer-only cardio session appears in Apple Health on the physical iPhone after an in-place update. This confirms the current duration-only slice; it does not verify distance or heart-rate capture.

## Measured cardio execution — 2026-11-18

- [x] Connect new Vigor timer sessions on iOS 26+ to HealthKit workout collection when export is enabled. Preserve time-only operation if the bridge, write consent, or measurements are unavailable.
- [x] Queue the native measured workout under the existing stable export identity. Store only validated, optional distance/pulse summaries and collection bounds in the device-local export journal.
- [x] Pass TypeScript, 3,488 automated tests across 298 suites, and the Release simulator build.
- [ ] Repeat the timer interaction in Device Hub on an authenticated simulator. The Release opens, but the auth gate redirects the in-memory fixture to sign-in even with the local-checks flag. The Device Hub session was closed. Evidence: `/private/tmp/vigor-cardio-capture-acceptance-20261118/`.
- [ ] Verify a real running workout and paired heart-rate sensor on the physical iPhone, including lock, pause/resume, missing readings and one Health workout on retry.
- [ ] Review live and completed metrics designs, then show available readings in Vigor. Add explicit gap/coverage details, manual indoor distance and native recovery across process termination.

## Relative Training agenda — 2026-11-12

- [x] Replace the dated/undated split with a single sequence of strength, cardio and rest. Advance Up next after completion, skip or a deliberate reorder, and retain actual and appointment dates.
- [x] Restore direct rest check/uncheck in the agenda, scoped to the current microcycle and with save failure rollback.
- [x] Pass 3,444 tests across 297 suites and TypeScript. Device Hub confirms one sequence with Up next and the progress rail on the normal Training home. The in-memory fixture verifies rest check/uncheck and reordering strength past cardio with the marker following the new order. Device Hub session closed. Evidence: `/private/tmp/vigor-relative-agenda-final-acceptance/acceptance.md`.
- [x] Use the selected Hold and drag interaction, Start and Skip in the session preview, strength row tint, Add rest in the agenda and common routine actions. Document persistence and archive behavior in the PRD.
- [x] Pass 3,451 tests across 297 suites and TypeScript. On the iPhone simulator, reorder strength, cardio and rest with the continuous hold gesture, verify the Up next marker, open the cardio actions, add and check/uncheck rest, and link a synthetic Health workout. On the normal Training home, verify the progress rail, common strength routine actions and cancellable deletion. Device Hub session closed. Evidence: `/private/tmp/vigor-hold-drag-acceptance/`.

- [x] Offer compatible Health workouts recorded before the cardio block began when they fall within the existing read window. Preserve their actual dates and distinguish read failures from an empty selection.
- [x] Protect the agenda prefix through Up next from upward moves. Retain the agenda viewport when reordering changes the upper workout card.
- [x] Pass 3,453 tests and TypeScript. Device Hub verifies the protected drag boundary, moving the current session down, and a synthetic run recorded four days before the block linked with its actual date. The mixed-plan landing scroll anchor still needs native acceptance. Evidence: `/private/tmp/vigor-agenda-followup-acceptance/`.
- [ ] Deferred: build the Vigor watchOS companion after iPhone cardio capture is polished. Then verify start, reconnect, finish, measured data and duplicate prevention on a physical pair.

- [x] Save a rest check against the agenda’s displayed microcycle when the stored index lags, with a rest-specific alert and rollback for invalid entries. Read only the current Monday-based week when linking cardio. All 3,455 tests and TypeScript pass. Device Hub confirms rest toggling and links a synthetic Monday run from Friday with its original date. Evidence: `/private/tmp/vigor-week-rest-acceptance/`.

- [x] Let completed cardio and rest rows cross Up next without changing their recorded date or check. Keep pending workouts behind the current next session. Test that linking the last pending run reveals existing opportunities in the next cardio microcycle. All 3,457 tests and TypeScript pass. Device Hub verifies both directions for a linked run and a checked rest, plus the pending-workout boundary. Evidence: `/private/tmp/vigor-agenda-recorded-acceptance/`.

- [x] Keep future cardio cycles out of the agenda until their start. A seven-day plan with one completed run this week waits until next Monday. Swipe left to delete added rests or hide one planned occurrence. Full regression passes 3,460 tests and TypeScript. Device Hub verifies trash tap, full swipe, rest checking and no future cardio rows after resolving both current occurrences. Evidence: `/private/tmp/vigor-agenda-week-gate-acceptance/`.

- [x] Preview cardio dated for tomorrow when its next cycle opens then, replacing the completed cardio of the preceding cycle and keeping Up next on an eligible workout. Test the November 15–16 weekly rollover and preserve the gate for plans more than a day ahead. Full regression passes 3,461 tests and TypeScript. Device Hub confirms one Monday cardio preview and the strength Up next marker in the Sunday fixture. Evidence: `/private/tmp/vigor-tomorrow-acceptance/`.

- [x] Keep adjusted cardio in its original cycle tab across nominal date boundaries. Merge due cardio by agreed strength forecast anchors and allow local agenda reorder. Reproduce November 17 → 16 with the prior run recorded November 9. TypeScript and 3,464 tests pass. Device Hub confirms the adjusted run in the agenda and Cardio Cycle 2, and the completed result in Cycle 1. Evidence: `/private/tmp/vigor-cycle-move-acceptance/`.

- [x] Keep one microcycle per routine in the agenda. Retain an early completion in its own cycle, keep linked equal-duration cardio visible while strength is pending, and separate plans of different durations. Regression covers the completed November 16 run with the November 9 result still available in history. All 3,467 tests across 297 suites and TypeScript pass.
- [x] Verify the shared agenda in Device Hub with synthetic data. After advancing and finishing the November 16 run, the agenda shows only that completed run and returns Up next to strength. Evidence: `/private/tmp/vigor-onecycle-acceptance/`.

## Shared Training agenda — 2026-11-12

- [x] Implement the selected Grouped days direction with one agenda, distinct routine identities, compact active plan shortcuts, and an Unscheduled group.
- [x] Restore the original segmented progress rails under Active routines, with direct navigation to the strength mesocycle and the current cardio microcycle. Full regression passes 3,442 tests across 296 suites. Device Hub confirms the strength rail, direct entry and return with the shared agenda intact. The cardio route is covered by component tests. Device Hub session closed.
- [x] Confirm a new date from the selected pending strength or cardio row, preserving the prescription and stable occurrence.
- [x] Link an explicitly selected Apple Health activity as a finished cardio workout, with atomic duplicate protection, measured date and duration, and unlinking in the existing workout detail.
- [x] Pass full regression (3,441 tests across 296 suites), TypeScript and whitespace checks. The subsequent inactive-only empty-state correction passes all seven Training home tests. Verify the grouped landing, both date changes, the Health chooser and duplicate exclusion on a signed iPhone simulator Release with in-memory records. Evidence: `/private/tmp/vigor-grouped-agenda-acceptance/`.
- [ ] Verify a real Apple Watch-recorded workout can be reviewed/linked on the physical iPhone. This is Health import/link acceptance, not acceptance of a Vigor watchOS companion.

## Training landing feedback — 2026-11-12

- [x] Keep routine cards independently expanded to prevent the previous card from collapsing when another opens.
- [x] Reuse the cardio date editor from a pending session's long press and VoiceOver action in the routine and shared calendar. Regression covers the date selection, locked sessions and calendar placement.
- [x] Pass full regression (3,427 tests in 293 suites), TypeScript, and a simulator Release build. Device Hub confirms that opening the second routine keeps the first in place and that selecting a new date updates both the shared calendar and the cardio card using the same memory-only session.

## Cardio and routine feedback — 2026-11-10

- [x] Show the cardio microcycle review only after the reviewed cycle's civil end date; remove "How progression works"; show a single total when the dose is unchanged. Focused progression, cardio flow and i18n checks pass 68 tests; TypeScript passes.
- [x] Verify the review timing in Device Hub and pass full regression: **3,424 tests / 293 suites**, TypeScript and whitespace checks, signed simulator Release. On iPhone 18 Pro / iOS 27, a new memory-only "Preview just-activated block" fixture shows cycle 1 without a review card. The completed-cycle fixture shows the card; its sheet has no explanation control, reads "40 min" with Keep enabled before answers, and "40 → 42 min" with Confirm increase enabled after positive answers. Nothing was saved; Device Hub sessions closed.
- [x] Add shared Activate/Edit/Delete actions for strength routines, ended cardio blocks and saved cardio proposals. Cardio blocks archive to preserve history. Verified in the simulator with a cancellation-safe deletion confirmation.
- [ ] Selectable identity icon for cardio routines, reusing the strength emoji identity sheet. Needs approved visual options.
- [ ] Present and manage a hybrid plan as one routine instead of a strength routine plus a separate saved cardio proposal. Needs approved visual options and depends on integrated activation.
- [ ] Decide whether a review can still record "keep the current dose" after the next cardio microcycle has started. Today that review stays blocked for the rest of the block.

## Cardio landing cohesion — 2026-11-10

- [x] Apply the clarified single-landing direction: remove Strength/Cardio gating, retain active/ended cardio and saved proposals in the shared surface, and preserve Health/activity/creation access.
- [x] Verify the clarified landing in Device Hub on iPhone 18 Pro / iOS 27. The signed simulator build opens Training without the discipline selector. Both Activities and Cardio history from Health return directly to the prior library scroll position. Populated calendar evidence uses the prior in-memory fixture. Device Hub session closed. Evidence: `/private/tmp/vigor-unified-training-acceptance/acceptance.md`.

- [x] Refine the requested unified trial to show the whole cycle, preserve independent progression rails and demonstrate the existing strength mesocycle view with direct return. Design approval remains pending.

- [x] Explore one unified agenda on explicit request: actionable current session without a duplicate agenda row, compact upcoming work and independent strength/cardio block positions. This is a proposal, not implemented or approved production behavior.

- [x] Audit the real Training → Cardio landing and its strength sibling in Device Hub, in light appearance; restore the original domain/appearance and close the session.
- [x] Prepare three app-scale alternatives using Vigor Subtle tokens and captured native header/selector/tab controls, with identical illustrative block content and an optional empty-state preview.
- [x] Athlete rejects the unified redesigns and selects the existing Strength surface: add active cardio routine cards and interleave sessions in its existing calendar.
- [x] Implement owner-scoped active cardio cards, independent progress rails, exact-cycle previews and guarded calendar projection; preserve strength/rest IDs and persistence.
- [x] Complete automated and native acceptance: full production-source regression 3,416 tests / 293 suites; four additional cycle-route cases pass in the 20-test cardio flow suite. New pure projection coverage is 100%; TypeScript/whitespace and signed simulator Release pass. Device Hub verifies the interleaved calendar, shared accordion, preview/return and synthetic completion. Session closed; no physical update or real data writes. Audit: `docs/audits/2026-11-10-cardio-home-integration.md`.

## Training feedback — 2026-11-09

- [x] Editing cohesion: athlete selected Como en las sesiones; shared upper Edit/Back/Cancel/Save actions now serve mesocycle, session and history entry points. Recorded-edit actions precede the selectors, matching planned edits.
- [x] Editing access: expose an explicit action for the selected unperformed microcycle/session as well as recorded executions, retaining exact cycle/session context and return navigation. Focused coverage also protects standalone unsaved cancellation and a single upper save row.
- [x] Editing cohesion acceptance: 3,402 tests / 291 suites, TypeScript, whitespace checks and signed simulator Release pass. Device Hub verifies future entry/return and the recorded editor's shared upper actions and synthetic save.

Shared editing actions verification — 2026-11-10: focused editor/navigation coverage passes 40 tests across five suites; full regression passes 3,402 tests. Tests verify a future mesocycle's explicit Edit action carries its exact cycle/session, the global-history Edit entry precedes details, recorded Save/Cancel precedes the supplied selector with only one Save, standalone unsaved cancellation confirms before closing, and existing save failure/retry, identity protection and return behavior. Device Hub on iPhone 18 Pro / iOS 27 confirms selected M2 → Edit session → Microcycle 2/6, upper actions without overlap, Cancel retaining the session/M2 view, and Back returning directly to the mesocycle with M2 selected. The existing recorded-edit memory fixture confirms one upper Save before selectors, an unsaved-cancellation alert, and a successful synthetic repetition correction/save without a stale dirty alert. Real global history is empty on this simulator; its Edit-entry position and routing are covered by component tests. Evidence: `/private/tmp/vigor-editor-actions-acceptance/`. The Device Hub session was explicitly closed. No real workout data or physical iPhone was modified.

- [x] Use the existing Today card to resume an unfinished workout, with its actual session identity and route. Component tests verify the Home route; native checks verify the reused card and its callback.
- [x] Health permission report resolved by the athlete. Withdraw this feedback iteration's Health changes at their request.
- [x] Select Continuous history ("Historial seguido") and implement the live-workout Info timeline, reusing actual-set rows and existing workout history data.
- [x] Native acceptance of Continuous history: verify chronological executions, scrolling to exercise information, closing to the unchanged synthetic workout and reopening a different exercise at the top in Device Hub on iPhone 18 Pro / iOS 27.
- [x] Limit progression review to changed microcycles, exercises and values while preserving the full reviewed save payload.
- [x] Repair Review microcycle entry and cover the real prompt, loading dialog and questionnaire transition with regression and native checks.
- [x] Repair the RIR replanning discrepancy: retain untouched deload rows while reanchoring edited sets, with shared source-row pairing across warmups and removed top singles. Regression reproduces the former RIR 4 → 3 side effect.
- [x] Verify the corrected changed-only RIR preview in Device Hub and pass full regression: 3,399 tests / 291 suites, TypeScript and whitespace checks.

Selective deload replanning verification — 2026-11-10: the regression first reproduced an untouched deload row changing from RIR 4 to 3. Focused prescription/replanning checks pass 23 tests, including interleaved warmups, removed top singles, early/later anchors, strength/hypertrophy, existing deload overrides, structural edits and input immutability. A signed incremental Release on iPhone 18 Pro / iOS 27 verifies a single anchor edit from 2/2/2 to 3/2/2: only Series 1 appears in the changed-value preview (microcycles 1–3: 2 → 3; 4–5: 1 → 2). Scrolling to the end confirms no spurious Microcycle 6/deload, Series 2/3 or 4 → 3 entry. Cancel returns to the edited prescription. The DeviceInteraction session was explicitly closed. Evidence and source/bundle fingerprints: `/private/tmp/vigor-rir-selective-acceptance/`. The check used the memory-only fixture; no physical iPhone installation or real training-data write.

Earlier feedback verification: **3,392 tests / 289 suites**, TypeScript and signed simulator Release passed before the Health withdrawal and Continuous history implementation. Device Hub verified delayed survey loading, close/reopen, retained answers after a synthetic failed save, retry, changed-only progression and cancellation, plus Resume presentation/callback. Fixtures are memory-only and the device session was closed. Info proposals reused the exact captured ExerciseDetailSheet header, footer and anatomical illustration.

Continuous history verification — 2026-11-10: **3,396 tests / 291 suites** pass after withdrawing the reported Health changes. TypeScript and whitespace checks pass. New coverage verifies actual values, cross-routine chronology, current-workout exclusion, owner isolation, corrections/discards, unfinished/future/invalid records, custom time/level recording, warmups/partials/advanced segments, empty/unavailable states, note isolation and exercise changes. A real Session route component test opens each exercise's Info sheet and closes directly without replacing or dismissing the workout route. The signed simulator Release build passes with Xcode 27. Device Hub verifies the production Info component in the memory-only workout fixture: 7 Nov before 3 Nov, session labels, actual warmups/work sets/load/repetitions/RIR, scroll to anatomy/equipment, Done returning to the same unchanged workout (0/14), and a second exercise opening at the top. No Info overlap or clipping was observed. Evidence: `/private/tmp/vigor-info-history-acceptance/24-info-open`, `25-info-scrolled`, `26-close-info`, `29-second-info` and `30-second-close` (PNG and hierarchy TXT). The fixture's crowded workout viewport clips its action hit area; this is a fixture limitation, not a verified defect in the production workout layout. Keep one persistent MCP bridge for Start/Synthesize/End: ending the client between calls invalidates the device session. The final device session was explicitly closed. No physical device or Health data was changed in this increment.

## Continuity foundation and Apple Health — 2026-11-06

- [x] Classify completion, skips, pending occurrences, unfinished drafts and conflicting records in a pure closure review.
- [x] Preview a fixed-dose successor under the same strength routine and derive initial comparable performance evidence from recorded history.
- [x] Implement selected Option B: review and preparation under the same active strength routine, with atomic activation and idempotent retries.
- [x] Open the existing balance after Done on the final saved strength workout, with server revalidation and a safe Training fallback.
- [x] Show comparable performance across recent blocks. Retire the optional rep floor increase and preserve the full authored range at continuation.
- [ ] Define evidence and prescription precedence for reviewing next-block dose and effort progression, optional load suggestions and linked hybrid continuity.
- [x] Automatically export the exact accepted strength workout when enabled. Remove the export action from the finish summary and recover eligible failed export attempts and interrupted journals.
- [ ] Confirm workout-write permission and receipt on a physical iPhone.

Option B verification: 3,356 tests across 285 suites, TypeScript and simulator Release build passed. Device Hub verified balance, duration, opt-in reps and retention after a simulated save failure, followed by a successful retry. The test used a memory-only fixture. Server writes were exercised at the mocked transaction boundary. Physical-device and real-account acceptance remain open. The automatic entry follow-up passed the simulator Release build and Device Hub memory-only checks for both a regular and the final workout, including cancellation.

## Strategic roadmap — 2026-11-06

- [x] Audit current programming, history consumers, manual/automatic parity and mesocycle lifecycle. Findings: `docs/audits/2026-11-06-strategic-product-review.md`. PRD §1 is the active product roadmap.
- [x] P0: Add lifecycle, provenance, edit/skip and persistence regression cases before adaptive plan writes. Added explicit fail-closed cases for invalid/future skips and inactive blocks, plus owner/block provenance isolation; existing tests cover edited history invalidation, stale reviews, retries, drafts and account switches.
- [x] P1: Deliver a reviewed successor for an existing routine with optional progression and recoverable save. Device Hub and automated acceptance are recorded above; physical receipt remains open.
- [x] P2 strength foundation: Consolidate comparable performance, per-microcycle adherence, muscle dose, reported session effort and matched recovery/discomfort feedback. Dated schedules support seven-day-equivalent dose; undated cycles retain raw counts and observed event bounds.
- [x] P3 decision foundation: Resolve planned versus paired RIR, separate planned deloads, and combine performed dose, recovery and comparable accumulation performance into a read-only next-block review.
- [x] P3 presentation: Block comparison selected, implemented and verified with one brief inline detail and no muscle list.
- [x] P3 continuity correction: Preserve automatic RIR progression and the final deload when continuing a block. Automated and native acceptance complete.
- [ ] P3 follow-up: Define evidence gates for optional numeric adjustments and exercise load suggestions. Preserve the full repetition range under the prescribed RIR.
- [ ] P4: Extend longitudinal review and continuity to integrated hybrid programming.

P0 regression follow-up: focused continuity, repository and automatic-entry suites pass **18 tests / 3 suites**. Full regression passes **3,366 tests / 286 suites** with `--silent`; `npx tsc --noEmit` passes. The ordinary Jest invocation also ran all assertions successfully but exits nonzero because Expo's native JS logger emits an asynchronous warning after tests finish. Simulator/device behavior is unchanged by this test-only increment.

P2 strength increment verification. Focused continuity checks pass **23 tests / 4 suites**. Full regression passes **3,369 tests / 286 suites** with `--silent`. TypeScript passes.

P2 muscle dose and feedback verification. Focused checks pass **57 tests / 5 suites**. Full regression passes **3,371 tests / 286 suites** with `--silent`. TypeScript and whitespace checks pass.

Historical verification for the retired P3 repetition adjustment. The increment passed **3,373 tests / 286 suites**, TypeScript and a signed Release build. Device Hub verified the earlier opt-in and synthetic save retry on iPhone 18 Pro simulator.

Repetition range preservation verification. Focused continuity checks pass **26 tests / 4 suites**. Full regression passes **3,372 tests / 286 suites** with `--silent`. TypeScript and whitespace checks pass. Repository tests cover the unchanged successor, rejection of obsolete adjustment requests and exact retries of committed legacy receipts. Device Hub verifies observed progress, the preparation screen after retiring the rep control, and synthetic failure/retry in the signed iPhone 18 Pro simulator build.

P3 decision foundation verification. Focused continuity, prescription and runtime checks pass **30 tests / 3 suites**. Full regression passes **3,376 tests / 286 suites** with `--silent`, and TypeScript passes. The new assessment is read-only and has no new presentation.

P3 block comparison verification. Full regression passes **3,377 tests / 286 suites** with `--silent`, and TypeScript passes. A signed Release build on the iPhone 18 Pro simulator verifies missing effort, repeated harder effort and poor recovery, one inline detail at a time, collapse, and navigation to preparation and back. Device Hub session closed.

2026-11-09 automatic continuity regression. Full regression passes **3,384 tests / 286 suites** with `--silent`, and TypeScript passes. Tests cover explicit and legacy automatic modes, hypertrophy and role-based strength progression, horizon changes, a single loading cycle, manual fixed prescriptions, retained RIR pins and idempotent persistence after a lost response. Signed Release and Device Hub checks on the iPhone 18 Pro simulator verify automatic multi-cycle and single-cycle explanations, the deload label, duration controls, return/cancel, fixed manual explanation and synthetic save failure/retry. Device Hub session closed.

## Hybrid authoring and cardio feedback — 2026-11-05

- [x] Distinguish available days from recommended sessions. Seed the automatic strength allocation by experience and provide Decide for me there.
- [x] Keep priority rows stable, remove the priority wand and redundant selection caption, restore the Cardio heart and show working sets in combined review.
- [x] Infer a repeatable duration from eligible recent history, prefer supported low-zone outings when available, and keep reviewed duration consistent with Decide for me.
- [x] Save only the chosen prescription and remove the separate summary consent control.
- [x] 3,337 tests across 282 suites, TypeScript and the signed iOS simulator Release build pass. Device Hub confirms the grouped selector, stable priority rows and the unrestricted availability summary (six available days and a three-strength/two-cardio proposal in the tested case).
- [ ] Confirm actual iPhone history and HealthKit zone availability with the athlete's data.

## Hybrid intake and cardio history — 2026-11-05

- [x] Implement the approved Grouped list entry with Hybrid, Strength and Cardio, a separate creation-method group and four working routes: three automatic builders and manual Strength. 3,319 tests across 279 suites, TypeScript and the simulator Release build pass. Device Hub verified the Strength Manual and Cardio Automatic routes and selection retention on return.
- [x] Athlete selects C, Session by phase. Manual Cardio and Hybrid use the same authoring UI for warmup, main and cooldown targets. All six discipline/method combinations route to working builders.
- [x] Persist manual cardio prescriptions through review, activation and workout execution. Preserve phase state across pause and resume and keep manual prescriptions out of automatic progression. 3,335 tests across 282 suites, TypeScript and the iOS simulator Release build pass.
- [x] Device Hub verifies Cardio Manual entry, phase fields, an authored 24-minute main phase in cycle review, and retention when returning to the editor. The keyboard adjustment was inspected separately.
- [ ] Verify Manual Hybrid end to end on a device and connect live sensors to manual workout targets.
- [x] Focused steps selected, implemented and verified through Priority, Availability, Cardio and the unchanged Review and Save in Device Hub. The isolated simulator fixture used fabricated history and the session was closed.
- [x] Use the shared availability recommendation in both automatic builders. Preserve explicit cardio frequency and applied Health starting points.
- [ ] Add a single profile-aware split override and evaluate opt-in scheduling beyond seven days.
- [ ] Health reuse implemented with per-owner and per-modality device consent; verify on a physical iPhone.
- [ ] Workout review shows available average running pace and associated heart rate; verify real Health data on a physical iPhone. Time-in-zone and effort-aware dosing remain open.
- [x] Automated delivery checks for Focused steps and Health reuse: 3,318 tests across 279 suites, TypeScript, plist validation, whitespace and signed iOS simulator Release.
- [x] Verify fragment-aware starting-dose estimation, including split runs, separate outings and window boundaries. Jest passes 3,312 tests in 278 suites.

## Authoring feedback and design approval — 2026-11-04

- [x] Record explain-first and three-image-option approval workflow in AGENTS.md and PRD.md.
- [x] Replace rejected generic concept boards with three detailed product-token creation-entry proposals: Cards, Grouped list and Expandable choice.
- [x] Athlete selects Grouped list for the creation entry. Convergence is the subsequently selected hybrid symbol.
- [x] Complete manual Hybrid and Cardio with the selected phase editor. See the later increment above.
- [x] Athlete selects Convergence for hybrid and Sections for the cardio form, with a prominent Decide for me wand action.
- [x] Implement the approved complete Sections cardio setup, one fixed review action, plain shared steppers, controlled experience choices and draft/history retention. 3,305 tests / 278 suites, TypeScript, whitespace and signed simulator Release pass; scoped native acceptance and remaining replay are recorded separately.
- [ ] Shared strength/cardio athlete intake remains open.
- [x] Implement convergence in the existing hybrid entry and one visible wand recommendation row throughout current cardio setup; keep explicit values until recommendation is invoked. 3,302 tests / 277 suites, TypeScript, signed simulator build and native wand navigation/cancellation pass.
- [ ] Native visual acceptance of convergence in the entry and the grouped entry remain open. Device Hub verifies Sections scrolling, the wand, the fixed review action and retention of two cycling sessions at a 35-minute ceiling after returning from preview.
- [ ] P0 native acceptance: preview/configure/swap/reroll coherence. React-owned page visibility and pending-task cancellation are implemented with regression coverage; final native replay remains open.
- [ ] P0 native/physical acceptance: recent cardio. Creation-route Health review retention is implemented with automated close/reopen, owner, stale-callback and background safety coverage. Apply discoverability and the athlete’s installed behavior remain to verify.
- [x] Harden the existing mounted strength/cardio return: keep authored cardio, invalidate accepted calendar and reject late prepare/exit/review callbacks by owning phase/source/settings. Complete direct-edit UI is still open.
- [x] Athlete selects Visible stages with the Compact progress footer edit rows and icons. Future visual comparisons include a preferred option and rationale.
- [x] Edit the visible strength prescription directly from combined review, retain cardio inputs and require fresh calendar review before saving.
- [x] P1: approved program-type-first entry and both creation modes for each discipline.
- [ ] P1: experience/history first, clear priority meaning and Decide for me across the flow.
- [x] Show four whole-program stages during hybrid setup, strength, cardio and review.
- [x] P1: approved cohesive Sections cardio form, reusing strength controls and avoiding the intermediate setup steps. Native boundaries are tracked above.
- [ ] P2: approved smaller emphasis tiles with higher cost marker and preserved accessibility.
- [ ] P2: redesign equipment illustrations through a separate three-option review.
- [x] Inspect completed mesocycle RIR provenance: history-backed actual rows; missing RIR is a dash, pending work is planned. Code inspection only in this documentation increment.

Authoring follow-up verification: **3,300 tests / 277 suites**, TypeScript, whitespace and signed simulator Release pass. Native synthetic-history navigation/read/return is checked; generation swap/reroll and production Health-retention native acceptance remain open. Detailed boundaries: `docs/audits/2026-11-04-authoring-feedback.md`. No physical installation.

## Current priority: Training, not further Bio expansion — 2026-11-03

- [x] Remove the completed-exercise decorative tick; retain the accent completion state and accessible hint. This supersedes the older tint/check item below.
- [x] Compact the emphasis grid, retaining the large-font/small-width single-column fallback.
- [x] Derive untouched default routine names from the actual presented focus roster, including mixed counts; retain explicit names and #N uniqueness.
- [x] Use a declared current comfortable 40-minute cardio duration despite NEW status; seed untouched limits once and preserve subsequent manual edits. This is not automatic history review.
- [x] Search relative strength-day alternatives in new hybrid proposals, preserving roster/doses/order and prioritizing coverage/proximity before avoiding long circular active streaks. Preserve manual placements unless redistribution is explicitly requested; cancel stale results on exit/source/availability changes.
- [x] One availability form for newly authored hybrids: cycle/training days and minutes per separate workout, with optional doubles. Two 60-minute slots mean up to 60 each, not 60 minutes total/day. Embedded strength/cardio reuse these limits; legacy saved totals keep their meaning. Final regression/native evidence is recorded in the accepted-review audit below.
- [x] Bring reviewed Vigor/Health running or cycling history into ordinary cardio/hybrid creation before setting a dose; preserve the in-place draft, athlete-controlled permissions, explicit tolerance and separate Health-save consent. Empty/error/truncated data is not inactivity; untouched starter defaults are not athlete capacity. Mixed-modality history handoffs remain outside the existing single-modality contract.
- [x] Athlete selects Expandable, unchanged in visual direction. Implement full-width day cards, inline strength/cardio details, exact per-set dose groups, rest separators and one final hybrid acceptance/save. Saved compatible strength details are explicitly current context, not an invented original snapshot.
- [x] Allocate initial strength and easy cardio session counts before new hybrid authoring, show the proposed pair, respect explicit frequency and reviewed history, and budget suggested cardio against the accepted strength roster.
- [x] Use actual direct lower-body set counts to break placement ties around runs, with wrap-around, warmup and multi-primary handling.
- [x] Offer an optional same-exercise set transfer at joint review to move direct leg work away from a run, with preview/undo and shared capacity checks.
- [x] Compare eligible automatic hypertrophy structures and bounded whole-accessory relocations against the actual running calendar, retaining explicit splits, main lifts, dose and shared constraints. Selected structure supports preview/undo and atomic save; native final-binary acceptance is tracked separately.
- [x] Improve circular easy-cardio spacing in new standalone/hybrid previews through explicit `SPREAD_EASY_V1`, preserving coverage/dose/constraints and old saved reconstruction. Native seven-day rides move to 2/5; the eight-day hybrid uses strength 1/5 and rides 3/7. This is bounded relative-day refinement; dated post-edit/exact-hour coordination and global optimality are not claimed.
- [x] Shorten embedded history-estimate copy, use Apply to my plan and move method/provenance behind information. Legacy new-draft routes retain their correct wording; Health permission/save consent stays unchanged. Native short-copy/disclosure/application checks pass.
- [x] Add an explicit build-time QA entry into existing memory-only checks, hidden in normal/unset/malformed-flag builds. Device Hub enters the final test binary from its app icon without another Safari handoff. This does not bypass authentication or add an automatic source query/write.
- [ ] Complete modality-specific quality prescriptions and reviewed individualized progression. Current easy-duration heuristics are not a fully validated cardio model.
- [ ] Verify the athlete's exact eight-day proposal after the integrated engine is ready. The automated six-to-three-day reproduction is synthetic; relative-day optimization is not exact-hour or global-optimality certification.

Joint structure verification (2026-11-04): **3,297 tests / 277 suites**, TypeScript, whitespace and all cardio CPU budgets pass. Complete template comparison p95 is 69.18 ms on the Mac. Signed simulator Release installed; Training and the synthetic-check entry are visible. Full final-binary interaction remains blocked by Device Hub `noWindowsAvailable`. No physical update. Details: `docs/audits/2026-11-04-joint-structure.md`.

- [ ] Final native walkthrough of selected complete structure, undo and save retry once Device Hub interaction is available.

Joint frequency and leg-transfer verification (2026-11-03): 3,289 tests in 276 suites passed, including priority changes, feasible 7–31-day allocations, running placement, optional transfer preview/undo and saving the chosen prescription. TypeScript, simulator Release build and signature passed. Device Hub showed Training on the updated iPhone 18 Pro simulator. Its app controls were unavailable for a complete native walkthrough; the transfer was verified with component and repository-boundary inputs, not a physical-device or account save.

Evidence, scientific boundaries and exact verification: docs/audits/2026-11-03-training-generator-redesign.md. No further Bio edits or real athlete/Health test writes are part of this increment. After this audit, the latest Release was built, signature-verified, installed in place and launched on the physical iPhone 13 on 2026-11-03; the installer preserved the existing app data.

Spacing/copy follow-up: **3,280 tests / 275 suites**, 100% new pure-spacing coverage, TypeScript, whitespace, final signed simulator Release and scoped Device Hub acceptance pass. Final CPU p95: 3.72 ms (eight-day joint spread), 21.53 ms (31-day joint spread) and 2.29 ms (14-session spacing); budgets are unchanged. Native fixtures verify both spread patterns, preserved phase/strength doses, inline expansion, save failure/retry/direct return and the QA entry without Safari. Normal-build QA visibility, compatibility and Health-derived snapshot behavior have automated coverage; physical/large-font/dark/exact-hour/cloud acceptance is not implied. Details: docs/audits/2026-11-03-cardio-spacing.md. Priority-aware joint dose/leg composition remains open and is next; this refinement does not complete that allocator. **Physical install follow-up (2026-11-03):** the current Release build passed code-signature verification, installed over the existing app on iPhone 13 without uninstall/reset, and launched successfully. No actual Health query/permission, athlete test write, infrastructure change, commit or push.

History integration: **3,264 tests / 273 suites**, 100% new pure-module coverage, TypeScript, whitespace, final simulator Release and signature pass. The 1,000-record adapter/review CPU check is 3.25 ms p95. Final-binary Device Hub acceptance passes: NEW + reviewed 40 minutes, in-place cancellation/return, empty/error/retry, standalone save failure/retry, eight-day hybrid/shared availability, inline strength/cardio, separate derived-Health consent, consent reset after dose change and hybrid save failure/retry/direct return. All observations and saves are fabricated/in-memory. Exact evidence and remaining copy/spacing/physical boundaries: docs/audits/2026-11-03-planning-history.md. No physical iPhone update, real Health query/permission, athlete test write, commit or push. Priority-aware joint dose/leg composition remains the next implementation item.

Accepted Expandable continuation: **3,249 tests / 270 suites**, 100% of both new pure modules, TypeScript, whitespace, final signed simulator Release and signature verification pass. Device Hub verifies one availability form, direct single-summary entry, inline strength/cardio, one open workout and memory-only save failure/retry/return. Native checks preceded the final stacked-label/double-policy follow-ups; those pass automated/compiled checks but their final-binary replay, physical/large-font/dark-mode acceptance remain open. No physical iPhone update. Exact evidence: docs/audits/2026-11-03-expandable-hybrid-review.md. This consolidates creation/review and shared availability, not history-first dose selection, priority-aware joint composition or integrated activation. Standalone/legacy cardio availability remains on its existing independent path; four-goal entry consolidation is still open.

Current checks: **3,220 tests / 267 suites**, TypeScript and whitespace pass; both new business modules reach 100% statements/branches/functions/lines. Signed simulator Release and strict deep signature verification pass. Joint relative-day CPU guards pass at p95 1.46 ms (eight days) and 3.35 ms (31 days). All three prototypes and their strength/cardio drill-downs are checked in the local preview. Scoped Device Hub acceptance verifies NEW + current 40-minute cycling default, manual 35-minute retention across profile/back/review, two workouts totalling 70/80 after redistribution, and direct cancellation without a save. Native emphasis-grid/rail appearance, physical gestures and the athlete's exact four-strength schedule remain unverified. No physical installation has been performed.

## Priority order after microcycle 2 feedback — 2026-11-02

### P0 — execution reliability and plan integrity

- [x] Continuous numeric-wheel pixel motion, native free-scroll momentum preservation, pointer-transparent original hold and no automatic zero insertion in an empty field. Automated boundaries and native opening/tap selection pass; physical first-hold/drag smoothness remains open below.
- [x] Review microcycle opens the exact questionnaire over Training, not a navigation detour to Bio. Owner isolation, initial read retry, retained error drafts and existing-answer safety pass automated checks. The real survey layout/local save is checked with memory-only native data, not a real account review write.
- [x] Flexible split follow-up: retain best-effort placement rather than demand 100% fidelity; keep intended names for light supplements and derive truthful names for substantial drift. Preview and saved-routine behavior pass automated coverage; Device Hub verifies explicit upper/lower generation with coherent mixed-session labels and overlap disclosure. No new strict split constraint is requested.

### P1 — interpretation, editing and programming quality

- [x] Completed exercise rail state with visible tint/check, including undo, optional warmups and rehabilitation. Device Hub verifies completion and undo in the disposable workout fixture.
- [x] Bio only includes mesocycles with a valid completed owned session; remove upcoming-session/volume panels and raw exercise-performance records, retaining aggregate muscle evolution and recovery metrics. Discarded/foreign/future-only and stale-selection cases are covered.
- [x] Full-width review options and grouped question surfaces; remove stacked narrow pills. Native review also caught and fixed the compact Close/title layout regression.
- [x] Metric-aware green/yellow/blue ranges/status/trends, with unknown/stale neutral and no claim that a single directional departure proves better recovery. Native HRV detail checks use synthetic observations only.
- [x] Show completion dates on their own readable row; rename the existing heading to Active routines only. Date/accessibility behavior is automated; the heading is verified natively.
- [x] Horizontally scroll the full muscle summary in generated previews; unique editable structure-based routine names with #N suffixes. Component/pure behavior passes; physical horizontal-scroll acceptance remains separate.
- [x] Approved 120-second isolation starting rest with shared time budgets, unchanged strength-role rests and preserved explicit values, including 90 and zero. Automated regression and the native draft's 120-second rest editor pass.
- [x] Athlete accepts the current exercise order. Preserve it and the existing per-appearance ceiling; do not introduce a universal minus-one rule or invert the low-cost ordinal scores.
- [x] Reproduced redundant band-abduction path: a clearly superior eligible version no longer creates room for a poorly progressable duplicate after being chosen. Narrow same-task filtering and restricted-equipment/missing-rating/different-task boundaries pass; this is not a global band ban or proof of a measured hypertrophy difference.

### P2 — resume the remaining product roadmap

- [x] Finite recurring leisure appointments: weekly/multiple weekdays/every N weeks/monthly, local-time/DST preview and independent occurrence corrections. Full regression and scoped native fixture acceptance pass. Bulk this-and-future changes remain separate.
- [x] First joint hybrid proposal from zero reuses the full strength and cardio editors, retains one in-memory draft, reviews shared time/available and active days, and saves linked prescriptions atomically. Priority currently guides same-day order only. This does not complete joint dose optimization or integrated activation.
- [x] Dated shared-time review before linked hybrid activation: count fixed planned/recorded sport occurrences in their actual civil cycles, alongside estimated strength and forecast cardio; block excess time and uncertain context, with immediate acknowledgement invalidation and retained failure/retry. Full regression and scoped native memory-only acceptance pass. This does not allocate dose or merge strength/cardio activation.
- [ ] Continue unified strength/hypertrophy/cardio/hybrid creation, quality sessions, manual session scheduling, recurring sport exceptions and measured progression, in that order after P0/P1 generator repair.
- [ ] Keep sensor/Watch coaching, cardiovascular dashboard, sharing, teaching content and the broader physical performance/compatibility acceptance below the immediate execution/generator fixes. Existing detailed items remain below.

Evidence and exact scope: docs/audits/2026-11-02-training-feedback.md. No item is considered physically validated merely because a callback/unit test passes.

Initial UI increment: **3,070 tests / 256 suites**, TypeScript, whitespace and signed simulator Release pass. Numeric-wheel/execution pure modules have 100% coverage in all four dimensions; the three-module scope including routineMapper has 100% statements/functions/lines and 99.28% branches (one pre-existing mapper fallback branch remains).

Generator follow-up: **3,083 tests / 257 suites**, TypeScript, whitespace, signed simulator Release and scoped Device Hub preview/rest checks pass. Rest/coherence/split contracts have 100% statements/functions/lines and 98.19% branches; the new candidate-preference function has no uncovered statements/branches in the separate selection coverage report. No thresholds/timeouts are relaxed. No physical iPhone update, real athlete write, commit or push. Physical wheel/scroll acceptance remains open; subsequent roadmap scope is tracked below.

Finite recurrence follow-up: **3,143 tests / 260 suites**, TypeScript, whitespace and final signed simulator Release pass. The four scoped activity/calendar/series/repository modules have 100% statements/branches/functions/lines. Device Hub verifies a two-week/multiple-weekday preview, retained draft after injected failure, retry, one-occurrence duration correction, and monthly preview/cancellation on the final binary. Native saves use memory-only fixtures; real account persistence, physical performance and broad device/OS coverage are not certified. Evidence: docs/audits/2026-11-02-recurring-activities.md. No physical iPhone update, Health access, athlete write, infrastructure, commit or push.

Joint hybrid authoring: **3,167 tests / 264 suites**, TypeScript, whitespace, final signed simulator Release and scoped Device Hub flows pass. Both new business/repository modules have 100% statements/branches/functions/lines. Native checks cover production entry/cancel/return, compact shared-duration entry, 70/30 blocked versus 70/360 accepted, retained draft after injected failure/retry, and final-binary proposal-specific source labels/shared-day rejection and recovery. Saves are memory-only; real account transaction acceptance remains separate. Physical installation is recorded below only after completion. Evidence: docs/audits/2026-11-02-hybrid-authoring.md.

- [x] New hybrid increment: physical iPhone 13 Release build and strict deep signature verification pass; installed in place after implementation, automated tests and scoped native acceptance. No uninstall, data reset, Health permission, athlete test-data write, infrastructure, commit or push.
- [x] New hybrid increment launch-only confirmation: the process launches after unlock, without another build/install; the athlete also confirms Vigor opens. This does not certify all planner flows on the physical device.

Dated capacity follow-up: **3,188 tests / 265 suites**, TypeScript, whitespace, simulator Release and strict deep signature verification pass. The new capacity module has 100% statement/branch/function/line coverage. Device Hub verifies 130/100 blocked even after acknowledgement, 70/100 after removing only a synthetic reservation, immediate acknowledgement reset, optional information, injected failure, retained retry and direct fixture return. The dense 248-day/52-activity/112-cardio/248-strength CPU scenario passes at p95 **4.77 ms** against 50 ms; this is not physical touch latency. No physical iPhone update, account/Health test write, permission change, infrastructure, commit or push. Evidence: docs/audits/2026-11-02-hybrid-capacity.md.

Next implementation order within the unified-creation block:

1. Allocate shared dose/capacity according to priority using the now-implemented dated sport/time review; do not silently move actuals or appointments. Fixed-sport time accounting is complete at activation, not automatic dose allocation or integrated future strength prescriptions.
2. Integrate activation and the strength/cardio horizon, then consolidate the four-goal entry and cross-launch draft resumption.
3. Add modality-specific quality prescriptions and reviewed individual progression.
4. Add session-level drag/drop/order and exact-hour spacing; retain explicit uncertainty for date-only schedules.
5. Finish future-occurrence series changes and measured sport-stimulus review/replanning.
6. Add live sensors/Watch coaching and cardiovascular evolution panels. Keep the lower-priority sharing/teaching and physical acceptance items below visible.

## Current increment: athlete intake and cardio baseline

- [x] Optional first-account onboarding; returning athletes can open it from Settings.
- [x] Editable, private, owner-scoped intake with explicit unknown answers and no automatic Health permission request (device-local first increment).
- [x] Strength/cardio generators reuse declared defaults without overwriting manual choices or existing plans.
- [x] Unit/component tests, full regression and TypeScript: 2,851 tests / 245 suites; pure intake logic has 100% statement/branch/function/line coverage.
- [x] Device Hub scoped flow acceptance: new intake, skip, edit, injected save failure/retry, cancellation/reopen and planning defaults with fabricated memory-only saves; real Settings entry/cancel/return checked without saving an athlete profile.
- [x] Voluntary, read-only Apple Health cardio-workout review with source/date provenance, overlap resolution and conservative deduplication; no automatic import or dose change.
- [x] Review regression/type/signed simulator build and scoped Device Hub flows with synthetic observations: 2,906 tests / 250 suites; core review/client/lifecycle coverage 100%.
- [x] Athlete-performed real Health query: the athlete selects permissions and confirms recent workouts appear on the physical iPhone 13. Agent testing does not read those records.
- [ ] Independent record/source completeness audit, physical query latency, native long-list scrolling and broader OS/device coverage remain unverified.
- [x] Reviewed running/cycling history-aware initial dose for explicitly accepted new drafts; retain the conservative fallback without an accepted review and never infer measured intensity or experience.
- [x] Connect the accepted Health estimate to a new generator draft with numeric provenance, separate explicit private-account save acceptance and legacy snapshot compatibility. Final 3,006-test / 254-suite regression, TypeScript, 100% new pure-service coverage, signed simulator build and scoped Device Hub cancellation/consent/in-memory save acceptance pass. Physical/cloud usage acceptance remains separate.
- [x] Local history-informed starting-point POC: final 2,958-test / 252-suite regression, TypeScript, 100% core coverage, signed simulator build and scoped Device Hub flows pass. The subsequent explicit generator transfer is covered by the item above; the original POC alone did not save or transfer values.
- [ ] Purpose-specific optional age/sex/habits fields and account synchronization; the first increment does not collect these fields or upload intake.

## Cardio and hybrid completion

- [x] Saved proposals, dated activation, time/effort execution, history and manual sport replacement.
- [x] Forecast easy-duration progression with optional end-of-cycle review; no automatic intensity increase.
- [ ] Modality-specific quality/interval programming and further individualized progression.
- [ ] One creation flow for strength, hypertrophy, cardio and hybrid from zero, with shared capacity and priorities.
  - [x] Hybrid entry and bounded joint proposal creation/save, with preserved prescriptions and explicit inactive strength source.
  - [x] Fixed-sport dated time accounting and per-cycle shared-capacity rejection at activation, with source-template/provisional-dose limitations explicit.
  - [ ] Automatic priority-aware joint dose allocation, integrated future strength prescriptions and integrated activation.
  - [ ] One common entry for all four goals and resumable cross-launch authoring drafts.
- [ ] Session-level drag/drop and same-day ordering.
- [ ] Exact elapsed-hour spacing when times exist; honest uncertainty for date-only planning.
- [x] Finite recurring activity creation and single-occurrence edit/record/recoverable cancellation; automated lifecycle checks and scoped native fixture acceptance pass.
- [ ] Recurring-series this-and-future changes, optional open-ended series and automatic rolling extension.
- [ ] Measured sport-stimulus review and athlete-approved replanning.
- [ ] Full visual/navigation cohesion across strength and cardio.
- [ ] Live sensors, Watch recording/coaching and trustworthy live heart-rate/pace guidance.
- [ ] Cardiovascular evolution dashboard and integration with Bio context.

## Other requested follow-ups

- [x] Replace custom routine-identity symbols with 24 selectable system-rendered emoji; retain all old keys and defensive fallback, with localized accessible labels. Device Hub verifies selection/preview/cancel and manual creation without a routine write.
- [x] Remove the independent routine-background colour selector. Picker, Today and routine cards use the live app-accent tint; all ten accents in light/dark and creation/icon-only persistence are covered. Legacy stored colours are retained but not rendered or rewritten.
- [ ] Reviewed exercise teaching content: real demonstrations, setup, cues and common mistakes.
- [ ] Agree and implement plain-text routine/session sharing via the system share sheet.
- [ ] Broader shared History/context/draft queries and physical-device cold/warm loading measurements.
- [ ] Physical repeated timer acceptance with Audible, locked phone, Exercise Focus and Watch worn.
- [ ] Physical acceptance of microcycle swipe and continuous first-hold wheel scrubbing.
- [ ] Broader OS/device/font-size/offline/background acceptance matrix.
- [ ] Athlete-reviewed numeric volume experiments, deferred beyond the agreed explainable Bio review.

## Latest editor/icon increment

- [x] Home Edit routine opens session editing; identity has a separate entry.
- [x] Completed sessions remain in the shared editor; direct return preserves context.
- [x] Larger tinted cycle/session selectors and native iOS routine-symbol rendering.
- [x] Full regression: 2,813 tests / 242 suites; signed simulator Release and Device Hub flow review.
- [x] Explicitly requested physical iPhone 13 update and successful launch: editor/icon updates, athlete intake and read-only cardio Health review. No uninstall/reset/permission grant.
- [x] Subsequent starting-point POC signed Release builds and installs in place on the iPhone 13 after verification.
- [x] Starting-point POC physical launch succeeds after the athlete confirms unlock; retry is launch-only, without rebuilding/reinstalling.
- [ ] Starting-point POC full physical usage acceptance; startup success does not verify calculations against a real athlete dataset or device-query latency.

Acceptance evidence: docs/audits/2026-10-30-editor-navigation.md and docs/audits/2026-10-29-main-screen-loading.md. Append current-increment evidence here after verification; never mark an incomplete block done.

Current increment evidence: docs/audits/2026-10-30-athlete-intake.md. Signed final simulator Release builds and signature verification pass. After the user confirms unlock, Device Hub review resumes and verifies failure/retry, retained answers, cancellation/reopen and the real Settings-entry/return path. Scoped intake acceptance is complete; this does not certify fresh Firebase signup, physical-device performance or cloud profile synchronization. No real profile or training/Health record is written, and no physical iPhone update is performed.

Cardio Health review evidence: docs/audits/2026-10-30-cardio-health-review.md. Device Hub verifies synthetic overlap/source/exclusion/totals, clear/reread/acknowledgement, empty/error/retry/unavailable/truncated states and production Cardio/Settings entry/return without pressing Connect. Coordinate scrolling remains unavailable, so semantic flow acceptance does not certify physical scrolling or all long-list layouts. No real Health grant/read, athlete write or iPhone update is performed. Next: reviewed, explicitly approved history-to-planner transfer and initial-dose policy.

Starting-point follow-up: docs/audits/2026-10-30-cardio-starting-point.md. The athlete reports a successful real Health read after their own authorization. The local estimate POC passes 2,958 tests / 252 suites, TypeScript, 100% pure-service coverage, signed native build and scoped Device Hub flows. Both the preceding review and subsequent POC are installed in place on the iPhone; the latter's launch succeeds after unlock. Full physical POC usage is not implicitly delivered by startup acceptance.

Reviewed generator transfer: docs/audits/2026-10-30-reviewed-cardio-planning.md. The follow-up now connects the explicit estimate to a new versioned proposal with separate save consent. Full regression passes 3,006 tests / 254 suites; TypeScript, 100% new pure-service coverage, signed simulator Release and scoped Device Hub flows pass. Native save acceptance is deliberately in memory only, not proof of a real account write. This increment is not installed on the physical iPhone.

Routine emoji/accent follow-up: docs/audits/2026-10-30-routine-emoji.md. Full regression passes **3,033 tests / 254 suites**; TypeScript, whitespace, 100% emoji-resolution coverage, signed simulator Release and strict deep signature verification pass. Device Hub verifies the production identity sheet and manual creation selection/cancellation in light appearance without saving. All-accent/light-dark coverage is automated component acceptance, not native coverage of every OS/device. No physical iPhone update, real routine/settings write, commit or push.
