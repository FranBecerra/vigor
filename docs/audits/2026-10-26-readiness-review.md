# Bio Readiness: Code, Evidence and Feasibility Review

Date: 2026-10-26. Status: diagnostic review and proposed direction, not activation approval.

## Outcome

Keep the existing personal-range prototype separate from production readiness. The useful next step is not simply adding more biomarkers: standardize overnight observations, distinguish acute changes from trends, assess coverage, and combine general recovery context with the demands of the proposed workout. A transparent experimental 0–100 index is feasible, but it would be a product model to evaluate, not a measured percentage of recovery or a validated injury/performance probability.

This review changes documentation only. It does not implement a scoring formula, request Health permissions, inspect the athlete's Health records, change training, install an app, or start cardio implementation. Bio completion remains ahead of cardio delivery. The optional questionnaire remains once per observed microcycle, not a compulsory daily form.

## 1. What actually runs

- `src/services/bio/readinessEvidence.ts` exports `previewReadinessEvidence`. Only the authenticated synthetic `bio-check` fixture imports it; the real Bio home still displays readiness as pending.
- The three current automatic inputs are sleep duration, HealthKit resting heart rate and HRV SDNN. The native reader and trend builder keep selected-source observations in memory, excluding manually entered values and preserving missing-data/error states.
- The prototype compares the latest sleep reporting day and the median of observed cardiac days in the recent seven-calendar-day window against personal 10th–90th percentile bands from the preceding 28 calendar days. It requires 14 baseline days per metric, three recent cardiac days and a latest observation within 36 hours.
- Its output counts changed signals. Any insufficient required metric makes the aggregate insufficient. There is no number, weighting, workout-load input, performance input, survey input, or automatic prescription change.
- `src/models/readiness.ts` and the repository export are legacy scaffolding, not evidence that a numerical coach is working. Existing dose-response review and performance series are separate services, not inputs to this prototype.

## 2. Findings in the current prototype

| Finding | Consequence | Proposed correction, not implemented |
| --- | --- | --- |
| Cardiac samples are grouped by calendar day, not matched to the sleep episode | Measurement context can vary between days; daytime and nocturnal SDNN need not describe the same conditions | Use an explicitly recorded overnight protocol, with same-method/source comparisons |
| Seven-day cardiac medians are the only recent cardiac signal | A new adverse night can remain invisible behind six ordinary days | Show last-night deviation and a separate multi-day trend; do not replace trend monitoring with an isolated value |
| A seven-day summary is compared with the distribution of individual baseline days | Those distributions have different variability; band crossing is not a calibrated alert rate | Evaluate nightly and rolling-summary thresholds against matching baseline constructions |
| Outside-range changes are symmetric | Longer sleep and lower pulse are counted as changes just like their opposites | Separate statistical deviation, likely adverse direction and uncertain interpretation; never assume unusually high HRV is always beneficial |
| Usual sleep is the only sleep reference | Habitually short sleep can appear ordinary | Keep observed baseline separate from an explicitly chosen sleep goal and recent shortfall; neither proves physiological sleep need |
| Coverage is principally days and freshness | A sparse night and a well-observed night can be treated alike | Preserve sample count, duration, distribution, gaps, source and protocol quality |
| One missing core metric invalidates the aggregate | Useful remaining observations can be obscured if the UI treats the whole day as empty | Keep available components visible; any future reduced-input mode must have its own label and comparability rules |
| Source identity includes software version and selection is automatic | Updates or a newly active source may fragment history or change reference provenance | Surface baseline/source transitions; do not silently pool methods or assume software-version compatibility |
| Test coverage is high but only synthetic correctness is checked | Passing tests do not establish predictive usefulness | Add prospective evaluation against session outcomes, beyond numerical unit tests |

