# Reviewed Health estimate → new cardio proposal — 2026-10-30

## Scope

Connect the already disclosed running/cycling starting estimate to a new draft of the shared cardio generator. No automatic change to active routines, no new Health read/permission and no infrastructure/rules deployment. Routine system emoji and fixed accent-derived backgrounds are recorded as **pending**, not implemented in this increment.

Official references checked before implementation: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), its Router API and [Apple HealthKit privacy](https://developer.apple.com/documentation/healthkit/protecting-user-privacy). The earlier archived cardio research and starting-point policy remain applicable; this is not a new scientific dose-validation claim.

## Contracts

- Recalculate on explicit Use; only a whitelisted numeric summary/context/dose and observation/application times travel. Raw workouts, UUIDs, source names/IDs, individual dates, routes/distances, pulse traces and symptom answers do not.
- Clear raw observations before opening the draft. No Health-derived navigation parameters, settings, analytics or logs. The deliberately opened numeric draft can remain in memory across backgrounding; cancel/unmount/auth unresolved/owner round trips remove it. Do not reread Health automatically.
- Reuse `CardioPlanFlow` and the existing builder. Cancelling a Health-origin draft returns directly to the empty originating review; it does not detour through History or an extra generator route.
- Separate approved initial dose from available future capacity. Keep reviewed modality/cycle fixed; allow lower initial count/time. Larger availability does not raise the initial dose. Experience stays explicitly declared/unknown, and quality tolerance remains unknown. Removing the reviewed basis resets derived capacity defaults instead of retaining unlabelled Health-derived inputs.
- Add `CARDIO_PREVIEW_V3`, strict numeric `healthBaseline`, versioned `healthPlanningConsent` and additive `REVIEWED_HISTORY` prescription basis. Reconstruct old V1/V2 unchanged; existing frozen fixture remains readable. Activation and later reviewed progression remain separate explicit actions.
- Save is gated by a separate initially unchecked private-account synchronization disclosure. Edits invalidate acceptance, failed unchanged saves retain it for retry, and the pure constructor also rejects missing acceptance. Saved historical records do not expire because of the wall clock.
- Test-only native fixture saves use the pure constructor in memory, never an account write. Physical athlete records and permissions are not part of agent-side E2E.

## Verification

- Full regression: **3,006 tests / 254 suites**, exit zero, 147.408 seconds (`/private/tmp/vigor-reviewed-plan-final-regression.log`). TypeScript passes (`/private/tmp/vigor-reviewed-plan-types.log`).
- Focused flow/service/localization acceptance: **61 tests / five suites**; `reviewedCardioStart` has **100% statements, branches, functions and lines** (`/private/tmp/vigor-reviewed-plan-final-coverage.log`). Includes formula/caps, malformed or extra fields, expiry, legacy snapshots, ownership round trips, explicit consent, unchanged failed-save retry, cancellation and detached prescriptions. Existing starting-policy tests retain non-seven-day coverage.
- Signed Release simulator build succeeds (`/private/tmp/vigor-reviewed-plan-native.log`); strict deep signature verification passes. No physical iPhone update is performed.
- Device Hub on **iPhone 18 Pro / iOS 27 simulator** verifies eight fabricated 30-minute runs, explicit review/current-context entry with the compact keypad, and a **2 × 30-minute / seven-day** estimate. Use opens the real builder with the reviewed modality/cycle bounded. Cancel returns directly to the cleared review, not History. Repeating the flow retains **40 minutes/session and 80 minutes/cycle availability**, while previewing only **60 minutes of initial dose** with its reviewed-history source.
- With a fabricated proposal name, native Save remains disabled before the separate acceptance control and becomes enabled after it. The synthetic handler successfully constructs the versioned proposal **in memory only**, visibly confirms no account write, and returns through the empty review to Training. Representative screenshots confirm shared Subtle/accent surfaces. These semantic accessibility checks do not certify physical gestures, all screen/font sizes, actual Health data quality or real cloud persistence.
- An initial regression attempt exposed an empty test-suite collection error because a shared fixture was placed under `__tests__`. Move it to `src/testing/cardioReviewFixture.ts`; the final complete suite above passes. No test timeout or performance budget is relaxed.

The physical athlete's permissions, records and account are untouched. Raw Health imports, interval programming, complete hybrid unification, and the requested routine emoji/accent-background follow-ups are not implicitly delivered by this scoped acceptance.
