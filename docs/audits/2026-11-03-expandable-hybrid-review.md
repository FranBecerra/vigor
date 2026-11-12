# Accepted expandable hybrid review — 2026-11-03

## Athlete decision and scope

The athlete selects the Expandable alternative with its existing appearance. Implement that production summary, consolidate the redundant acceptance screens and continue with one shared availability form for new hybrids. Further Bio work remains paused. Preserve pre-existing working-tree changes; no physical iPhone install, real athlete/Health test write, permission change, infrastructure mutation, commit or push.

## Implemented behavior

- One vertical full-width cycle, subtle raised/expanded surfaces, understated moon/rest rows, day number left, minutes right and consistent app accent. Details expand inline, one workout at a time; doubles show two independently expandable workouts. No detail navigation or new detail modal.
- Strength detail contains localized exercise names and consecutive equal per-set prescription groups; retain heterogeneous rep ranges, RIR and advanced/warmup types. The per-set extension belongs to the in-memory routine read model, not stored exercise documents. The separate optional persisted scheduling policy is described below.
- Cardio detail contains the actual scheduled prescription, phase durations, effort/talk test and optional walk guidance. Explanations/source provenance stay behind information. Missing detail remains explicit.
- The new hybrid builder has one final review. Cardio hands its reviewed input directly to it, without another name/acceptance screen. Final acceptance uses the existing atomic linked save; cancellation/back/edit stay local. Failure retains the reviewed retry payload; retained save callbacks cannot accept an old stage/settings/source draft.
- One availability form asks cycle length, training-day count, minutes per separate workout and permission for doubles. Strength uses the shared minutes and hides duplicate duration/unbounded capacity controls; cardio uses the shared cycle/day/doubles ceilings and derives its internal minute budget. Workout counts remain dose controls. Four days × 60 minutes with doubles derives 480 minutes of theoretical capacity, with an independent 60-minute ceiling for each workout, not 60 minutes total/day.
- Invalid or infeasible availability blocks continuation. A smaller cycle invalidates out-of-range placements rather than silently moving them. Changing shared availability invalidates the accepted cardio review, while retaining mounted editor state. Actual authored doses are not silently trimmed to fit.
- Edge-case audit found that legacy `allowDoubles` permits repeated cardio on one day. New shared-availability inputs explicitly opt into `doublePolicy=STRENGTH_CARDIO_ONLY_V1`: one cardio plus at most one strength session, never a cardio/cardio pair or a triple. The optional field survives save/reconstruction and applies after dated changes. Absence preserves legacy results. Excess requests remain visible rather than being silently hidden. Native review also caught a clipped long availability label; the scoped stacked-label stepper removes the fixed-height text row for these two fields.

## Boundaries

- Current priority still orients same-day order; it is not joint dose optimization. The provisional strength-count default is a product starter, not an evidence-derived optimal allocation.
- The existing bounded duration/frequency, 10,000-minute shared-storage and 1,440-minute cardio-storage ceilings remain. No saved legacy total is reinterpreted or migrated. Integrated activation and future per-cycle strength prescription accounting remain separate.
- Existing saved cardio fingerprints are calendar/time/demand summaries, not immutable exercise snapshots. Compatible strength details in a saved proposal are explicitly labelled current; missing/foreign/incompatible context does not fabricate original exercise detail. New authoring reads its exact current in-memory strength draft.
- Normal-flow Health/local-history review, modality-specific quality sessions, joint leg composition, exact-hour coordination, sensors and manual drag/drop remain open. No readiness interpretation or Bio design is changed here.

## Official documentation checked before implementation

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/).
- [React Native layout animation](https://reactnative.dev/docs/layoutanimation) and [accessibility](https://reactnative.dev/docs/accessibility). Use native full-width layout and labelled expanded-state buttons; reuse the project's Reanimated layout transition rather than introducing a dependency.

## Verification

- Full regression: **3,249 tests / 270 suites**, passing in 143.85 seconds. Both new pure modules (`combinedCycleReview.ts`, `hybridAvailability.ts`) have **100% statements, branches, functions and lines**, without relaxed thresholds. A subsequent targeted run also verifies the stacked-label availability controls.
- TypeScript, whitespace checks, final simulator Release compilation and strict deep signature verification pass.
- Synthetic CPU guards pass, including joint rhythm p95 1.48 ms (eight days), 3.75 ms (31 days), dated shared capacity 3.92 ms and dense 248-day progression 126.20 ms. These are Mac CPU checks, not physical touch/gesture measurements.
- Device Hub (iPhone 18 Pro / iOS 27) verifies the actual production UI through the memory-only hybrid fixture: one availability form, no repeated cardio time/day ceilings, direct entry into one final summary, 2 + 2 sessions / eight days / 60-minute ceiling, inline strength with 3 × 10 @ RIR 2, cardio phases, automatic closure of the previously expanded workout, injected save failure, retained retry and direct successful return to the fixture. The fixture writes no athlete or Health records.
- Native review occurred before the final stacked-label and cross-discipline-double follow-ups. Those follow-ups pass automated regression and final signed compilation, but were not replayed in the final binary: reinstalling would close the active test and require another inaccessible Safari confirmation. Do not claim final-binary visual acceptance of those last two changes. The observed label clipping is covered by the new no-fixed-height label assertion. Physical/large-font/dark-mode appearance and the newest binary's end-to-end replay remain explicit acceptance items.

No physical iPhone installation, real account/Health test write, new permission, infrastructure mutation, commit or push. Do not infer physical gesture acceptance, broad device compatibility, Health-history completeness or actual cloud persistence from automated checks.