The seven-day window itself is not a defect. [AIS guidance](https://www.ausport.gov.au/ais/position_statements/heart-rate-variability) supports standardized HR/HRV observations, lnRMSSD and multi-day interpretation with contextual information. It does not validate Vigor's percentile/counting rule, nor establish one universal optimal reference window. The gap is treating the existing trend-only detector as a complete same-day readiness model.

## 3. What Bevel publicly describes

[Recovery documentation](https://help.bevel.health/en/articles/11258177) describes a morning 1–100% composite using sleep, HRV, resting pulse, temperature, respiration and oxygen saturation. These are Bevel's product claims, not evidence that each input independently improves prediction of lifting readiness.

[Calculation settings](https://help.bevel.health/en/articles/10431233) describe default overnight HRV, RMSSD support and a pulse estimate derived from samples in a chosen window. RMSSD can use beat-to-beat data and, on supported newer configurations, native Recovery HRV. This differs from Vigor's current daily SDNN and Apple resting-pulse summaries.

[Common questions](https://help.bevel.health/en/articles/11257601) describe a 60-day personal comparison reference, calibration over two to six weeks, and a sleep component incorporating duration versus sleep need plus available continuity, stages and heart-rate features. The reviewed pages do not give reproducible weighting, transformations, missing-input rules or a peer-reviewed validation of the complete Recovery Score. This is not a claim that no undiscovered validation exists.

Bevel also separates [cardiovascular and muscular strain](https://help.bevel.health/en/articles/10577601). Its [training-load view](https://help.bevel.health/en/articles/14206721) compares seven-day work with six-week history. Take the separation of domains as a useful design reference, not its labels as diagnoses. Do not reproduce an overtraining or injury-risk conclusion from a load ratio: [Impellizzeri et al.](https://pubmed.ncbi.nlm.nih.gov/32502973/) explain important causal and statistical limitations of ACWR.

## 4. Metrics worth using

### First priority: better observation of the existing domains

- **Sleep:** last sleep episode, recent duration shortfall relative to the athlete's stated goal, timing regularity, and continuity when the source supports it. Support naps and shift-work/daylight-saving boundaries explicitly. Do not make REM/deep minutes the main determinants: a [35-person Apple Watch Series 8 validation](https://pubmed.ncbi.nlm.nih.gov/39460013/) found stage-specific biases despite reasonable total-duration estimation. That study does not validate every later watch/software version.
- **Cardiac context:** overnight pulse and standardized HRV; retain nightly observations plus a recent trend. Prefer a validated consistent acquisition protocol over changing the HRV statistic solely because its name is newer. lnRMSSD is a candidate for within-method analysis, not an SDNN conversion.
- **Actual strength response:** load/repetitions at comparable reported RIR, context/setup, exercise order, supersets, exposure dates and local recovery reports. Existing `bioPerformanceSeries` is a useful starting point; it is retrospective, not a direct pre-workout strength test. Missing actual effort remains unknown.
- **Actual cardio response, later:** duration, modality, intensity, pace/power under comparable conditions, HR response and optional whole-session effort. Environmental conditions and sensor quality affect comparability.

### Optional contextual additions

- **Respiratory rate and wrist temperature:** useful candidate flags for a joint departure from the athlete's usual overnight pattern. They should not diagnose infection, and temperature can change with environment, travel or menstrual cycle. Do not require sensitive cycle data or penalize a normal pattern without consent/context.
- **SpO₂:** optional contextual display, not a mandatory high-weight readiness input. Availability and measurement quality vary; an ordinary value is not clearance to train or exclusion of a sleep/respiratory problem.
- **Session effort:** optional at finish, distinct from per-set RIR and the microcycle review. A duration × session-RPE summary provides perceived internal-load context, not a conversion between running impact and lifting sets. [Foster et al.](https://pubmed.ncbi.nlm.nih.gov/11708692/) provide the original cross-activity monitoring research. Persist collection timing and actual training duration; the current start-to-finish wall-clock duration may include interruptions. An immediate finish rating is not identical to the original delayed protocol.

VO₂max belongs in longer-term fitness evolution, not as a daily recovery input. Calories and steps can describe activity but should not certify muscle recovery. Heart-rate recovery after exercise requires a comparable effort/recovery protocol before interpreting longitudinal changes. No laboratory marker or maximal test is required for the initial Bio product.

## 5. Proposed Vigor model

Keep three outputs distinct rather than averaging everything into a single authoritative number:

1. **General recovery context:** sleep and autonomic observations, with optional contextual vitals. Automatic, dated and explainable.
2. **Evidence quality:** baseline coverage, freshness, measurement protocol and gaps. Display a qualitative data-quality label, not an invented probability that the score is correct. Missing inputs are neither bad recovery nor zero.
3. **Session suitability:** match the intended workout to recent local muscular exposure, actual performance, relevant cardio load and dated feedback. The same general recovery estimate may support easy cycling but warrant reviewing another demanding leg session.

A numerical presentation is feasible after policy review. The candidate process is source/protocol validation → personal deviation analysis → explicit sleep shortfall and recent trend → transparent general-recovery index → separate session-context recommendation. Prototype fixed, published, versioned component rules first. Avoid double-counting correlated HRV and pulse as independent votes, prevent favorable components from hiding a substantial adverse component, and never let a high score cancel pain or concerning symptoms. No exact weights, score cutoffs, or action magnitudes are approved here. A 0–100 index is not a recovery percentage or directly comparable across people, methods or reduced-input variants.

Reference histories should be slowly adapting and inspected across loading/unloading, with explicit recalibration after acquisition changes. Compare shorter and longer reference windows prospectively rather than claiming that 28 or 60 days is biologically optimal. Do not silently redefine prolonged poor sleep or a persistent adverse pattern as successful recovery because it becomes common.

The retrospective microcycle review contributes to longer-term tolerance and dose review, not a fabricated fresh daily answer. Whole-session effort, if added, is an independent optional observation. No mandatory morning questionnaire is proposed.

## 6. Strength and cardio integration

**Strength now, by proposal only:** preserve planned progression unless a reviewed recommendation is accepted. Assess repeated performance at comparable effort and local tolerance. An isolated low-HRV observation should not reduce every muscle's volume, while a favorable score should not automatically add sets or lower RIR. Small laboratory studies found dissociation between autonomic and neuromuscular recovery: [Heart Rate Variability, Neuromuscular and Perceptual Recovery Following Resistance Training](https://pmc.ncbi.nlm.nih.gov/articles/PMC6835520/) and [Profiles of Heart Rate Variability and Bar Velocity after Resistance Exercise](https://pubmed.ncbi.nlm.nih.gov/32079921/) support keeping these domains separate. Their specific protocols do not establish the same recovery course for every athlete.

**Cardio later:** make readiness one input to timing demanding versus easy sessions, alongside symptoms, performance, load and available time. A [40-runner trial](https://pubmed.ncbi.nlm.nih.gov/26909534/) supports investigating HRV-guided timing of vigorous work, but does not validate a Bevel-like composite or a universal rule for all modalities.

**Hybrid planning later:** preserve separate cardiovascular and local mechanical loads, then protect the athlete's declared priority when arranging sessions. Do not equate a run with a number of quadriceps sets or assume cycling removes interference. [Schumann et al.](https://pubmed.ncbi.nlm.nih.gov/34757594/) found that explosive-strength adaptation was more affected by concurrent work within one session; this does not establish a universal 24/48-hour ban on cardio around legs. Any rescheduling must respect available days/time, retain completed history and explain the tradeoff. Readiness never promises to prevent interference.

Example, illustrative rather than a rule: sleep/cardiac context is ordinary, but recent leg work and repeated local non-recovery favor maintaining an upper-body session while reviewing the next hard run. Conversely, poor general context with no local issue could prompt an easy-session alternative, not an automatic whole-block deload.

## 7. Implementation feasibility and acceptance gates

- **Reuse now:** native Health module, consent settings, local owner isolation, history loaders, performance context and microcycle reviews. No new server or paid vendor is necessary for a local calculation. Current Health data remain memory-only; historical score persistence would be a separate privacy/schema decision.
- **Moderate native extension:** request separate read types for overnight heart-rate samples and optional respiration/temperature; preserve consent minimization. Retain sufficient sleep-episode timing and quality metadata before aggregation instead of trying to recover it from daily totals. [Apple authorization documentation](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data) requires per-type permission and does not reveal individual read denial.
- **RMSSD requires a compatibility spike:** Apple's official [`heartRateVariabilityRMSSD`](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/heartratevariabilityrmssd) declaration lists iOS/watchOS 27 availability, but currently provides no measurement-protocol detail. Do not assume all compatible watches write useful samples. Where native data are unavailable, [`HKHeartbeatSeriesQuery`](https://developer.apple.com/documentation/healthkit/hkheartbeatseriesquery) can expose beat times and gap flags. Derived RMSSD would require artifact/gap rules and validation; do not compute it from sparse BPM samples or convert aggregate SDNN. Keep native RMSSD, derived RMSSD and SDNN references separate until equivalence is demonstrated.
- **Optional sensors:** Apple documents [`appleSleepingWristTemperature`](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/applesleepingwristtemperature) as a read-only, nightly aggregated wrist measurement on supported hardware, affected by several contextual factors. It is not core temperature. [`respiratoryRate`](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/respiratoryrate) is separately available in HealthKit. Verify actual source coverage on consented devices before promising these features.
- **Longer references:** a 60-day baseline plus a separate recent window cannot fit the existing 42-calendar-day reader/45-day native limit. Change this boundary intentionally, with bounded queries, sample caps, memory/performance tests and partial-failure handling; do not merely change the scoring window.
- **Required new observations:** explicit whole-session effort and training-duration semantics are not present in the current `WorkoutSession` schema; richer cardio response is future work. Do not infer these from target RIR, calories or a legacy model field.
- **Correctness tests:** abrupt adverse night among ordinary days; persistently short sleep; large-but-uncertain HRV; identical baselines/zero spread; sparse samples and consecutive missing nights; source/software/method changes; overlapping sleep/naps/shift work; daylight-saving/travel; stale/future values; read errors/truncation/limited-history access; account changes; corrected/discarded history; advanced set types; inherited versus reported RIR; unequal microcycles; duplicate external workouts; no automatic changes from missing inputs.
- **Prospective usefulness:** run a versioned observational period without changing prescriptions. Compare a richer model with simpler sleep-only and sleep-plus-cardiac models on later comparable session outcomes. Use chronological holdout, avoid future information, measure false warnings and missing-data rates, and evaluate whether added sensors improve decisions. Do not evaluate an adjusted workout as if it were the unmodified planned-session outcome. Unit tests validate implementation, not physiology or injury prevention.

## Boundaries

This is a targeted technical/product review, not a systematic literature review or medical diagnostic model. Findings from small studies, specific hardware and morning ECG/strap protocols do not establish identical performance for passive Apple Watch overnight estimates. No single biomarker or score diagnoses overtraining; the [ECSS/ACSM consensus](https://pubmed.ncbi.nlm.nih.gov/23247672/) treats persistent maladaptation and competing explanations as a broader assessment.

## Verification

Documentation-only review. The unchanged application passes `npm test -- --runInBand`: **189 suites / 2,150 tests**, exit code zero, 142.878 seconds. `npx tsc --noEmit` also exits successfully. No new algorithm or acceptance test is claimed; these checks confirm regression status, not predictive validity of readiness. Native/device behavior and consented real-data coverage were not exercised in this review.
