/** Diagnostic review ledger. It does not change eligibility, scores or selection. */
import { COMPOUND_VECTORS, Equipment, ExerciseProfile, MovementVector, type Exercise } from '@/models';
import { CRITERIA_KEYS } from './exerciseCatalogue';
import { GUIDE_EXISTING_IDS } from './guideExerciseCatalogue';
import { tricepsSourceReview, tricepsCriterionBands } from './tricepsSourceReview';
import { bicepsSourceReview } from './bicepsSourceReview';

export interface CriterionEvidence {
  confidence: string;
  citations: readonly string[];
  note: string;
}
export type EvidenceLedger = Record<string, Partial<Record<typeof CRITERIA_KEYS[number], CriterionEvidence>>>;

/** Source descriptions were read in full for these specific findings. */
export const VERIFIED_GUIDE_FINDINGS: Readonly<Record<number, { code: string; finding: string; fix: string }>> = {
  120: { code: 'attribution-review', finding: 'Rack pull is hip extension with substantial isometric trunk/upper-back work; MID_BACK direct credit is not established.', fix: 'Review dynamic versus isometric muscle credit and rack height before changing the primary attribution.' },
  159: { code: 'movement-mismatch', finding: 'The source specifies shoulder extension with the elbow held fixed, rather than horizontal abduction.', fix: 'Use SHOULDER_EXTENSION; retain rear-delt intent and review setup-specific secondary credit.' },
  277: { code: 'equipment-mismatch', finding: 'Stir the pot requires a fitball; BODYWEIGHT alone does not describe availability.', fix: 'Use STABILITY_BALL and retain load-progression uncertainty.' },
  283: { code: 'taxonomy-gap', finding: 'Wood chopper uses active trunk rotation; CORE_ANTI_MOVEMENT describes a different action.', fix: 'Introduce a dynamic trunk-rotation vector with search, injury-veto and swap compatibility tests.' },
  305: { code: 'equipment-mismatch', finding: 'The described clam shell uses a miniband.', fix: 'Use BANDS for the described variant; an unloaded variant needs a separate identity.' },
  311: { code: 'equipment-mismatch', finding: 'Monster walks explicitly use a miniband.', fix: 'Use BANDS; retain the warm-up/limited-progression role rather than assuming a main hypertrophy exercise.' },
  317: { code: 'required-support-missing', finding: 'The glute-focused GHR needs a GHD or similar support even when external loading is bodyweight.', fix: 'Represent required apparatus separately from resistance implement; do not substitute an arbitrary machine.' },
  347: { code: 'equipment-mismatch', finding: 'Kneeling leg extension is performed kneeling on a mat without a machine; optional external loading is described.', fix: 'Use BODYWEIGHT for the base variant; model optional loading separately.' },
  367: { code: 'equipment-mismatch', finding: 'Slide leg curl requires sliders/towels and a suitable floor, not a machine.', fix: 'Use BODYWEIGHT and record required sliding surface/support.' },
};

const approach: Partial<Record<MovementVector, string>> = {
  PUSH_HORIZONTAL: 'Resolve press angle and elbow path; attribute triceps/front-delt work provisionally. Bench support does not establish a universal resistance-profile score.',
  PUSH_VERTICAL: 'Resolve bench angle and arm plane; account for triceps credit and setup stability. Shoulder-press variants are not interchangeable with every chest press.',
  PULL_HORIZONTAL: 'Resolve humeral path, scapular motion and chest support. A row name alone cannot distinguish lat versus mid-back stimulus precisely.',
  PULL_VERTICAL: 'Resolve humeral adduction/extension, grip and torso support. Biceps credit is an estimate, not an exact fraction for every grip.',
  HIP_DOMINANT: 'Separate free-torso hinges, floor pulls, supported hip thrusts and supported extensions. Shared hip extension alone is insufficient to establish redundancy.',
  KNEE_DOMINANT: 'Resolve knee/hip excursion, support and individual proportions; review glute/adductor credit. Do not treat all squat/press variants as the same dose.',
  UNILATERAL_KNEE: 'Resolve external hand support, stride and torso angle before assessing stability or quad/glute emphasis.',
  ELBOW_FLEXION: 'Record shoulder angle, forearm orientation and actual cable direction. A lengthened muscle position does not establish high torque in that position.',
  ELBOW_EXTENSION: 'Record shoulder angle and resistance direction; distinguish overhead and arm-at-side execution. Compound pressing credit may not replace all direct work.',
  SHOULDER_HORIZONTAL_ADDUCTION: 'Record humeral path and implement geometry. Machine cam and individual setup determine torque; machine identity alone cannot justify a 5/5 profile match.',
  SHOULDER_ABDUCTION: 'Record arm plane, support and pulley height. Do not assume every cable setup loads the bottom equally or every raise has the same usable ROM.',
  ANKLE_PLANTAR_FLEXION: 'Record knee angle and available dorsiflexion; calf and soleus contributions differ. Progressability depends on the actual implement.',
  SCAPULAR_ELEVATION: 'Distinguish upper-trapezius loading from cervical flexion/extension; the current NECK bucket mixes different tissues.',
  SPINAL_EXTENSION: 'Determine whether execution moves the spine, the hip, or both before assigning erector versus glute/hamstring direct work.',
  SPINAL_FLEXION: 'Distinguish pelvic/spinal motion from hip flexion; a leg-raise name alone cannot establish abdominal direct dose.',
};

