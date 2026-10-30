# Athlete intake acceptance — 2026-10-30

## Scope

First optional athlete-intake increment, not the complete cardio/hybrid backlog. Storage reuses the existing serialized device-local account settings. No cloud profile, Health workout import, sensitive demographic collection or changed starting-dose algorithm is claimed.

Official platform reference checked before changes: Expo SDK 57 and its Expo Router reference. New profile routes use the existing authenticated root and generated typed routes; no new dependency or infrastructure change.

## Automated evidence

- Final full regression: **2,851 tests / 245 suites**, 140.618 seconds, all passing (`/private/tmp/vigor-intake-acceptance-regression.log`). Earlier intermediate regression also passes; the final count includes the loading-error exit and retry/clear-modality cases.
- Pure intake validation, projection and welcome-eligibility logic: **100% statements, branches, functions and lines**, 29 cases (`/private/tmp/vigor-intake-coverage.log`). Default coverage collection includes the new service.
- Component/provider tests cover optional answers, explicit defer, invalid input, write failure with retained answers, duplicate-submit protection, delayed settings, one-time defaults, manual-edit preservation, account changes/round trips and provider unmount (`/private/tmp/vigor-intake-integration.log`).
- TypeScript passes after Expo regenerates the new route declarations (`/private/tmp/vigor-intake-verified-types.log`). Whitespace and strict deep simulator signature verification also pass.

## Device Hub flow review

Device: **iPhone 18 Pro simulator, iOS 27**, signed Release app, existing installation updated in place. Use authenticated `vigor://athlete-check` only for saves. This route passes fabricated values to the production form and keeps all results in component memory. It does not call the settings writer, workout repositories or Health bridge.

Verified through native accessibility actions and screenshots:

1. Welcome opens with four goal options, no preselected goal and a visible Not now action.
2. Not now produces a DEFERRED marker with no answers and no generated defaults.
3. Restart → Hybrid → Intermediate strength → New running with 40 comfortable minutes → four strength sessions per week / 75 minutes → Save.
4. The stored memory snapshot contains the explicit values only; hybrid does not invent a strength adaptation priority, and missing running frequency remains missing.
5. Open the cardio builder from that snapshot: Running is selected, New is selected and comfortable duration is 40. Cycling and machine remain unselected.
6. Cancel the planner returns directly to the fixture summary without saving a proposal.

The Release build used for this first flow review passes and verifies its signature (`/private/tmp/vigor-intake-native.log`). The final Release also builds successfully (`/private/tmp/vigor-intake-acceptance-native.log`), including owner/unmount isolation, loading-error exit/retry, disabled saving fields and fixture controls moved out of the status-bar area. The fixture's injected failure now applies to one save only, allowing a genuine same-draft retry.

After the final simulator update and fixture launch, Device Hub initially stops returning screen/accessibility state and reports that the Mac is locked. Rebinding does not recover it, so review pauses for a manual unlock/check. The athlete subsequently confirms this is done; the resumed acceptance below closes those specific native checks.

### Resumed acceptance after user unlock confirmation

The existing final simulator build is used without rebuilding, reinstalling or changing application code. Device Hub reconnects successfully to the iPhone 18 Pro simulator.

7. In the memory-only fixture, defer welcome, enable the one-attempt failure and edit the intake. Select Strength, leave experience/cardio/capacity unknown and save. The expected error appears on step four, with the form still open.
8. Retry Save without re-entering answers. The summary contains `status: COMPLETED`, `goal: STRENGTH` and the matching strength default; no omitted answer is fabricated. Reopen and confirm Strength remains selected.
9. Change the goal to Cardio, then Cancel. The summary still contains Strength with the same stored timestamp. Reopening again shows Strength selected, proving cancellation did not save the draft.
10. Leave the fixture and follow the real app's Training → Profile → Settings → Athlete profile entry. The production profile opens. Select Cardio and Cancel; the app returns directly to Settings. Reopen and verify no goal is selected: the fabricated fixture result and cancelled production draft were not persisted to account settings. Cancel again, go Back once to Profile and restore Training using the bottom tab.

All scoped native follow-up checks are now complete. Saves/failure injection occur only in the memory fixture; the production Settings route is tested by opening/cancelling only. No Health dialog appears, no existing preference is changed, no workout is started and the physical iPhone remains untouched. This follow-up changes documentation only; the existing full regression, TypeScript and signed-build evidence remain applicable.

## Limits

No real profile, training plan, workout, Health permission or Health history is modified. No physical iPhone update. This is UI flow acceptance with memory-only persistence plus repository/component tests, not a fresh Firebase account creation test, cross-device synchronization test or physical-device performance benchmark. Native accessibility actions do not establish every swipe/gesture or OS version.

Age/sex/habit collection still needs purpose-specific design. Voluntary Health cardio-history review and a reviewed history-aware starting prescription remain open in docs/implementation-checklist.md.
