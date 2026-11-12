# Circular cardio spacing and embedded-review copy — 2026-11-03

## Scope

- New cardio/hybrid drafts opt into `SPREAD_EASY_V1`; old saved V1/V2/V3 reconstruction remains unchanged without that explicit input policy. Validate and persist only the named policy through the saved-input whitelist.
- Refine accepted easy-cardio days with bounded moves/swaps, preserving dose, IDs, omissions, allowed days, active-day/double limits and fixed strength. Recompute prescription ordering by candidate ID. Do not change quality sessions, actual dates or performed workouts.
- Prefer better lower-body proximity and fewer duplicated/shared days before circular active streaks and evenly distributed cardio gaps. A circular gap objective counts the cycle boundary and does not assert a medical recovery threshold or globally optimal plan.
- Shorten the embedded estimate, use in-place application wording and keep method/provenance behind information. Legacy new-draft screens retain their accurate existing wording; explicit Health authorization and derived-save consent remain unchanged.
- Add a build-time opt-in QA entry on Training (`EXPO_PUBLIC_VIGOR_LOCAL_CHECKS=1`) into existing memory-only checks. Normal unset/malformed flags show no entry. It does not bypass authentication or authorize/read/write Health or athlete records. The purpose is to remove repeated Safari handoffs during simulator testing, not add a product navigation item.

## Official documentation and boundaries

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/).
- [React Native 0.86 modal behavior](https://reactnative.dev/docs/0.86/modal).
- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/): use an explicit public compile-time feature toggle, with no secrets or external service switch.

No new clinical formula is introduced. The user-supplied cardio research remains background evidence; relative-day evenness is a scheduling preference, not a universal physiological minimum. Priority-aware allocation/leg composition, integrated activation, exact-hour and dated post-edit spacing, quality prescriptions and sensors remain open.

## Verification

- Scoped spacing tests pass for 7/8/10/31-day cycles, wrap-around and duplicate days, zero/one session, candidate-specific restrictions, hard active-day/double/triple boundaries, pair swaps, dense 14-session inputs, mixed-modality prescription identity, immutable inputs, legacy saved reconstruction and explicit Health-baseline preservation. The new pure spacing module has 100% statements/branches/functions/lines.
- The initial 31-day joint CPU case measured 53.68 ms against the existing 50-ms budget. Reduce longer-cycle refinement to one bounded pass; retain two passes for short cycles, with the same 256-evaluation ceiling. The next run passes at 45.79 ms for joint 31-day review, 6.92 ms for eight-day review and 3.07 ms for a 14-session/31-day spacing pass. Budgets are not relaxed. These are Mac CPU measurements under concurrent checks, not physical touch latency.
- Final full regression: **3,280 tests / 275 suites**, passing in 378.54 seconds. TypeScript, scoped whitespace, final simulator Release compilation and strict deep signature verification pass. Both new QA-entry behavior and the spacing/Health snapshot compatibility checks pass. Coverage thresholds are unchanged.
- Final CPU rerun after the concurrent regression finishes passes every existing budget: joint spread review p95 **3.72 ms** for eight days and **21.53 ms** for 31 days; 14-session spacing **2.29 ms**. No physical touch-latency claim follows from these measurements.
- Final-binary Device Hub acceptance passes on iPhone 18 Pro / iOS 27 in the light theme. Launch from the app icon, use the explicitly enabled Local checks entry and reach the fabricated planning fixture without Safari or an athlete handoff. Normal/malformed/unset flag behavior is tested automatically; a separate normal-build native replay is not claimed.
- Native history review confirms short default copy, optional method/provenance disclosure, the in-place Apply label and a retained NEW + 40-minute estimate. Standalone review places its two 40-minute rides on days **2 and 5** of a seven-day cycle. Injected save failure retains the distribution/name and retry returns directly to the in-memory fixture.
- The hybrid fixture starts from a fabricated two-session strength draft. At eight days/four active days/60-minute ceiling, native review places strength on **1 and 5**, and two 40-minute rides on **3 and 7**, with intervening rest. Inline strength retains 3 × 10 @ RIR 2; cardio retains its 5/30/5-minute phases. Only one workout expands at a time. Injected failure/retry saves only in memory and returns directly. This is not a full new strength-generation, physical-device, actual Health or cloud-transaction acceptance.
- One accessibility capture times out after completing the review actions; the tool kernel is reinitialized and the live state confirms the correct result. No reinstall, athlete tap or Mac-lock diagnosis is needed to recover. Large-font/dark-mode, physical gestures, exact-hour coordination and dated post-edit spacing remain separate acceptance items.

No physical iPhone update, real Health query/permission, athlete test-data write, infrastructure mutation, commit or push.
