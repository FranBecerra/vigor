# Training generator redesign audit — 2026-11-03

## Scope

Training takes priority; further Bio work is paused. Preserve all pre-existing changes in the working tree. No infrastructure mutation, real athlete/Health test write, new permission, physical iPhone installation, commit or push.

## Findings and decisions

1. **Availability was duplicated.** Hybrid setup asks a total cycle budget and workout ceiling, strength asks duration again, and cardio asks its own limits. The approved replacement is one training-day count plus a per-workout ceiling, with optional strength/cardio doubles. The athlete confirms that 60 minutes means up to 60 for each separate workout, not the combined day. UI/legacy-budget mapping remains pending; old totals must not silently change meaning.
2. **Default names used the requested split.** This could contradict actual mixed sessions. New names use the same presented-focus classification as the generated prescription. Canonical full-body, upper/lower and push/pull/legs stay concise; other rosters expose their actual focus counts. Explicit user names and existing uniqueness rules remain authoritative.
3. **Current duration was underused.** Starter suggestions capped non-REGULAR profiles at 25 minutes, while the mounted editor initially retained 20 until a separate suggestion action. A declared current comfortable 40-minute duration now seeds an untouched editor to 40 even with NEW status. Manual edits and explicitly reviewed Health bounds remain authoritative. Unknown duration still uses the existing 20-minute fallback. The new 40-minute suggestion ceiling is an editable product policy, not evidence of an optimal dose.
4. **History is available but not integrated into normal creation.** The existing voluntary Health review, provenance and explicitly accepted new-draft transfer work through a separate path. Ordinary hybrid creation does not automatically review those records. The user's criticism is valid. Next: review current local/Health exposure in the normal flow, distinguish unavailable/limited history from no training, confirm current representativeness and retain explicit permissions/derived-summary save consent. No automatic permission grant or real Health query was performed here.
5. **Priority is not a dose optimizer.** The bounded hybrid implementation records same-day order guidance only. Changing priority can leave identical prescriptions because it does not change dose allocation. A future objective must arbitrate feasibility and adaptation priorities explicitly; different priorities need not force different output when no constraint binds.
6. **Strength is frozen before cardio placement.** Relative-day search now improves the new combined rhythm but does not change strength leg frequency, exercise selection or sets. Truly joint composition remains required; do not describe this search as the completed integrated generator.
7. **Six active days can be a scheduler artifact.** A synthetic eight-day/four-strength/two-cycling case originally produces six consecutive active days; bounded joint placement reduces its longest circular run to three while retaining every requested workout, dose and within-strength order. Coverage and high-demand proximity rank before visual rest spacing. Long cycles use bounded refinement, not a global optimum. This is not the athlete's exact saved proposal or proof that every six-day sequence is unsafe.
8. **The overview is duplicated and cannot inspect strength.** Three interactive, fabricated alternatives compare a vertical agenda with detail sheet, inline expandable days and visible exercise previews. All include both disciplines in one final review. Production selection/implementation is pending; the mockups do not save plans.

## Delivered bounded changes

- Completed exercise rail: accent state without extra tick; accessibility and undo behavior retained.
- Emphasis grid: smaller tiles/thumbnails with the existing accessible single-column fallback.
- Truthful mixed-roster default names, preserving manual names and uniqueness.
- Current-duration starter seeding, without overwriting later manual edits.
- `suggestHybridRhythm`: bounded/cancellable deterministic search over undated strength placements only; availability/doubles/active-day constraints retained; yields every eight evaluations. Manual placements are not silently redistributed. Input/source changes and exit invalidate pending results.
- Three inspectable summary alternatives, not a committed production layout.

## Evidence interpretation

The supplied research is retained at `docs/research/cardio-input.md`. Official/primary sources checked on 2026-11-03:

- [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/), before source edits.
- [Schumann et al., concurrent-training systematic review/meta-analysis](https://pubmed.ncbi.nlm.nih.gov/34757594/) and [full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC8891239/): no average attenuation of maximal strength/hypertrophy in the included evidence, with a small explosive-strength effect and relevant same-session subgroup uncertainty. This does not validate one universal 48-hour spacing threshold for every athlete/session.
- [Frandsen et al., running-distance cohort](https://pubmed.ncbi.nlm.nih.gov/40623829/): supports considering single-session exposure changes rather than treating a universal weekly 10% increment as an established safety rule. Observational association is not a personalized prescription formula.
- [WHO physical-activity guidance](https://www.ncbi.nlm.nih.gov/books/NBK566046/?report=printable): population-level health targets are not an individualized first-session dose or proof that every beginner should start at 20 minutes.

The existing generator is an easy-duration foundation plus reviewed duration progression. It does **not** yet provide a complete modality-specific, history-first, priority-aware joint prescription. Current repeatable exposure, adherence, effort and symptoms must guide later reviewed progression; avoid claiming that every product heuristic has been clinically validated. Relative date spacing does not establish elapsed-hour recovery.

## Verification

- Full regression: **3,220 tests / 267 suites**, all passing in 182.759 seconds. Both new business modules (`hybridRhythm.ts`, `generatedStructureName.ts`) have **100% statements, branches, functions and lines**, without relaxed thresholds.
- Component tests cover default redistribution, preservation of manual placements, explicit redistribution, current-duration seeding/manual retention and rejection of an older asynchronous result after availability changes. Pure tests cover 7/8/10/14/31-day cycles, coverage/proximity ranking, cycle-boundary streaks, missing/invalid sources, bounded yielding and cancellation.
- TypeScript and whitespace checks pass. Final simulator Release compilation and strict deep signature verification pass.
- Synthetic CPU guard passes: joint rhythm p95 **1.46 ms / 8 days** and **3.35 ms / 31 days**, each against 50 ms. Existing dense 248-day progression/capacity guards also pass. CPU measurements on the Mac do not certify physical touch latency.
- All three summary alternatives render in the local preview. Semantic interaction checks verify the agenda's strength detail/close, expandable leg exercises and cardio phases, and the third alternative's visible exercise previews. No prototype action saves a plan.
- Scoped native acceptance passes on the final signed simulator Release (iPhone 18 Pro / iOS 27): the athlete manually clears Safari's inaccessible Open confirmation; all subsequent checks use Device Hub accessibility. A fabricated NEW cycling profile with current comfortable duration 40 seeds 40 minutes/workout and 80 minutes/cycle, without pressing the suggestion button. A manual reduction to 35 produces two workouts totalling 70/80 minutes with the new redistribution notice. Returning through profile and availability retains 35 rather than reseeding 40. Cancellation confirms and returns directly to the memory-only fixture without saving. The native fixture uses two synthetic strength sessions, not the exact four-strength six-day-streak unit-test reproduction. The compact emphasis grid and tick removal have automated behavior checks but are not visually certified by this native cardio flow. Physical gesture/device acceptance remains separate.

Automated tests do not certify physical gestures, actual Health completeness, all-device support or real athlete outcomes. No physical iPhone update or real account/Health test write was performed.
