/** Description-based geometry, not hypertrophy rankings or measured resistance curves. */
import type { Exercise } from '@/models';
import { GUIDE_EXISTING_IDS } from './guideExerciseCatalogue';
import { tricepsSourceReview, tricepsCriterionBands } from './tricepsSourceReview';

const groups: readonly { ids: readonly string[]; tags: readonly string[] }[] = [
  { ids: ['press-banca', 'press-banca-mancuernas', 'press-banca-smith', 'press-pecho-maquina'], tags: ['PRESS_ANGLE:HORIZONTAL'] },
  { ids: ['press-inclinado-barra', 'press-inclinado-mancuernas', 'press-inclinado-maquina'], tags: ['PRESS_ANGLE:INCLINED'] },
  { ids: ['press-banca-declinado'], tags: ['PRESS_ANGLE:DECLINED'] },
  { ids: ['aperturas-mancuernas', 'cruces-polea-media', 'pec-deck'], tags: ['ARM_ACTION:HORIZONTAL_ADDUCTION'] },
  { ids: ['aperturas-inclinadas'], tags: ['ARM_ACTION:HORIZONTAL_ADDUCTION', 'BENCH:INCLINED'] },
  { ids: ['dominadas-supinas', 'remo-barra-agarre-supino'], tags: ['GRIP:SUPINATED'] },
  { ids: ['jalon-agarre-neutro'], tags: ['GRIP:NEUTRAL'] },
  { ids: ['jalon-unilateral', 'remo-mancuerna', 'patada-gluteo-polea'], tags: ['LATERALITY:UNILATERAL'] },
  { ids: ['remo-pecho-apoyado', 'remo-mancuernas-tumbado'], tags: ['SUPPORT:CHEST'] },
  { ids: ['press-militar-barra', 'press-militar-mancuernas', 'press-hombro-maquina'], tags: ['PRESS_ANGLE:OVERHEAD'] },
  { ids: ['curl-femoral-sentado'], tags: ['HIP:FLEXED', 'ACTION:KNEE_FLEXION'] },
  { ids: ['curl-femoral-tumbado', 'nordic-curl'], tags: ['HIP:NEUTRAL', 'ACTION:KNEE_FLEXION'] },
  { ids: ['peso-muerto-rumano', 'peso-muerto-rumano-mancuernas', 'peso-muerto-piernas-rigidas', 'buenos-dias'], tags: ['ACTION:HIP_HINGE'] },
  { ids: ['hip-thrust', 'puente-gluteo'], tags: ['ACTION:BRIDGE'] },
  { ids: ['bulgara', 'zancadas', 'subidas-cajon'], tags: ['LATERALITY:UNILATERAL', 'ACTION:KNEE_DOMINANT'] },
  { ids: ['gemelos-sentado'], tags: ['KNEE:FLEXED'] },
  { ids: ['gemelos-de-pie', 'gemelos-prensa', 'gemelos-mancuerna'], tags: ['KNEE:EXTENDED'] },
];
const review = new Map(groups.flatMap(({ ids, tags }) => ids.map((id) => [id, tags] as const)));

export function reviewedExerciseMetadata(exercise: Exercise) {
  const page = exercise.guidePage ?? Number(Object.entries(GUIDE_EXISTING_IDS).find(([, id]) => id === exercise.id)?.[0]);
  const sourceReview = tricepsSourceReview(page);
  const descriptiveTags = review.get(exercise.id) ?? [];
  return { id: exercise.id, movement: exercise.movementVector, equipment: exercise.equipment,
    descriptiveTags, source: descriptiveTags.length ? 'explicit-exercise-description' : 'unreviewed',
    // Cable height, machine cams, execution and anthropometry can change the curve.
    resistanceProfile: 'unverified',
    minimumExperience: 'not-established',
    criteriaProvenance: sourceReview ? 'individual-source-mechanics-numeric-rating-unresolved'
      : exercise.guidePage ? 'guide-derived-expert-rubric' : 'expert-rubric',
    ...(sourceReview ? { sourceReview, criterionBands: tricepsCriterionBands(sourceReview),
      evidenceStatus: 'source-mechanics-reviewed-not-comparative-trial' } : {}) };
}

/** Experiment only until paired whole-plan quality proves at least non-inferiority. */
export function catalogueWithReviewedTags(catalogue: readonly Exercise[]): Exercise[] {
  return catalogue.map((exercise) => {
    const tags = reviewedExerciseMetadata(exercise).descriptiveTags;
    return tags.length && !exercise.stimulusTags?.length
      ? { ...exercise, stimulusTags: [...tags] } : exercise;
  });
}
