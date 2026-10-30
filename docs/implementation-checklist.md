# Vigor delivery checklist

Updated: 2026-10-30. Product decisions live in PRD.md; this checklist tracks delivery, not a second specification.

Legend: `[x]` implemented and automated checks passing; `[ ]` open. Native acceptance is tracked separately and is never implied by unit tests.

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
- [ ] Session-level drag/drop and same-day ordering.
- [ ] Exact elapsed-hour spacing when times exist; honest uncertainty for date-only planning.
- [ ] Recurring activities and single-occurrence/future-series exceptions.
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