export function reviewCatalogueExercise(exercise: Exercise, evidence: EvidenceLedger) {
  const aliases = Object.entries(GUIDE_EXISTING_IDS).filter(([, id]) => id === exercise.id).map(([page]) => Number(page));
  const pages = exercise.guidePage === undefined ? aliases : [exercise.guidePage];
  const individualSource = pages.map(tricepsSourceReview).find((entry) => entry !== undefined);
  const bicepsSource = pages.map(bicepsSourceReview).find((entry) => entry !== undefined);
  const issues: string[] = [];
  const criteria = CRITERIA_KEYS.map((key) => {
    const entry = evidence[exercise.id]?.[key];
    if (!entry) issues.push(`criterion-provenance:${key}`);
    if (entry && entry.confidence !== 'programming-judgement') issues.push(`citation-support-unverified:${key}`);
    if (entry && /nervios|neural|SNC|central/i.test(entry.note)) issues.push(`neural-fatigue-claim:${key}`);
    return { key, value: exercise.criteria?.[key] ?? null,
      provenance: entry?.confidence ?? (individualSource || bicepsSource ? 'individual-source-mechanics-point-unresolved' : exercise.guidePage ? 'generic-guide-rubric' : 'absent'),
      citations: entry?.citations ?? [], supportVerified: false };
  });
  if (!exercise.stimulusTags?.length) issues.push('stimulus-descriptors-missing');
  if (exercise.equipment === Equipment.UNSPECIFIED) issues.push('equipment-unspecified');
  if (COMPOUND_VECTORS.includes(exercise.movementVector) && !exercise.secondaryMuscles.length) issues.push('compound-secondary-credit-missing');
  if (exercise.profile === ExerciseProfile.ISOLATION && COMPOUND_VECTORS.includes(exercise.movementVector)) issues.push('profile-vector-review');
  const sourceFindings = pages.flatMap((page) => VERIFIED_GUIDE_FINDINGS[page]
    ? [{ page, ...VERIFIED_GUIDE_FINDINGS[page], corrected: (
      page === 159 ? exercise.movementVector === MovementVector.SHOULDER_EXTENSION
      : page === 277 ? exercise.equipment === Equipment.STABILITY_BALL
      : [305, 311].includes(page) ? exercise.equipment === Equipment.BANDS
      : [347, 367].includes(page) ? exercise.equipment === Equipment.BODYWEIGHT : false
    ) }] : []);
  return { id: exercise.id, name: exercise.name, primaryMuscle: exercise.primaryMuscle,
    secondaryMuscles: exercise.secondaryMuscles, movement: exercise.movementVector,
    profile: exercise.profile, equipment: exercise.equipment, eligibility: exercise.generationTier ?? 'STANDARD',
    sourcePages: pages, criteria, sourceFindings, issues,
    biomechanicalReview: approach[exercise.movementVector]
      ?? 'Verify active joint action, support, target attribution and reproducible loading. Do not infer exact hypertrophy or systemic-fatigue magnitude from the movement label.',
    ...(individualSource ? { individualSource, criterionBands: tricepsCriterionBands(individualSource) } : {}),
    ...(bicepsSource ? { bicepsSource } : {}),
    status: individualSource || bicepsSource ? 'source-mechanics-reviewed-rating-unresolved' : 'screened-needs-individual-verification' };
}
