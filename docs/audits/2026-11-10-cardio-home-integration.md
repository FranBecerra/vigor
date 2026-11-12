# Active cardio routines and the existing strength calendar

## Approved scope

The athlete rejected the unified agenda/cycle prototypes and authorized integrating cardio into the existing Training presentation. Keep the Today card, routine accordions, common library and mesocycle navigation. The subsequent clarification removes the Strength/Cardio selector from Training. Add activated cardio blocks under Active routines and insert their sessions alongside the existing workout/rest rows where the date relationship is known.

## Behavior

- Owned non-ended cardio blocks appear before Other routines. Saved proposals and ended/foreign blocks do not become active routines.
- Cardio and strength share the single-expanded-accordion state. An active cardio block takes precedence over inactive strength routines when there is no active strength routine. There is no irrelevant No session message in that case.
- Cardio cards reuse the existing surface, live accent, status indicator, row height and progression rail. They retain their own cycle count and show duration instead of strength working sets.
- Current cardio progress follows the first unresolved opportunity. Skips resolve without completion credit. A sport reservation stays unresolved until a matching dated record exists; the sport record does not become a completed cardio workout.
- Latest corrected/discarded workout identities determine completion and actual duration. Performed cardio dates are derived in the block's timezone.
- Calendar integration accepts exact unambiguous strength dates or a compatible reviewed relative anchor. It does not manufacture dates for unknown or changed context. Non-seven-day cycles, later source-cycle offsets, same-day sessions and earlier strength-mesocycle anchors are covered.
- Supplemental cardio rows cannot enter strength drag/hold persistence. Strength/rest reorder targets are translated back to their original day indexes and stable IDs. A rest marker alongside cardio is explicitly Strength rest.
- Row/rail navigation previews the exact cardio cycle or opens the existing workout. No activation, start, completion or strength-plan write occurs merely by opening a row. The existing block route bounds malformed initial-cycle parameters.

## Automated verification

- Final production source: full Jest regression **3,416 tests / 293 suites**, passing. Log: `/tmp/vigor-cardio-home-final-all.log`.
- Final UI focus: **31 tests / 5 suites**, passing. Log: `/tmp/vigor-cardio-home-ui-final.log`.
- Four additional route-parameter cases were then added to the existing cardio functional suite; all **20 tests** in that suite pass. They add no production changes. Log: `/tmp/vigor-cardio-home-cycle-route.log`.
- New read-only projection: **100% statements, branches, functions and lines**, eight tests. The module is included in the normal coverage collection. Log: `/tmp/vigor-cardio-home-coverage.log`.
- TypeScript and whitespace checks pass; no dependency or native capability change is required.

## Native acceptance

Signed simulator Release, iPhone 18 Pro / iOS 27. The memory-only acceptance entry reuses production RoutineCard, TrainingCalendarCard, CardioRoutineCard, CardioTimeline and CardioWorkoutPanel. Calendar persistence and workout saves are injected into component memory. There are no athlete record or Health writes.

Evidence directory: `/private/tmp/vigor-cardio-routines-acceptance/`. `13-final-fixture.png` shows the eight-day strength/rest list with interleaved cycling rows. `17-single-expanded.png` shows strength collapsed and cardio expanded. The cardio rail and row preview open the requested cycle and return to the routines. A synthetic start → pause → finish → save is reflected with a completion check and actual duration in `23-completed-card.png`.

The fixture's inline replacement of a deeply scrolled view retains its scroll offset; production opens a separate route. This is a fixture limitation, not a demonstrated production navigation defect. The final root-only edge-case build is signed, installed and startup/home-checked (`26-delivered-home.png`); the final source fingerprints match. The Device Hub session is explicitly closed, and the simulator is left on Strength home. Full report: `/private/tmp/vigor-cardio-routines-acceptance/acceptance.md`. The real simulator account has no active cardio block, so populated presentation/recording acceptance uses fabricated data. This does not claim a physical iPhone deployment or a real-account cardio save.

## Unified landing follow-up — 2026-11-12

Device Hub confirmed the unified landing on the signed simulator build with the updated cardio microcycle review. Activities and Cardio history from Health both opened from the common library and returned directly to its previous scroll position. Device Hub ended the session. The simulator account had no active cardio block. The populated schedule remains covered by the in-memory acceptance above. Evidence: `/private/tmp/vigor-unified-training-acceptance/acceptance.md`.
