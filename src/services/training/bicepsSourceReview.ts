/** Individually read guide mechanics. No measured growth hierarchy or numeric rating approval. */
import { Equipment, ExerciseGenerationTier, ExerciseProfile, MovementVector, type Exercise } from '@/models';

export interface BicepsSourceReview {
  page: number;
  equipment: Equipment;
  shoulder: 'NEUTRAL' | 'EXTENDED' | 'FLEXED' | 'ABDUCTED' | 'VARIABLE';
  support: 'NONE' | 'BACKREST' | 'ARM_PAD' | 'CHEST' | 'THIGH' | 'HAND_SUPPORT';
  grip: 'SUPINATED' | 'NEUTRAL' | 'ROTATING';
  setup: string;
  unresolved: string;
}

export const BICEPS_SOURCE_REVIEWS: readonly BicepsSourceReview[] = [
  { page: 233, equipment: Equipment.BARBELL, shoulder: 'NEUTRAL', support: 'NONE', grip: 'SUPINATED',
    setup: 'Standing straight/EZ bar curl, braced torso, no hip impulse; slight shoulder flexion is optional.',
    unresolved: 'Bar geometry and wrist comfort vary. No exact lengthened torque or head-specific credit is established.' },
  { page: 234, equipment: Equipment.DUMBBELL, shoulder: 'NEUTRAL', support: 'NONE', grip: 'NEUTRAL',
    setup: 'Standing dumbbell hammer curl without torso swing; optional slight shoulder flexion.',
    unresolved: 'Neutral grip does not establish a precise biceps/brachialis/brachioradialis attribution fraction.' },
  { page: 235, equipment: Equipment.BARBELL, shoulder: 'NEUTRAL', support: 'NONE', grip: 'NEUTRAL',
    setup: 'Standing Roman/triceps-bar hammer curl; neutral handles, elbow flexion without torso impulse.',
    unresolved: 'A specialty neutral-handle bar is required; generic barbell availability cannot establish it. Fixed wrists do not establish superior hypertrophy.' },
  { page: 236, equipment: Equipment.DUMBBELL, shoulder: 'NEUTRAL', support: 'NONE', grip: 'ROTATING',
    setup: 'Seated dumbbell curl, starts neutral and supinates during elbow flexion. Backrest is optional.',
    unresolved: 'A seat is required for this source variant; a standing alternative is described separately. Optional support and supination do not establish a quantitative stimulus bonus.' },
  { page: 237, equipment: Equipment.BARBELL, shoulder: 'EXTENDED', support: 'NONE', grip: 'SUPINATED',
    setup: 'Standing straight/EZ-bar drag curl; elbows travel behind the torso while the bar rises. Optional wall/back support.',
    unresolved: 'Shoulder motion and coordination make it distinct from a fixed-upper-arm curl. The guide long-head emphasis claim is not a validated growth multiplier.' },
  { page: 238, equipment: Equipment.DUMBBELL, shoulder: 'EXTENDED', support: 'BACKREST', grip: 'SUPINATED',
    setup: 'Seated incline dumbbell curl on a 45–80-degree backrest, upper arms behind the torso.',
    unresolved: 'Longer muscle position does not guarantee high bottom-range torque; this depends on forearm orientation relative to gravity.' },
  { page: 239, equipment: Equipment.CABLE, shoulder: 'EXTENDED', support: 'BACKREST', grip: 'SUPINATED',
    setup: 'Seated bilateral Bayesian curl, 80–90-degree backrest and two independent low cables.',
    unresolved: 'Generic standing Bayesian identity lacks the specified bench and dual-cable support; do not transfer stability or availability automatically.' },
  { page: 240, equipment: Equipment.DUMBBELL, shoulder: 'FLEXED', support: 'ARM_PAD', grip: 'SUPINATED',
    setup: 'Unilateral dumbbell preacher, upper arm on a 45–60-degree incline bench; elbow stays supported.',
    unresolved: 'Bench support is required. Avoiding final elbow extension is a guide preference, not a universal safety rule; short-head growth superiority is unverified.' },
  { page: 241, equipment: Equipment.MACHINE, shoulder: 'FLEXED', support: 'ARM_PAD', grip: 'SUPINATED',
    setup: 'Seated machine preacher curl with upper arms supported; guide recommends stopping short of full elbow lockout.',
    unresolved: 'Cam, axis and machine geometry determine torque. MACHINE alone cannot validate LENGTHENED resistance or an ideal profile score; the endpoint recommendation is not a universal safety rule.' },
  { page: 242, equipment: Equipment.CABLE, shoulder: 'FLEXED', support: 'ARM_PAD', grip: 'SUPINATED',
    setup: 'Unilateral low-cable preacher with an independent handle and upper-arm support on a 45–60-degree bench.',
    unresolved: 'Bench and cable geometry determine availability and torque. Constant cable tension does not imply constant elbow torque or a universally optimal resistance profile.' },
  { page: 243, equipment: Equipment.CABLE, shoulder: 'NEUTRAL', support: 'NONE', grip: 'SUPINATED',
    setup: 'Standing low-cable bar curl with optional slight shoulder flexion.',
    unresolved: 'Cable tension is not joint torque; pulley height, distance and forearm angle change bottom/top loading.' },
  { page: 244, equipment: Equipment.DUMBBELL, shoulder: 'FLEXED', support: 'CHEST', grip: 'SUPINATED',
    setup: 'Chest-supported spider curl on a 45–60-degree incline bench.',
    unresolved: 'Support reduces balance demands, not all technique demands. A free-weight curve does not establish comparative regional hypertrophy.' },
  { page: 245, equipment: Equipment.BARBELL, shoulder: 'FLEXED', support: 'CHEST', grip: 'SUPINATED',
    setup: 'Chest-supported spider curl on a 45–60-degree bench with straight/EZ bar.',
    unresolved: 'Gravity loads according to forearm angle. The guide short-head preference is not a validated credit multiplier.' },
  { page: 246, equipment: Equipment.CABLE, shoulder: 'FLEXED', support: 'CHEST', grip: 'SUPINATED',
    setup: 'Chest-supported 45–60-degree bench spider curl facing a low cable with bar attachment.',
    unresolved: 'The cable changes force direction, not necessarily constant elbow torque; bench distance changes the curve.' },
  { page: 247, equipment: Equipment.MACHINE, shoulder: 'EXTENDED', support: 'ARM_PAD', grip: 'SUPINATED',
    setup: 'Seated curl machine with elbows supported behind the torso and feet bracing the seat.',
    unresolved: 'This is not a shoulder-flexed preacher machine. Its cam and available ROM require specific machine inspection.' },
  { page: 248, equipment: Equipment.CABLE, shoulder: 'FLEXED', support: 'NONE', grip: 'SUPINATED',
    setup: 'Standing low-cable preacher-style curl with arms held forward, two independent handles, no arm pad.',
    unresolved: 'Preacher in the title does not imply support; a unilateral alternative is a separate setup.' },
  { page: 249, equipment: Equipment.CABLE, shoulder: 'ABDUCTED', support: 'NONE', grip: 'SUPINATED',
    setup: 'Bilateral high-cable double-biceps curl with upper arms held out to the sides; standing or kneeling.',
    unresolved: 'Shoulder abduction is not sagittal flexion. Cable width/height determine loading; no head-specific growth bonus is established.' },
  { page: 250, equipment: Equipment.DUMBBELL, shoulder: 'FLEXED', support: 'THIGH', grip: 'SUPINATED',
    setup: 'Seated unilateral concentration curl, upper arm supported against the inner thigh.',
    unresolved: 'Loading increments and bilateral elapsed time need implementation-specific treatment; no superior growth or precise local fatigue score is inferred.' },
  { page: 251, equipment: Equipment.CABLE, shoulder: 'NEUTRAL', support: 'NONE', grip: 'NEUTRAL',
    setup: 'Bilateral low-cable hammer curl using two nearby cables and separate rope handles; no wrist rotation.',
    unresolved: 'The default needs two cable lines; a single-rope or unilateral implementation is not identical apparatus or elapsed time.' },
  { page: 252, equipment: Equipment.CABLE, shoulder: 'FLEXED', support: 'BACKREST', grip: 'SUPINATED',
    setup: 'Supine guillotine curl on a flat/slightly inclined bench, high cable and bar directed toward the face.',
    unresolved: 'The source notes little demand when the cable aligns with the forearm; this does not justify a numeric growth rating.' },
  { page: 253, equipment: Equipment.CABLE, shoulder: 'FLEXED', support: 'NONE', grip: 'SUPINATED',
    setup: 'Standing high-cable preacher-style curl facing a head-height pulley, unilateral handle default.',
    unresolved: 'No arm pad is present. Optional hand support/kneeling changes stability; an elbow endpoint is not a universal safety rule.' },
  { page: 254, equipment: Equipment.BARBELL, shoulder: 'FLEXED', support: 'ARM_PAD', grip: 'SUPINATED',
    setup: 'Curl over the near-vertical reverse side of a Scott pad with EZ bar; dumbbells are an optional alternative.',
    unresolved: 'Reverse describes the bench orientation, not a pronated grip. It must not be relabeled as a forearm/reverse-grip curl.' },
  { page: 255, equipment: Equipment.BARBELL, shoulder: 'FLEXED', support: 'ARM_PAD', grip: 'SUPINATED',
    setup: 'Seated conventional Scott preacher with straight/EZ bar, upper arms supported on the forward-sloping pad.',
    unresolved: 'Pad angle and forearm orientation set external torque; the guide preference for other implements is not universal comparative evidence.' },
  { page: 256, equipment: Equipment.CABLE, shoulder: 'ABDUCTED', support: 'BACKREST', grip: 'SUPINATED',
    setup: 'Supine crucifix curl on a flat/slightly inclined bench between widely separated independent cables.',
    unresolved: 'Cable span can restrict elbow ROM for a given arm length; a generic cable flag cannot establish this setup.' },
  { page: 257, equipment: Equipment.CABLE, shoulder: 'FLEXED', support: 'BACKREST', grip: 'SUPINATED',
    setup: 'Supine 45–60-degree bench curl facing a high cable with a straight/EZ attachment, shoulders fixed.',
    unresolved: 'Support differs from the standing high curl. Alignment can unload the extended elbow despite cable tension.' },
  { page: 258, equipment: Equipment.CABLE, shoulder: 'VARIABLE', support: 'BACKREST', grip: 'SUPINATED',
    setup: 'Supine 30–45-degree bench curl between two low cables; shoulder neutral or mildly flexed according to setup.',
    unresolved: 'The text permits more than one shoulder angle; do not assign a precise resistance or head-growth descriptor.' },
  { page: 259, equipment: Equipment.CABLE, shoulder: 'EXTENDED', support: 'HAND_SUPPORT', grip: 'SUPINATED',
    setup: 'Standing unilateral Bayesian curl with cable behind the torso; free-hand support is recommended, not mandatory.',
    unresolved: 'Pulley height and distance can bias early or late elbow loading. Neither long-head superiority nor a fixed LENGTHENED curve follows from the name.' },
  { page: 260, equipment: Equipment.MACHINE, shoulder: 'FLEXED', support: 'ARM_PAD', grip: 'SUPINATED',
    setup: 'Seated high-curl specialty machine with upper arms supported and handles moving toward the face.',
    unresolved: 'Generic machine availability does not establish this specialty device or its cam, axis alignment and usable ROM.' },
];

