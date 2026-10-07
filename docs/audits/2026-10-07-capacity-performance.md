# Capacity recommendation performance and staged-generation roadmap

## Decision

Preserve recommendation quality/semantics while removing redundant work. Do not use an approximate cheap selector to shortlist plans: it could silently exclude the exhaustive winner. Keep a callable exhaustive reference and prune only conditions that make qualification impossible under the existing contract.

User-approved roadmap: short sequential configuration steps; AUTO recommended; an optional Decide for me checkbox runs recommendation when the user submits the completed form. Follow it with actual plan generation and the existing editable preview. That wizard is future work; the current button uses the optimized service now. Animation must reflect real work and must not impose minimum waiting time or pretend to infer biological recovery.

## Implementation

- The grid still contains 15 capacities and three fixed seeds. All potentially qualifying capacities retain the same complete three-seed statistics and original ranking.
- A shared three-minute working-set planning floor gives a provable optimistic dose bound for qualification only. If even this bound is below the goal/level's starting minimum, skip qualification. This is a bound within the current duration model, not a physiological statement or the approximate UI capacity hint.
- Stop a capacity's qualification sample sequence after a time-limited/non-recovery result or an empty session. Every sample must pass the original qualification contract, so later samples cannot rescue that candidate.
- If nothing qualifies, evaluate the remaining samples across the entire grid and preserve the original maximum-dose/minimum-commitment fallback. Reuse earlier partial samples; no candidate/seed pair is computed twice. Bodyweight and empty catalogues still return their original limited result.
- Identical full rounded volume plans and selection-mode inputs share a local evaluation inside `planWithPolicy`. The cache does not survive the invocation, so mutable catalogues, historical input changes and caller edits cannot leak across requests. The full plan is the cache key, not just total set count or a coarse squeeze fraction.
- A generator iterator supports synchronous callers and an asynchronous UI wrapper. The latter yields to the event loop before each complete plan, checks cancellation before/after computation and propagates real errors. It is cooperative JS scheduling, not a worker; a single plan can still hold the JS thread until it completes.
- Settings or phase changes/unmount cancel the UI task and prevent stale results overwriting the form. Other generation actions are disabled during active recommendation. Existing ActivityIndicator remains the loading visual; error text allows retry. No artificial animation delay was introduced.
- Capacity copy in EN/ES/FR/JA now describes estimated budgets and tested alternatives, removing claims that the app knows personal recovery or that more training necessarily produces no adaptation. The legacy `reachesRecoverableVolume` field stays unchanged for compatibility; it is not a biological measurement.

## Evidence and benchmarks

`scripts/benchmark-capacity.ts` runs ten profiles: all three levels × both goals, back/triceps priority, advanced bodyweight, empty catalogue, and PPL biceps priority. Input catalogues and outputs are identical before/after; no selection quality is traded for latency in this paired sample.

| Profile | Before (ms) | After (ms) |
|---|---:|---:|
| Beginner hypertrophy | 2,040 | 366 |
| Intermediate hypertrophy | 12,347 | 2,388 |
| Advanced hypertrophy | 15,322 | 1,863 |
| Intermediate back/triceps | 10,637 | 2,014 |
| Intermediate PPL/biceps | 11,922 | 2,078 |
| Beginner strength | 81 | 77 |
| Intermediate strength | 87 | 69 |
| Advanced strength | 65 | 43 |
| Advanced bodyweight | 214 | 191 |
| Beginner empty catalogue | 5 | 6 |

These are individual synchronous Node/Mac runs, not distributions of repeated timings, Hermes/iPhone benchmarks or latency guarantees. Scheduler overhead and production-device response need separate measurement. Small millisecond differences are not meaningful speedup claims.

Before/after JSON: `/private/tmp/vigor-capacity-before-20261007.json` and `/private/tmp/vigor-capacity-after-20261007.json`. Reproduce with `node --import tsx scripts/benchmark-capacity.ts OUTPUT.json` at each engine revision. Further optimization must preserve these paired outputs and the exhaustive-ranking contract.

## Verification

Forty deterministic mocked scenarios compare fast versus exhaustive ranking, including structure tolerance and tie behavior. Tests verify impossible-dose pruning, short-circuiting, exact fallback without duplicate work, initial/between-plan cancellation, default scheduling and error propagation. Cache tests verify unique evaluation keys, fresh calls after output mutation, and in-place catalogue replacements. Real generator recommendation tests retain both goals, all levels, full/limited/empty catalogues and manual splits.

Full generator comparison against `/private/tmp/vigor-completed-20261007.json.gz` runs 3,575 identical inputs. Its purpose here is to demonstrate that evaluation reuse changes runtime, not prescriptions or quality. Existing three 12-set seed sensitivities remain open; this optimization does not claim to fix allocator/sensitivity/catalogue debt.

Official platform references consulted before changes: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) and [React Native timers](https://reactnative.dev/docs/timers). Timers do not move synchronous computation to a background thread.

Final validation: **1,088 tests / 62 suites pass**, and `npx tsc --noEmit` passes. All **3,575 paired generator prescriptions are unchanged**, with no detected regression, crashes or unexpected infeasibility. The audit still exits 1 for the same three known 12-set seed sensitivities; this is not a new performance-change failure. Physical-device responsiveness and animation remain unverified. No dependency/native rebuild, deployment, signing, infrastructure mutation or commit is included.
