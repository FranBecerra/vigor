# History-informed cardio starting-point POC — 2026-10-30

## Scope

Optional, same-screen, device-memory-only estimate after an explicitly confirmed Health review. Running and cycling are separate. No Health-to-generator transfer, saved baseline, cloud schema, imported workout, new permission, sensor coaching or automatic plan mutation. Existing saved proposal validation and initial-dose heuristics are unchanged.

The immediately preceding read-only Health-review build was compiled, signature-verified, installed in place on the physical iPhone 13 and successfully launched using the project's deployment script. Evidence: `/private/tmp/vigor-cardio-health-iphone-deploy.log`. The athlete, not the agent, is invited to select Health permissions and inspect their records. That installed build predates this POC; do not conflate deployment with real Health-query acceptance or deployment of subsequent source edits.

## Policy and evidence boundary

The archived athlete research `docs/research/cardio-input.md` motivates current-capacity-first easy exposure, separate modalities, tolerance context and avoidance of simultaneous automatic intensity/volume increases. The [original 2025 running cohort](https://pubmed.ncbi.nlm.nih.gov/40623829/) concerns single-session distance spikes and does not validate a duration progression rate, the 28-day window, four-session/three-bin gate, ten-day recency gate or this median-based proposal. All those gates/calculations are disclosed product conventions, not optimal-dose, injury-risk or medical-clearance algorithms. [Apple's HealthKit privacy guidance](https://developer.apple.com/documentation/healthkit/protecting-user-privacy) and [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) are checked before implementation.

- Require resolved valid history, 28 elapsed days of known access, a review no older than 24 hours, current representative-history confirmation, recovered/no-discomfort response and a known comfortable easy duration.
- Use four anchored 7-day observation bins, not calendar weeks or fixed-length training microcycles. At least four eligible sessions across three bins and one ending within ten days are needed. Do not replace absent evidence with inactivity.
- Use medians of active session time and per-bin count/minutes. Scale observed weekly frequency/volume to 7–31-day cycles, floor frequency, then respect session-count, comfortable-time, per-session-time, total-time and observed-volume ceilings. Never round above a ceiling or fill an unavailable minimum.
- Proposed whole-session time includes warm-up and cool-down. Active duration is a conservative whole-session ceiling, not an invented elapsed-time estimate. No pace/distance conversion or measured intensity is inferred.
- Manual/mixed/own/overlap/excluded and unrelated-sport records cannot become automatic modality exposure. Discomfort/poor recovery produce explanations, not a made-up percentage reduction.
- Fresh input hides stale output; changing modality clears modality-specific answers. Changing review selection removes its confirmation and the entire estimate. Read/lifecycle/account clearing remains inherited from the production review hook.

## Verification

Focused service, component/integration and four-language runs pass 57 tests / 4 suites. The new pure starting-point service reaches **100% statements, branches, functions and lines** (`/private/tmp/vigor-cardio-start-coverage.log`). TypeScript passes (`/private/tmp/vigor-cardio-start-types.log`). Cases include malformed/unknown input, stale/future reads, access-window limits, overlap source/exclusion resolution, recency/boundary days, sparse and mixed activity, all availability caps, sub-minute exposure and 8/10/14/31-day cycles.

Final full regression: **2,958 tests / 252 suites**, 152.186 seconds (`/private/tmp/vigor-cardio-start-final-regression.log`). An earlier run concurrent with compilation passed 2,957 tests but hit the existing 5-second timeout in the experience-guide presentation test. Re-running the complete unchanged suite without compilation passes; no timeout/budget is relaxed. TypeScript and whitespace checks remain green.

Final signed simulator Release succeeds (`/private/tmp/vigor-cardio-start-native.log`) and strict deep signature verification passes. Synthetic computation at 1,000 records, five warm-ups followed by 30 measured samples, has p95 **1.93 ms**, maximum **1.95 ms** on this Mac (`/private/tmp/vigor-cardio-start-cpu.log`). This is not actual HealthKit query or physical render timing.

## Device Hub acceptance

On iPhone 18 Pro / iOS 27, use `cardio-health-check` → BASELINE, which injects eight fabricated runs into the real hook/panel and never calls Health:

1. Read, explicitly finish review and expand Estimate starting point. No current answers/result are silently inferred.
2. Calculate without context: explanation, no numeric estimate.
3. Confirm representative records, recovered/no-discomfort response and enter 40 minutes through the compact numeric keypad. Calculate: **2 × 30 min in 7 days**, 60 minutes total, eight reviewed records / 30-minute typical active duration.
4. Change maximum session time to 20 with the same keypad. The former output disappears; calculate gives **2 × 20**, 40 minutes total and the session-time explanation.
5. Select discomfort: calculation withholds all numeric output and gives the corresponding explanation.
6. Select cycling: representativeness/response/comfortable-duration answers reset and the former estimate disappears. Running history is not transferred to cycling.
7. Exclude a reviewed record: confirmation and the entire estimate disappear. Clear returns to the initial disclosure; Back returns directly to Training.

Representative native screenshots show the real form/result with shared Subtle/accent surfaces. Semantic accessibility actions auto-reveal the targeted fields/buttons. These checks do not establish physical gestures, all font/device sizes or real-world coaching safety. No production Health permission/read, athlete record/settings write or history-derived plan synchronization is performed by synthetic testing.

## Athlete-reported real read

The athlete independently accepts the installed review's Health permissions and reports that records appear ("Hecho. Aparecen."). Mark real data availability as athlete-reported, not agent inspection of count/source completeness or measured device-query latency.

## Subsequent POC physical deployment

After the full green verification, `npm run deploy:iphone` builds and signature-verifies the latest POC Release and installs it over the existing iPhone 13 app without uninstall/reset (`/private/tmp/vigor-cardio-start-iphone-deploy.log`). Installation succeeds. The launch check fails specifically with `Locked` / `FBSOpenApplicationErrorDomain 7`. The POC is **installed**, not startup-verified. Ask the athlete to unlock, then retry the existing installed app's launch only. This is not a failed installation, signing trust failure or reason to rebuild. Deployment does not grant Health permissions, inspect records or change an athlete plan.

After the athlete confirms unlock, the launch-only retry succeeds: `Launched application with com.franciscobecerra.vigor bundle identifier.` The POC is now **installed and startup-verified** on the paired iPhone 13. No rebuild/reinstall, permission grant, Health query or athlete write occurs. Only acceptance documentation changes; the previously green 2,958-test verification remains applicable. This does not certify full physical POC usage or real dataset/query-latency correctness.
