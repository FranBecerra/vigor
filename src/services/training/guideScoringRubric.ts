import { Equipment, ExerciseProfile, MovementVector, type ExerciseCriteria } from '@/models';

/**
 * Ordinal programming judgements, not measured effect sizes or injury-risk scores.
 * The guide page is the traceable source for each movement. When neither the
 * description nor the implement distinguishes a criterion, the score stays at 3.
 * A machine is never awarded a hypertrophy bonus merely for being a machine.
 */
export function scoreGuideExercise(input: {
  page: number;
  name: string;
  vector: MovementVector;
  profile: ExerciseProfile;
  equipment: Equipment;
}): ExerciseCriteria {
  const { page, name, vector, profile, equipment } = input;
  const guided = new Set<Equipment>([Equipment.MACHINE, Equipment.SMITH_MACHINE]);
  const incrementable = new Set<Equipment>([
    Equipment.MACHINE, Equipment.SMITH_MACHINE, Equipment.CABLE,
    Equipment.BARBELL, Equipment.SAFETY_BAR, Equipment.TRAP_BAR, Equipment.LANDMINE,
  ]);
  const axial = new Set<MovementVector>([
    MovementVector.KNEE_DOMINANT, MovementVector.HIP_DOMINANT,
    MovementVector.UNILATERAL_KNEE, MovementVector.LOADED_CARRY,
  ]);
  const criteria: ExerciseCriteria = {
    stretchedPositionLoading: 3,
    rangeOfMotion: 3,
    resistanceProfileMatch: 3,
    stabilityCost: guided.has(equipment) ? 4 : equipment === Equipment.STABILITY_BALL ? 2 : 3,
    loadProgressability: incrementable.has(equipment) ? 4 : equipment === Equipment.STABILITY_BALL ? 2 : 3,
    systemicFatigueCost: profile === ExerciseProfile.ISOLATION ? 4 : axial.has(vector) ? 2 : 3,
  };

  // Observable set-up differences, not claims of superior hypertrophy.
  if (/APOYO|SUPPORTED|CHEST SUPPORT|PECHO APOYADO/i.test(name)) criteria.stabilityCost = 4;
  if (/UNILATERAL|A UNA MANO|A UNA PIERNA|STEP UP/i.test(name)) criteria.stabilityCost = Math.min(criteria.stabilityCost, 2) as ExerciseCriteria['stabilityCost'];
  if (/DEFICIT|PROFUNDA|DEEP/i.test(name)) criteria.rangeOfMotion = 4;
  if (/PARCIAL|RACK PULL/i.test(name)) criteria.rangeOfMotion = 2;

  // Length-loaded movements are scored above neutral only when the named setup
  // makes the long-position demand reasonably clear. This remains a hypothesis.
  const lengthBiasedCurl = vector === MovementVector.ELBOW_FLEXION && /INCLINAD[OA]|BAYESIAN/i.test(name);
  const lengthBiasedFly = vector === MovementVector.SHOULDER_HORIZONTAL_ADDUCTION && /INCLINAD[OA]/i.test(name);
  const overheadTriceps = vector === MovementVector.ELBOW_EXTENSION && /OVERHEAD|SOBRE LA CABEZA/i.test(name);
  const lengthBiasedHinge = vector === MovementVector.HIP_DOMINANT && /RUMANO|RDL|STIFF LEG|PIERNAS R[IÍ]GIDAS/i.test(name);
  if (lengthBiasedCurl || lengthBiasedFly || overheadTriceps || lengthBiasedHinge) {
    criteria.stretchedPositionLoading = 4;
  }
  // These specific descriptions/illustrations in the guide alter the defaults.
  // Page numbers make every exception auditable against the source PDF.
  const overrides: Readonly<Record<number, Partial<ExerciseCriteria>>> = {
    102: { stabilityCost: 4 }, // Supported upper-back pulldown.
    108: { systemicFatigueCost: 2 }, // Pendlay row starts from the floor.
    176: { rangeOfMotion: 3 }, // Extra arm travel is not all active lateral-delt ROM.
    195: { resistanceProfileMatch: 2 }, // Landmine arc unloads part of shoulder flexion.
    252: { stretchedPositionLoading: 2 }, // Cable preacher set-up unloads the long position.
    287: { stabilityCost: 2, loadProgressability: 2 }, // Pike on a stability ball.
    304: { stabilityCost: 4, systemicFatigueCost: 4 }, // Supported 45-degree back extension.
    336: { stabilityCost: 3, systemicFatigueCost: 2 }, // Safety-bar squat remains axial.
    338: { stabilityCost: 1 }, // High step-up has a large balance requirement.
    341: { rangeOfMotion: 2 }, // V-squat limits the knee excursion described.
    343: { stabilityCost: 4 }, // Hatfield squat uses external support.
    345: { rangeOfMotion: 4 }, // Deep Platz-style hack squat.
    359: { systemicFatigueCost: 4 }, // Supported hip extension is not an axial free-weight hinge.
  };
  return { ...criteria, ...overrides[page] };
}