const byPage = new Map(BICEPS_SOURCE_REVIEWS.map((entry) => [entry.page, entry]));
export function bicepsSourceReview(page: number): BicepsSourceReview | undefined { return byPage.get(page); }

const basePages: Readonly<Record<string, number>> = { 'curl-barra': 233, 'curl-martillo': 234,
  'curl-inclinado': 238, 'curl-predicador': 241, 'curl-polea-baja': 243, 'curl-araña': 244, 'curl-concentrado': 250 };
export function bicepsReviewForExercise(exercise: Pick<Exercise, 'id' | 'guidePage'>) {
  const page = exercise.guidePage ?? basePages[exercise.id];
  const source = bicepsSourceReview(page);
  return { source, relation: source ? 'matching-execution' as const : exercise.id === 'curl-bayesian'
    ? 'related-variant' as const : 'unreviewed' as const,
    relatedSources: exercise.id === 'curl-bayesian' ? [bicepsSourceReview(239)!, bicepsSourceReview(259)!] : [] };
}

/** Only source-backed geometry; no inferred curves, muscle-head credits or numeric scores. */
export function bicepsSourceClassification(entry: BicepsSourceReview) {
  return { equipment: entry.equipment, movementVector: MovementVector.ELBOW_FLEXION,
    profile: entry.page === 237 ? ExerciseProfile.COMPOUND_SECONDARY : ExerciseProfile.ISOLATION,
    stimulusTags: [`SHOULDER:${entry.shoulder}`, `SUPPORT:${entry.support}`, `GRIP:${entry.grip}`,
      ...([240, 242, 250, 253, 259].includes(entry.page) ? ['LATERALITY:UNILATERAL'] : [])] };
}

