# History-first planning handoff — 2026-11-03

## Delivered scope

- Available, owner-scoped Vigor history is visible inside ordinary cardio and hybrid creation, with distinct loading/error/empty/incomplete states. Empty data is not interpreted as inactivity.
- Vigor and voluntary Apple Health review open in place and preserve the current draft. Opening Health does not authorize or query it; the existing explicit native request remains athlete-controlled.
- Reuse the existing reviewed easy-start algorithm and current-context/tolerance confirmation. Untouched starter defaults are not treated as athlete capacity. Reuse shared availability rather than asking twice; retain manually edited dose limits. Vigor timer observations and Health observations are reviewed separately to avoid double counting.
- Vigor handoff confirms practice values without a Health baseline; Health handoff retains the existing numeric V3 baseline and separate save consent, including the atomic new-hybrid save. Do not infer intensity or assign experience from recordings.
- Boundaries include malformed and inconsistent time records, duplicate/conflicting identities, truncation, staleness, owner/configuration changes, modal cancellation and save retry. Mixed modalities remain manual; no silent modality removal.

## Official documentation checked before changes

- [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/), including its React Native/React compatibility table.
- [Apple HealthKit privacy](https://developer.apple.com/documentation/healthkit/protecting-user-privacy): preserve the existing explicit authorization boundary and do not interpret missing read data as proof of grant/denial or inactivity. Apple's page is JavaScript-rendered; its Markdown link did not render in the web reader. No native Health API/signature or permission scope is changed in this increment.

No new scientific prescription formula is introduced. Existing review rules remain product conventions; see `PRD.md` for their exact eligibility and uncertainty boundaries.

## Verification

- Final full regression: **3,264 tests / 273 suites**, passing in 163.82 seconds. The new `planningHistory.ts` business module has **100% statements, branches, functions and lines**. No coverage thresholds are relaxed.
- TypeScript, whitespace checks, final simulator Release build and strict deep signature verification pass. The final binary is installed only in the iPhone 18 Pro / iOS 27 simulator.
- Synthetic CPU guards all pass. Adapting and reviewing 1,000 validated timer records has p95 **3.25 ms** against 50 ms; joint rhythm is 1.53 ms for eight days and 3.71 ms for 31 days. These are Mac CPU checks, not device query/render/touch latency.
- Automated behavior includes in-place draft retention; unchanged declared NEW status with a reviewed 40-minute start; explicit unknown/tolerance confirmation; no duplicate availability form; manually edited capacity; separate Health/Vigor handoffs; own-record/temporal/duplicate/truncation boundaries; stale owner/configuration/modal callbacks; V3 consent/freshness; changed-review consent reset and atomic-save behavior. Existing native authorization lifecycle tests remain green.
- Final-binary Device Hub acceptance passes on iPhone 18 Pro / iOS 27 in the light theme after the athlete opens the test route. No reinstall interrupts this acceptance. Native controls confirm the NEW cycling profile keeps its selection on sheet cancellation, eight fabricated 40-minute records produce 2 × 40 minutes, the application retains NEW and seeds 80/40-minute cycle/session limits, an injected save failure retains the proposal, and retry returns directly to the memory-only fixture.
- Native empty and failed-history scenarios show distinct messages; retry restores the eight-record summary in the same draft. Empty history does not establish inactivity.
- The hybrid fixture starts from a fabricated strength prescription, not a full strength-generation walkthrough. It confirms one shared eight-day/four-active-day/60-minute availability, explicit fake Health review, a 2 × 40-minute start, direct entry into the single 2 + 2 review, inline strength 3 × 10 @ RIR 2 and actual 5/30/5-minute cardio phases. Expanding cardio closes the strength detail. The native Health bridge in this fixture is fabricated: it grants no real permission and queries no real records.
- Hybrid save is disabled before separate derived-summary acceptance. Reducing cardio from two workouts to one resets that acceptance and disables save again; an unchanged re-review may retain acceptance because the prescription has not changed. After renewed acceptance, injected failure retains the reviewed bundle and retry returns directly to the fixture. Saves remain memory-only; this does not certify actual cloud transactions or external-history completeness.
- Safari's Open dialog is not exposed to the accessibility tool; the athlete handles that one entry. Coordinate control returns `noWindowsAvailable` and one capture attempt reports SCStreamError -3811; native app accessibility subsequently recovers. Neither result is evidence of a locked Mac. Keyboard capture is restored to its original off state after acceptance.

## Follow-up observations, not changed in this acceptance

- Legacy estimate copy still refers to opening a new draft even when embedded in an existing draft. Scope-specific wording and shorter optional explanations need a small presentation follow-up; the tested behavior correctly stays in place.
- Both the standalone two-cardio preview and the fabricated hybrid preview can place the two easy cardio workouts on consecutive days. The current hybrid search bounds active streaks but does not optimize cardio-to-cardio spacing. Track a separate circular-spacing objective alongside the next priority-aware allocation work; this observation is not a claim that consecutive easy sessions are inherently unsafe.
- Large-font/dark-mode/physical-device gestures, actual Health query latency/completeness and actual account persistence remain outside this native acceptance.

No physical iPhone update, infrastructure change, permission acceptance, real athlete test-data write, commit or push belongs to this increment.
