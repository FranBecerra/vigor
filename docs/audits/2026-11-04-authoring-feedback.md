# Authoring feedback — 2026-11-04

## Changes

- Athlete selects Grouped list for the creation entry; its hybrid symbol is explicitly not approved. Entry implementation and missing manual hybrid/cardio paths remain open.
- Generation phase directly controls mounted-page visibility and footer identity. Remove the horizontal shared-value pager so modal/resize restoration cannot expose configuration beneath preview actions. Scroll state and edited prescriptions remain mounted.
- Back cancels a pending variation, releases its busy state and rejects late results by task identity. Regression covers a delayed variation resolving after Back.
- A creation-route Health controller retains an explicitly read review across sheet unmount/remount. No mount-time permission/read or persistent raw-record cache is introduced. Existing owner, auth, blur, background and clear invalidation remain covered by hook tests.
- Closed history callbacks cannot apply an estimate. Apply still uses the current review/tolerance/calculation gates; discoverability remains a separate design item.
- Present three detailed cardio form variants and three independent hybrid-symbol variants using product tokens; none is selected yet.

## Verification

- Full `npm test -- --runInBand --watchman=false`: 3,300 tests in 277 suites pass, 159.686 seconds.
- `npx tsc --noEmit` and `git diff --check` pass.
- Simulator Release with local synthetic-check entry builds successfully. Strict deep signature verification passes; installed only in the iPhone 18 Pro simulator.
- Xcode mcpbridge exits without exposing a session; no DeviceInteraction session was opened. CUA Device Hub screenshots and hierarchy snapshots were used instead.
- Native inspection opens Vigor, enters the synthetic history fixture without Safari, selects cycling, opens the fake Health review, reads eight fabricated 40-minute workouts and returns to the intact form. The fixture's bridge is memory-only; no actual Health grant/read/write occurs.
- App accessibility controls are missing. Coordinate taps work, but wheel/drag did not move the long review. Full Apply acceptance, production-provider retention and generation swap/reroll native replay remain open. The synthetic fixture uses its own context and cannot certify production-provider retention; that behavior is covered by component tests.

## Remaining

Direct strength editing from combined review with retained cardio; profile-first intake and global recommendation behavior; consistent whole-program progress; approved grouped entry implementation and valid manual paths; approved cardio form; smaller emphasis controls; equipment imagery. No physical iPhone update, athlete data write, commit or push in this increment.
