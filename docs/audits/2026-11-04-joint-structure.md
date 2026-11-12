# Joint hybrid structure review — 2026-11-04

## Implemented

- Editable 4 strength + 2 cardio starter for five available days with doubles in seven/eight-day cycles.
- Complete automatic hypertrophy candidate comparison using the accepted exercise selection and actual combined calendar.
- Guarded whole-isolation relocation away from running, with exact set preservation and protected main lifts/manual work/supersets.
- Actual shared capacity, recovery, split, dose and source checks before selection/save.
- Selected recommendation in the existing Expandable review, reversible before saving; stable exact-payload retry and invalidation on source/catalogue changes.

## Validation

- Full `npm test -- --runInBand --watchman=false`: 3,297 tests / 277 suites passed (186.85 seconds).
- Final malformed-calendar service checks: seven tests passed; full-structure component coverage verifies selected default, undo, displayed name, exact saved prescription and identical retry payload.
- `npx tsc --noEmit` and `git diff --check` passed.
- `npm run test:cardio-performance`: all workload budgets passed; new template comparison p95 69.18 ms against a 100 ms synthetic Mac CPU budget. This is not a physical-iPhone latency measurement.
- Final simulator Release built successfully with the synthetic-check entry enabled; strict/deep code-signature validation passed. Installed only on iPhone 18 Pro simulator.
- Device Hub showed Training and the memory-only Cardio check screen. Further interaction returned `noWindowsAvailable` and app accessibility controls were missing. Full final-binary native review remains open; no locked-Mac assumption or repeated user intervention is required to record this limitation.

## Boundaries

This is a bounded candidate search, not a proof of global optimality. The automatic cross-split pool is hypertrophy-only and AUTO-only; strength main-lift programming and explicit splits are protected. Cardio quality intervals, integrated activation, session drag/drop and live sensors are separate features. Synthetic tests do not validate an individual athlete's real prescriptions or exact elapsed-hour recovery. No real Health query, athlete-data write, physical install, commit or push is part of this change.
