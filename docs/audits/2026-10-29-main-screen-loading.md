# Main-screen loading audit — October 29, 2026

## Follow-up implemented after the audit

Focused Training now revalidates on a genuine background/inactive → active transition while retaining its visible routines; repeated active events do not issue duplicate reloads. Bio no longer inserts/removes a global loading spinner above all cards. Per-card pending states carry the loading feedback instead.

Follow-up validation: **2,650 tests / 233 suites pass**, 143.71 seconds (`/private/tmp/vigor-routine-bio-loading-final-regression.log`), plus passing TypeScript/whitespace checks and a signed Release simulator build. Native review confirms saved-routine identity editing (preview/cancel only), the accent-aware metric overview and the matching trend sheet using explicit synthetic fixtures. No physical-phone latency or native-cache p95 is claimed. No athlete test records, Health permissions or physical-phone update were performed in this follow-up.

The baseline below describes the original behavior, not the current policy. A subsequent explicit request implements: owner-scoped native-cache routine presentation before the normal refresh; template→plan reads overlapping history; stable Bio metric cards during initial loading; and retained same-owner in-memory Health readings labelled Updating during refresh. Readiness remains pending rather than reusing an old score as fresh. Pending settings no longer briefly display a disconnected state. Errors/unavailable/owner/consent changes hide readings. Health data is not persisted. Existing routine identity is now editable from Training's expanded card, and Soft metric materials follow the shared accent without recolouring warning semantics.

The controlled template/history/plan fixture (100/400/300 ms) now completes at **400 ms**, previously 700 ms. The 20×600-ms Health fixture still takes 600 ms per read but no longer blanks existing metric values during those reads. These are deterministic tests of presentation/dependencies, not evidence of faster native HealthKit queries or measured iPhone startup. Native cache may be absent/partial and cached content can be stale. A late cache response must not replace a newer refresh, and an empty cache must not flash “no routines”. Broader History/context/draft query sharing, full native startup profiling and physical-device p95 collection remain follow-up work.

## Scope and evidence levels

Audit Training home, Bio, History and Profile/Settings on initial JS mount, screen focus and foreground return. Do not change workout execution or infer physical-phone latency from host tests. This delivery instruments the existing read policy; it does not silently remove freshness checks or persist Health observations to mask loading.

