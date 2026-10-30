# Routine editor navigation audit — 2026-10-30

## Changes

- Home's Edit routine action now opens session editing at the current microcycle. Name/appearance editing belongs to the separate routine badge action.
- Selecting a completed session no longer replaces the routine route with History. The shared shell loads that exact execution inline and applies corrections through the existing bounded history repository method.
- History can push the shared editor onto the root stack. Its detail stays underneath; Back pops one screen. Missing/deleted linked plans retain the standalone history correction flow.
- Archived blocks resolve their existing owned template and history independently of the active Home block.
- Cycle/session switches protect unsaved changes; Save and Cancel stay above recorded fields. Name, notes and session effort expand on request, keeping exercise rows visible first.
- Back from a cardio workout returns to the entry screen. Saving a correction stays on the result; finishing a new workout still closes the flow to Training.
- Non-interactive preview wrappers no longer aggregate all editing controls into a single disabled accessibility element. Routine identity, detail and expand actions are independent accessible targets.

## Behavior evidence

| Flow | Expected return/context | Evidence |
| --- | --- | --- |
| Home → Edit routine | Current cycle, session editor | Native iPhone 18 Pro simulator |
| Editor → another session/cycle → Back | Original entry screen in one step | Native Torso/Pierna and cycle 1/2; component tests |
| Mesocycle M2 → session editor → Back | Same mesocycle view with M2 selected | Native simulator |
| Completed selection → correction → Save/Cancel | Same routine and selected session, no History redirect | Component integration; inline actuals UI exercised in memory-only native fixture |
| Change actual weight → another selection | Confirm discard or retain draft | Native fixture: 20 → 25; cancelled switching, saved in memory, reopened 25, switched to pending session |
| History detail → linked editor → Back | Original history detail underneath root-stack entry | Route integration tests; no athlete execution modified in native review |
| Archived block from History | Original saved template and execution, inactive in editor | Component integration tests |
| Cross-owner/mismatched/discarded execution | No editable actuals; obsolete callbacks ignored | Component tests, including switching away and back to the first owner |
| Correction → future RIR review | Actual saved first, future plan writes only after fresh preview acceptance | Component integration and existing pure history progression tests |
| Cardio result correction / Done | Corrected result remains visible; Done pops to its entry | Functional component tests |
| Cycle header swipe | Bounded horizontal change; vertical gesture rejected | Gesture callback tests; native drag tool returns `noWindowsAvailable`, so physical swipe is not verified |

## Scope and remaining observations

Native review uses existing plans read-only plus explicitly fabricated in-memory executions. It does not save workouts, change routine prescriptions, grant Health permissions, import Health history or update the physical iPhone. Automated routing assertions do not establish native gestures on every device or OS.

The beginner 25-minute suggestion comes from the existing starting-cap heuristic, even when declared current duration is 40 minutes. The cycle now discloses that it uses intake answers and has not reviewed Apple Health workout history. No dose algorithm or saved dose changes in this audit. Voluntary cardio-history review remains a separate pending increment.

Native reproduction enters a fabricated NEW running profile with 40 comfortable minutes, applies Suggest a starting point and obtains two 25-minute sessions (50 total minutes). The preview shows the native running figure, the intake/history disclosure and the optional explanation sheet. Cancel returns to its entry context without saving a proposal. Final native review also confirms the separate identity badge opens Name and appearance, previews Moon and colours, and cancels without changing the saved identity.

Exercise teaching content remains a proposal: reviewed real demonstrations, setup/cues/mistakes and substitutions, starting with frequent exercises. Existing descriptions and reference links remain usable; this audit does not add demonstration media.

## Final validation

- Full regression: **2,813 tests / 242 suites pass**, 145.314 seconds, `/private/tmp/vigor-editor-context-complete-regression.log`.
- TypeScript and whitespace validation pass.
- Signed Release iPhone 18 Pro simulator build passes; strict deep signature verification and simulator installation/launch pass.
- Native visual inspection confirms larger tinted cycle/session controls, native icon choices and compact recorded-set fields with optional metadata collapsed.
- Header swipe remains physically unverified because the drag automation endpoint fails; directions, bounds, vertical rejection and dirty switching are exercised in automated tests.
- Physical iPhone installation is outside this iteration; the previously installed phone version is unchanged.
