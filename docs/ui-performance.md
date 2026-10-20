# UI responsiveness regression contract

These are product budgets, not scientific training prescriptions or universal human-perception thresholds. Do not interpret a passing Jest run as proof of smooth native rendering.

## Automated guards

`npm test -- --runInBand` verifies closed selectors mount no input/results, a 200-exercise fixture mounts fewer than 30 result rows initially, drawings are in the optional muscle gallery rather than every row, and selection survives filters. These deterministic work bounds prevent the original eager-rendering regression without flaky CI wall-clock assertions.

The opt-in native fixture route `vigor://performance` uses the production option cards and full static exercise catalogue, including related/other sections and the real native selector modal. It records one first-exposure sample and thirty warm samples for button-state commits, step-style card replacement and modal presentation, plus JS frame-callback gaps. It writes a local JSON report only; it never changes routines, sets, rehabilitation records or account data. It is not linked from normal user navigation.

| Metric | Warm p95 budget | Worst sample, including first exposure |
| --- | ---: | ---: |
| Selection feedback / committed UI | 100 ms | 250 ms |
| Consecutive wizard-style content commit | 150 ms | 350 ms |
| Exercise picker ready, including native slide animation | 600 ms | 1,000 ms |
| JS frame-callback gap | 50 ms | 200 ms |

At least twenty warm samples per metric are required for acceptance; missing, invalid, timed-out or Development reports fail. Baseline comparison additionally fails p95 regression beyond the larger of 20% and 20 ms. Baselines are never automatically replaced. Platform, OS, viewport, build mode, workload and explicit target must match. Compare the same hardware and appearance with similar system load; an overloaded simulator is not a physical-device performance result.

The illustrated generator update uses workload `illustrated-options-v1`. Its thirty warm content commits cycle through ordinary goal cards, all thirteen illustrated equipment cards and the four full-body split cards, not thirty samples of each individual page. It must establish a new passing, explicitly matched baseline; the earlier simple-card reports remain historical and are not comparable to this heavier scene mix. The selector and frame-gap gates are unchanged.

## Repeatable simulator run

Install the current Release simulator build once, sign in with a test profile and leave the simulator idle. The benchmark route has the same authentication requirement as every other app screen; no login bypass is introduced for testing. The runner does not build, reinstall, reset data or stop a workout. Do not invoke it while authoring a routine or training.

Keep Xcode's local simulator signing enabled (`CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-`). An unsigned simulator build caused Firebase secure-storage error -34018; it could show Google account selection but fail to restore/persist the session. A successful compilation alone does not verify usable authentication. Rebuild/reinstall without clearing app or keychain data, then verify the training home before collecting timing reports.

```bash
bash scripts/benchmark-ui-ios.sh DB12E945-C223-44BE-B5BE-0885FE77B895
npm run test:performance -- output/performance/ios-RUN.json
npm run test:performance -- output/performance/ios-RUN.json docs/performance/BASELINE.json
```

The script waits for the unique run's report, copies it into `output/performance`, then exits nonzero on budget failure. Pass an output directory and optional baseline path as the second and third arguments. Never approve a baseline merely to make a failing result green. Repeat the run after fixing a regression and retain both reports.

## Initial native validation — 2026-10-20

The signed iPhone 18 Pro/iOS 27 simulator Release passed two consecutive runs with thirty warm samples per action and an explicit matching-target comparison. Accepted baseline: `output/performance/ios-1792489654-84126.json`. Warm p95 was approximately 34 ms for selection/content changes, 67 ms for the selector and 17 ms for JS frame gaps. Native slide and fade variants both measured approximately 650 ms for selector presentation and failed the original 600-ms gate; their reports remain alongside the accepted ones. Production selector presentation is now immediate, without the long native transition. This measures the animation change as well as selector mounting, not a matched pre-virtualization optimization. No physical iPhone timing result is claimed.

## What the measurements do and do not cover

The illustrated workload passed two consecutive Release runs: `output/performance/ios-1792491060-95226.json` and `output/performance/ios-1792491105-95560.json`, with the first explicitly supplied as the second's matching baseline. Repeat warm p95: selection 33.5 ms, illustrated content 84.0 ms, picker 66.6 ms and JS frame gaps 17.2 ms. Worst illustrated content commit was 134.1 ms. The heavier workload stays within the original gates; these reports supersede neither the historical simple-card results nor actual workout acceptance.

Workout acceptance additionally has an isolated `vigor://workout-check` screen: real exercise rail, set rows/shared compact input, warmups, read-only computed review, in-memory snapshot restoration and a three-second rest alarm. It imports no repositories and must never be replaced with tests that complete a real athlete session. Automated behavior tests guard unified editing without a native keyboard, visible deletion, warmup exclusion, resumed-set review correctness, alert replacement/cancellation, one activity across relaunch and account-boundary cleanup. This is an acceptance fixture, not a new measured latency result. Native sound/haptics require physical-device acceptance; simulator UI alone cannot establish vibration or locked-phone delivery.

After audio/Live Activity integration, `output/performance/ios-1792504358-61753.json` and `output/performance/ios-1792504423-62348.json` both pass against the unchanged pre-integration illustrated baseline (`ios-1792491060-95226.json`). Repeat warm p95 is 33.8 ms / 100.0 ms / 67.0 ms / 17.6 ms respectively. Illustrated commits rise about 16 ms from 84.3 ms but stay inside the existing 20-ms minimum regression tolerance and 150-ms absolute p95 budget. No baseline or gate was changed to obtain acceptance. The maximum illustrated commit on the repeat is 116.9 ms.

Commit timing is JS-trigger to React commit plus two frame callbacks. Picker timing ends after native `Modal.onShow` and those callbacks, including its presentation animation. The fixture drives state changes programmatically: it does **not** measure OS touch-dispatch latency, display scanout, native GPU FPS, every Expo navigation route, real workout hydration or network-dependent loads. JS frame gaps identify scheduling stalls, not native rendered-frame counts. A 250-ms smooth native animation and a 250-ms frozen JS thread are not interchangeable.

The real wizard and workout picker have disabled-by-default trace markers for follow-up profiling. Native visual checks still exercise actual buttons, keyboard, scroll, dragging and return/resume behavior. Extend the native matrix to actual route-to-route flows and physical iPhone runs; attach Instruments animation-hitch traces when native smoothness regresses without a JS timing failure. The first scoped benchmark and structural guards are a regression barrier, not certification of the whole app.

Official references: [React Native performance](https://reactnative.dev/docs/performance), [Expo native tabs](https://docs.expo.dev/versions/v57.0.0/sdk/router/native-tabs/), and [Expo FileSystem SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/).