Official references checked before implementation: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [React Native performance](https://reactnative.dev/docs/performance), [AppState](https://reactnative.dev/docs/appstate). Use a Release build for native comparisons. An `inactive → active` event can also be a transient system interruption, not necessarily a new app launch.

## Confirmed causes

| Surface | Current behavior | Consequence / proposed correction |
| --- | --- | --- |
| Bio Health trends | `useBioHealth` clears trends and enters LOADING on each focus and every `active` event. | Repeated blank cards even when existing values were visible. Prefer a focused, owner/consent-scoped in-memory snapshot with explicit freshness and background refresh. Keep locked/unavailable/error distinctions and immediate disconnect clearing. |
| Bio overnight | `useBioNight` drops the analysis before every reread, including foreground. | Readiness can disappear during refresh. Same snapshot policy as above; never retain samples after consent/account changes. |
| Bio context | `useBioHistory` independently lists mesocycles, routines and all workouts on focus. | Overlaps Training/History reads; first mount waits for all three. Share an owner-scoped repository view or subscription rather than removing required refreshes. |
| History | Focus effect explicitly resets items to an empty loading list. | Back navigation visibly discards a usable list. Keep prior same-owner content while revalidating; show stale/error status if refresh fails. |
| Training home | Memory view cache survives warm navigation only. Initial `loadRoutineViews` waits for routines **and full workout history**, then requests each active mesocycle. Catalogue-map updates can also rerun the focused effect. | Cold dependency path is `max(routines, history) + max(mesocycles) + mapping`. Start independent mesocycle reads as soon as routine identities arrive, then join history. Avoid rerunning all I/O solely because presentation/catalogue changed. |
| Active workout preview | `useActiveWorkout` separately lists the full workout history on Training focus. | Duplicate work alongside the home history read. Reuse the same owner-scoped snapshot; preserve resumable draft correctness. |
| Authentication / Settings | Fresh JS process restores auth, then reads a local per-owner settings file. | A process restart cannot reuse a module cache. Auth must not briefly show login for an authenticated user. Measure restoration separately from native process launch and data readiness. |
| Profile | Mostly immediate auth/settings-backed rendering; no separate full-profile fetch in the route. | A delay here may be root auth restoration, local settings or transition rendering rather than a Profile database query. |

Firestore's durable native cache already exists. The main lists use default one-shot `getDocs/getDoc`; they do not render a distinct cache snapshot immediately. This audit does **not** assert every read is a network hit, nor that replacing them indiscriminately with cache-only reads is safe. Cardio/sport listeners and catalogue/private-override listeners are additional sources outside the instrumented stage list; an empty stage report is not proof a screen has no other work.

## Reproducible controlled observations

- Production `useBioHealth` with a mocked 600-ms bridge read, 20 foreground returns: **20 blank LOADING intervals, p50/p95/max 600/600/600 ms**. This is a controlled dependency delay, not a measured HealthKit query on an iPhone. Initial focus plus 20 returns executes 21 reads. Data stays empty at 599 ms and returns at 600 ms on every repeat.
- Production `loadRoutineViews` with routine/history/mesocycle dependencies of 100/400/300 ms: mesocycle lookup has not begun at 399 ms, begins at 400 ms and finishes at **700 ms**. It is not an 800-ms sum because the first two reads overlap. This proves the critical-path serialization, not a 700-ms user-device benchmark.
- Existing `useRoutines` regression verifies immediate same-owner warm rendering plus revalidation, and no cross-account exposure. This is why a warm tab switch and a restarted process must be measured separately.

Reproduce with:

```sh
npx jest --runInBand src/hooks/__tests__/bioHealth.test.tsx src/services/training/__tests__/routineView.test.ts src/hooks/__tests__/routines.test.tsx src/services/performance/__tests__/loadAudit.test.ts
```

## Device-local diagnostic

A first signed Release smoke run on the **iPhone 18 Pro simulator / iOS 27** yielded the following rounded completions (n=1 for each, no statistical p95 claim): auth-listener restoration 1 ms, local settings 39 ms, routines 169 ms, workout history 169 ms, active mesocycle 210 ms, combined Training home 382 ms, separate draft lookup 169 ms, Bio training context 320 ms. These are actual simulator read completions, not host fake-timer delays or iPhone 13 latency; no cache/server origin is inferred. The 382-ms combined path is consistent with the observed serialized dependencies. Health remained disconnected in the simulator: no fabricated HealthKit latency is reported, and no new permission was requested. Screenshot/accessibility review confirms the diagnostic, large named accent swatches and a shared Sky accent in Settings/Bio/Training. Saved routine icon identities remain their own colours; primary Start uses the app accent.

Profile → Settings → Loading diagnostics displays the last 300 completed spans in this JS process. Reads run exactly as before; there is no polling timer, added network call, background upload or Health permission. Samples contain only a finite stage name, trigger, outcome and monotonic elapsed milliseconds. No owner/document/exercise identity, Health value, error message or wall-clock timestamp is stored. Account changes/explicit clearing invalidate pending spans. Sharing is an explicit user action through the system share sheet; its JSON adds platform, OS and build mode only.

The diagnostic distinguishes mount, focus/refresh and foreground. It reports successful count, median, p95, maximum and error/cancellation count; fewer than 20 successful samples are clearly labelled insufficient for a stable p95. Synchronous work inside an async stage is included, React/native drawing is not. `training.home` includes its child reads, so durations must not be added. No claim of cache/server provenance is made. Unavailable Health with no exception completes its availability check successfully but may have no readings; use the actual Bio state, not a timing sample, to judge availability.

For device acceptance, collect at least 20 comparable warm reopens/focuses on the same Release/device/account/workload; separately record true process restarts with Instruments/App Launch. Test online, offline, slow network, Health locked/unavailable, midnight/date rollover, account switch and permission disconnect. Capture visible-content readiness and native transitions with Instruments/React Profiler alongside the read report. A JS auth span is **not** total native cold launch. No physical iPhone measurement is claimed in this report.

## Priorities after audit

`training.home` names the shared `useRoutines` view-building span; routine/mesocycle/rehabilitation/cardio screens also consume that hook. Compare a fixed route sequence, not mixed workflows, when interpreting those samples. This is not a route-specific time-to-visible-content metric.

The current Health trend window is 42 days and the overnight window is 70 days. Repeating these windows on every foreground event may dominate loading independently of drawing. Stage duration includes bridge availability checks, aggregation and JS scheduling (including suspension if a read spans background time); it is not isolated database/network/HealthKit CPU time. First-render delays and incomplete/pending reads require separate native profiling; the completion-only buffer cannot prove that an unresolved read is fast.

1. Preserve usable same-owner Bio/History content during refresh, with freshness/error states and privacy invalidation.
2. Coalesce routine/history/draft/context reads and remove the avoidable mesocycle dependency barrier.
3. Profile mapping/render commits with representative large histories; paginate History where needed.
4. Introduce owner-scoped startup snapshots only after explicit stale-data/invalidation tests. Do not persist raw or derived Health data as a loading shortcut.

These are proposed follow-up fixes, not changes claimed as implemented by this audit. Existing UI responsiveness benchmarks concern interaction/frame gaps, not Firebase/HealthKit loading; keep those baselines unchanged.

## Delivery validation

Full regression: **2,609 tests / 228 suites pass**, 158.313 seconds (`/private/tmp/vigor-accent-load-audit-regression-final.log`). TypeScript and whitespace checks pass. Accent selection and the bounded timing/summary logic have **100% statements, branches, functions and lines** in the focused coverage run (`/private/tmp/vigor-accent-audit-coverage.log`). Signed Release simulator build and strict signature verification pass. Native review confirms live selection, persistence after app replacement, shared Bio/Training accents, the primary Start fill and light/dark presentation; restore the simulator's original System/Lime preferences afterwards. No physical iPhone update, workout/Health write, commit, push or infrastructure mutation.
