/** Independent axes; passing constraints is not evidence of optimal hypertrophy. */
export const GENERATOR_QUALITY_VERSION = '2.0.0';
export interface QualityFinding {
  code: string;
  severity: 'error' | 'warning';
  actual: number;
  limit: number;
  sessionIndex?: number;
  subject?: string;
  detail?: string;
}

const explanations: Record<string, string> = {
  'empty-session': 'A requested workout has no working sets. Reduce sessions or revise allocation; do not add filler.',
  'underfilled-session': 'Below the product review threshold of 12 working sets, not a physiological minimum. Review distribution and user commitment.',
  'time-overflow': 'Estimated duration exceeds the per-session budget. Time is an estimate, not a promise.',
  'excluded-exercise': 'The prescription contains an exercise outside the supplied available catalogue.',
  'appearance-set-cap': 'Hypertrophy allocation violates the product limit of 1–4 working sets per appearance.',
  'invalid-dose': 'Working sets must be finite positive integers; invalid values cannot pass feasibility.',
  'invalid-duration': 'Session duration must be finite and non-negative.',
  'session-count': 'The generated workout count differs from the requested count.',
  'invalid-session-index': 'Workout indices must be unique non-negative integers.',
  'repeated-exercise': 'An exact exercise identity repeats in the hypertrophy microcycle. Strength-specific repetitions are permitted.',
  'unassigned-sets': 'Selected working sets were not placed in any workout.',
  'set-conservation': 'Distributed plus unassigned sets do not match the selected working-set total.',
  'missing-pattern': 'An applicable foundational movement is missing. This is a programming preference, not a universal physiological requirement.',
  'volume-deficit': 'Attributed volume is at least three sets below the adjusted target. Indirect attribution is a heuristic.',
  'uncapped-volume-deficit': 'Attributed volume remains below the pre-cap target. A squeezed target must not conceal the original compromise.',
  'template-overlap': 'The proposed repeatable rest template leaves adjacent direct exposures. This triggers review, not a claim of inadequate recovery.',
  'sequence-overlap': 'Adjacent or previous-session workloads overlap according to the sequencing heuristic.',
  'torso-hinge-concentration': 'More than one demanding torso-hinge/floor-pull family appears in one workout. Supported hip thrust plus RDL is not this finding.',
  'strength-main-share': 'Main lifts and variants fall below the configured strength-specific 60% share; this is a product specification, not a biological law.',
  'strength-substitution': 'A configured strength main lift is replaced by an available alternative; specificity is reduced.',
  'unbalanced-load': 'Session loads differ materially according to the distribution heuristic.',
  'single-frequency': 'Direct exposure occurs only once despite the distribution preference; frequency is not a universal requirement.',
  'session-volume-cap': 'A muscle exceeds the configured per-session attribution threshold.',
  'focus-without-press': 'A push-labelled session lacks a press despite an applicable requested muscle. Flexible spillover is allowed, but the label/task mismatch needs review.',
  'focus-without-pull': 'A pull-labelled session lacks a pull despite an applicable requested muscle. Review allocation rather than force rigid splits.',
  'focus-without-lower-work': 'A leg-labelled session contains no direct lower-body work despite requested lower-body targets.',
  'beginner-technique-review': 'A beginner receives a technique-demanding exercise. Review support, familiarity and alternatives; this is not a clinical ban.',
  'unsupported-row-concentration': 'Several unsupported rows concentrate torso demand. Review supported alternatives and session dose.',
};

export function explainQualityFinding(finding: QualityFinding) {
  return { ...finding, category: finding.severity === 'error' ? 'feasibility' as const : 'programming' as const,
    explanation: explanations[finding.code] ?? finding.detail ?? `Programming review required: ${finding.code}.`,
    magnitude: { actual: finding.actual, limit: finding.limit },
    basis: finding.severity === 'error' ? 'product-constraint' as const : 'programming-heuristic' as const };
}

export interface ConfidenceFacts {
  selectedExerciseIds: string[];
  missingCriteriaIds: string[];
  unknownStimulusIds: string[];
  unverifiedResistanceIds: string[];
  individuallySourceReviewedIds: string[];
}

/** Evidence confidence reports provenance/completeness, never a made-up confidence percentage. */
export function assessQualityAxes(findings: readonly QualityFinding[], confidence: ConfidenceFacts) {
  const explained = findings.map(explainQualityFinding);
  const hard = explained.filter((i) => i.category === 'feasibility');
  const soft = explained.filter((i) => i.category === 'programming');
  return { version: GENERATOR_QUALITY_VERSION,
    feasibility: { status: hard.length ? 'infeasible' as const : 'feasible' as const, findings: hard },
    programming: { status: hard.length ? 'not-assessable' as const
      : soft.length ? 'review-required' as const : 'no-detected-issues' as const, findings: soft,
      interpretation: 'No detected issues is not proof of good or optimal programming.' },
    confidence: { status: confidence.selectedExerciseIds.length ? 'heuristic-limited' as const : 'not-assessable' as const,
      ...confidence, assumptions: [
        'Criterion ratings are expert ordinal assessments, not trial-derived effect sizes.',
        'Secondary muscle credit uses a fixed 0.5 heuristic, not measured individual stimulus.',
        'Volume landmarks are population-informed starting estimates, not measured personal MEV/MAV/MRV.',
        'Time and rest-template overlap are estimates; neither measures physiological recovery.',
      ] } };
}
