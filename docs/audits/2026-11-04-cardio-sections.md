# Sections cardio setup — 2026-11-04

## Scope

Implement the approved Sections design in the shared standalone/hybrid cardio builder. Configuration is one scroll surface with Starting point, Recent cardio and Allocation. Use Vigor typography/surfaces, a fixed primary action and an opt-in plain appearance of the strength Stepper. Controlled experience choices open inline. Preserve mixed modalities and existing safety/source disclosures.

Remove only the redundant total-minute editor: explicit session frequency/duration derive the existing internal budget. Keep shared availability single-entry, bound cardio duration to that ceiling and retain Health-derived metadata/consent. Existing saved snapshots and repositories do not migrate. Current-practice suggestions seed only untouched values. Modality changes are distinguished from explicit availability edits; a blank/invalid shared limit never crashes the retained hidden cardio editor.

## Validation

- Four targeted suites / 35 tests passed before the final fixed-footer assertion. The full regression initially found one remaining onboarding integration test still navigating through removed intermediate Next buttons; it now asserts the real single-surface review and retained profile edit.
- Final regression: **3,305 tests / 278 suites pass** (`npm test -- --runInBand --watchman=false`, 162.565 seconds). TypeScript (`npx tsc --noEmit`) and whitespace checks pass.
- Simulator Release build and strict deep signature verification pass. The final app is installed on iPhone 18 Pro / iOS 27.0 simulator only.
- Device Hub verifies the starting-point section, activity rows, inline experience dropdown, selection/closing and fixed review footer in the final binary. It does not verify the complete lower form, wand/review/save replay, dark appearance or large fonts: native scrolling does not move the form, then drag/click returns `noWindowsAvailable`. This is a tool limitation, not a claim that the Mac is locked.
- Inspection used the explicitly enabled local QA entry and fabricated in-memory planning history. No Safari handoff or real Health permission was needed.
- Existing tests were updated to drive the real single-surface setup, without hidden compatibility Next buttons. Constraints, source edits, owner isolation, consent, retries and actual saved inputs remain asserted.

## Remaining scope

This does not implement grouped creation/manual hybrid/cardio paths, common athlete intake, a whole-hybrid progress model or direct strength editing from the combined review. No physical iPhone update, real Health query/permission, athlete write, commit or push.
