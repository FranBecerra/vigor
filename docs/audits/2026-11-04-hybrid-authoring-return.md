# Hybrid authoring return — 2026-11-04

## Delivered behavior

Harden the existing mounted editor flow without introducing unapproved visual controls. Strength prepare/exit and cardio review callbacks check the live owner, active phase, current strength/settings identity and pending-save lock. Old callbacks cannot navigate out of newer work, accept obsolete cardio or reopen a review after leaving its phase.

Changing the accepted strength draft invalidates the joint calendar acceptance. The same mounted cardio editor retains explicitly authored duration/frequency. Saving requires a fresh review against the revised source. No separate strength/cardio write is introduced.

## Automated and compiled verification

- Full final suite: **3,307 tests / 278 suites pass**, 169.73 seconds.
- TypeScript (`npx tsc --noEmit`) and whitespace checks pass.
- Simulator Release build and strict deep code-signature verification pass. Final build installed only on iPhone 18 Pro / iOS 27.0 simulator.
- Added regression: eight-day source replacement, preserved 45-minute cardio and frequency, identical mounted editor, old review/save rejection, explicit fresh review and revised atomic bundle.
- Added regression: late prepare/exit/review while hidden, replacement-source identity, valid current exit and callbacks after unmount.

## Design review and selected implementation

Three detailed light-mode Subtle proposals compare Visible stages, Compact progress and Expandable index. All retain the existing expandable joint day list. The new surface varies only global authoring progress and strength-edit access. The prototype permits entering a representative existing strength preview, changing a RIR, returning with cardio duration preserved and explicitly reviewing the updated cycle. It does not run the production optimizer or save data.

Browser inspection checks all three access/return patterns, the inline day expansion, pending-review state and absence of horizontal overflow at the inspected 390-point product width. JavaScript syntax passes. Native strength-editor visual fidelity, smaller-screen/large-font acceptance and actual direct-edit navigation are not certified by that prototype.

On November 5 the athlete selected the four Visible stages with the Compact progress edit rows and icons. The existing strength preview now opens an isolated revision seeded from the selected joint prescription. Returning from an edit retains the accepted review. Applying an edit keeps both IDs, retains the cardio inputs and requires another calendar review before the final save. The revised strength prescription remains fixed during that review.

Focused automated checks pass for the selected alternative, cancelled edit, stale revision callback, RIR changes in the reused editor and write-free intermediate acceptance. The simulator Release built and passed strict signature verification.

## Native acceptance

On the signed iPhone 18 Pro simulator build, official Device Hub touch and swipe worked with the fabricated planning-history fixture. The captures show the allocation section and its wand, with the review action fixed while scrolling. After selecting Cycling, the fixture displayed two sessions. Set the per-session ceiling to 35 minutes, open the cycle preview, return to setup and scroll back to allocation. The final screenshot and hierarchy both show 35 minutes and two sessions. Evidence is in the Device Hub capture sequence for Hybrid Return Native Acceptance, steps 12–16.

The fixture verifies standalone cardio review and return. The test of changing the strength source and rejecting a stale combined review runs at the component level.

No physical iPhone update, real Health query/permission, athlete test write, infrastructure mutation, commit or push.

## November 5 native follow-up

The simulator showed Time, Strength, Cardio and Review, and the three matching footer icons. In the synthetic hybrid, Edit strength opened the seeded two-session prescription and Back restored the same review. The next edit changed one bench press set to RIR 3. Applying returned to Cardio with Cycling selected. Reviewing again showed one set at RIR 3 and two at RIR 2. The Device Hub session closed successfully.

The first device pass found that the generator preview and combined review derived different session names and time estimates. The reused preview now derives both from the same routine view and session estimate as the combined review. The focused regression compares the editor's displayed values to the actual strength placement values. Final validation passes 3,309 tests across 278 suites, TypeScript, whitespace and strict simulator Release signature verification.

The final signed build was replayed through the synthetic review and strength edit in Device Hub. Both surfaces displayed Empuje A and Empuje B with the same 15-minute estimate. The session closed successfully.