/** Every current biceps entry has an explicit programming decision, not blanket import promotion. */
export const BICEPS_ELIGIBILITY: Readonly<Record<string, { tier: ExerciseGenerationTier; reason: string }>> = {
  'curl-barra': { tier: ExerciseGenerationTier.STANDARD, reason: 'Standing supinated free-bar role; numeric ratings remain programming judgements.' },
  'curl-inclinado': { tier: ExerciseGenerationTier.STANDARD, reason: 'Supported shoulder-extended dumbbell role; length is not bottom-range torque.' },
  'curl-bayesian': { tier: ExerciseGenerationTier.STANDARD, reason: 'Generic shoulder-extended cable role; support, laterality and cable geometry are not specified.' },
  'curl-predicador': { tier: ExerciseGenerationTier.STANDARD, reason: 'Supported machine preacher role; machine-specific resistance remains unverified.' },
  'curl-martillo': { tier: ExerciseGenerationTier.STANDARD, reason: 'Neutral-grip elbow-flexor role; no precise brachioradialis credit is established.' },
  'curl-polea-baja': { tier: ExerciseGenerationTier.STANDARD, reason: 'Neutral-shoulder cable role; constant cable tension is not constant joint torque.' },
  'curl-concentrado': { tier: ExerciseGenerationTier.STANDARD, reason: 'Thigh-supported unilateral alternative; unilateral elapsed-time modeling remains open.' },
  'curl-araña': { tier: ExerciseGenerationTier.STANDARD, reason: 'Chest-supported flexed-shoulder role; growth head-specificity remains unverified.' },
  'guide-235': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'Requires a specialty Roman bar, not established by ordinary BARBELL availability.' },
  'guide-236': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'Seated rotating-grip variant; optional support and elapsed time are not modeled precisely.' },
  'guide-237': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'Moving-shoulder drag hybrid; no secondary muscle fraction is inferred.' },
  'guide-238': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'Related to the existing incline curl; retain saved identity without duplicate promotion.' },
  'guide-239': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'Distinct seated bilateral Bayesian setup requiring a bench and two cable lines.' },
  'guide-240': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'Unilateral dumbbell preacher; benchmark dose/time behavior before automatic promotion.' },
  'guide-242': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'Unilateral cable preacher with an adjustable bench and independent handle.' },
  'guide-245': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'Bar spider variant overlaps the chest-supported role; no individual numeric rating.' },
  'guide-246': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'Bench/cable spider variant; cable geometry and numeric rating remain unresolved.' },
  'guide-247': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'Specific behind-body machine is not implied by generic machine availability.' },
  'guide-248': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'Unsupported standing preacher-style curl; not equivalent to an arm-pad preacher.' },
  'guide-249': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'Abducted-shoulder bilateral high curl requires two cables; not sagittal shoulder flexion.' },
  'guide-251': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'Default needs two nearby cable lines; a unilateral alternative is a different implementation.' },
  'guide-252': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'High-cable supine role; alignment-dependent torque does not establish a numeric preference.' },
  'guide-253': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'Unsupported high-cable unilateral role; no generic preacher-support bonus.' },
  'guide-254': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'Reverse side of Scott bench, not reverse grip; preserve distinct setup.' },
  'guide-255': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'Free-bar supported preacher differs from the existing machine preacher.' },
  'guide-256': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'Wide-portal supine crucifix can be ROM-limited; verify apparatus and alignment.' },
  'guide-257': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'Bench-supported high cable requires separate setup and individual rating.' },
  'guide-258': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'Two low cables and bench; shoulder position is explicitly variable.' },
  'guide-259': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'Standing unilateral Bayesian with optional hand support; not the seated bilateral source.' },
  'guide-260': { tier: ExerciseGenerationTier.MANUAL_ONLY, reason: 'Specialty high-curl machine requires individual apparatus availability and rating.' },
};
