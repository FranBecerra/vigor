/** Individually read source descriptions, not a name-based scoring rubric. */
import { Equipment, ExerciseGenerationTier, ExerciseProfile, MovementVector, type ExerciseCriteria } from '@/models';

export interface TricepsSourceReview {
  page: number;
  equipment: Equipment;
  shoulder: 'OVERHEAD' | 'FLEXED' | 'NEUTRAL' | 'MOVING';
  support: 'BENCH' | 'BACKREST' | 'ARM_PAD' | 'HAND_SUPPORT' | 'PARALLEL_BARS' | 'NONE';
  unilateral: boolean;
  hybrid: boolean;
  setup: string;
  uncertainty: string;
}

const review = (page: number, equipment: Equipment, shoulder: TricepsSourceReview['shoulder'],
  support: TricepsSourceReview['support'], setup: string, uncertainty: string,
  unilateral = false, hybrid = false): TricepsSourceReview =>
  ({ page, equipment, shoulder, support, setup, uncertainty, unilateral, hybrid });

/** Includes aliased pages: an alias is reviewed, not silently treated as a new exercise. */
export const TRICEPS_SOURCE_REVIEWS: readonly TricepsSourceReview[] = [
  review(197, Equipment.DUMBBELL, 'OVERHEAD', 'BENCH', 'Seated two-hand dumbbell extension; elbow action, shoulder held flexed.', 'Dumbbell increments and shoulder comfort depend on the athlete.'),
  review(198, Equipment.CABLE, 'OVERHEAD', 'BENCH', 'Seated low-cable rope extension behind the head.', 'Cable tension is not constant joint torque; pulley distance changes the curve.'),
  review(199, Equipment.DUMBBELL, 'FLEXED', 'BENCH', 'Supine neutral-grip extension; dumbbells descend behind the head.', 'Elbow flexion and actual upper-arm angle determine the lengthened demand.'),
  review(200, Equipment.BARBELL, 'FLEXED', 'BENCH', 'Supine bar extension behind the head; EZ or straight bar.', 'Bar type and wrist comfort are not established by the generic catalogue name.'),
  review(201, Equipment.DUMBBELL, 'OVERHEAD', 'NONE', 'Standing dumbbell overhead extension; no leg impulse.', 'Title and instructions specify dumbbells but the figure shows a bar; default follows the instructions.'),
  review(202, Equipment.BARBELL, 'FLEXED', 'BENCH', 'Supine skullcrusher toward forehead or nose, distinct from behind-head French press.', 'Endpoint clearance can restrict elbow flexion.'),
  review(203, Equipment.BODYWEIGHT, 'MOVING', 'PARALLEL_BARS', 'Narrow-grip dip with both shoulder and elbow movement; external loading optional.', 'No direct hypertrophy hierarchy versus machines is established; equipment includes bars and optional belt.', false, true),
  review(204, Equipment.CABLE, 'NEUTRAL', 'NONE', 'Crossed high cables with cuffs or independent handles; elbow extension.', 'Two cable stations required for the bilateral description; optional shoulder motion is not the default.'),
  review(205, Equipment.CABLE, 'NEUTRAL', 'NONE', 'One high cable, lateral stance, shoulder held fixed.', 'Cable line and torso orientation determine resistance.', true),
  review(206, Equipment.CABLE, 'FLEXED', 'BACKREST', 'Seated at 80-90 degree backrest, shoulders near 90 degrees; independent cables.', 'Support does not establish ideal machine/cable resistance matching.'),
  review(207, Equipment.CABLE, 'FLEXED', 'NONE', 'Standing unilateral elbow extension with shoulder near 90 degrees.', 'Do not translate 90-degree shoulder flexion into fully overhead.', true),
  review(208, Equipment.CABLE, 'OVERHEAD', 'NONE', 'Low cable behind head, diagonal katana extension, shoulder held flexed.', 'No direct katana-versus-other-extension growth comparison.', true),
  review(209, Equipment.CABLE, 'FLEXED', 'BENCH', 'Cable Tate extension on a 20-45 degree bench, independent low cables.', 'Despite press in the name, the source holds the shoulder fixed.'),
  review(210, Equipment.SMITH_MACHINE, 'MOVING', 'BENCH', 'Kaz/JM hybrid on Smith rails; elbow travels, bar approaches chin/clavicle.', 'Rail geometry and technique matter; superiority over close-grip bench is a coaching claim.', false, true),
  review(211, Equipment.BARBELL, 'MOVING', 'BENCH', 'Free-bar JM hybrid; elbows travel forward, bar approaches chin/clavicle.', 'No validated fixed chest credit or comparative growth advantage.', false, true),
  review(212, Equipment.CABLE, 'FLEXED', 'NONE', 'High cable behind body, description specifies shoulders near 90 degrees.', 'Figure appears more overhead than the 90-degree description; exact equivalence unresolved, preserved separately.'),
  review(213, Equipment.CABLE, 'NEUTRAL', 'NONE', 'V1 high-cable bar pushdown with fixed shoulder and elbow position.', 'Full elbow excursion does not imply resistance at the very end of extension.'),
  review(214, Equipment.CABLE, 'MOVING', 'NONE', 'V2 pushdown deliberately couples elbow extension and shoulder extension.', 'Coordination-heavy variant; no evidence for a quantified long-head bonus.', false, true),
  review(215, Equipment.CABLE, 'NEUTRAL', 'NONE', 'V3 leaned-over pushdown, shoulders held above the bar, elbows travel backward.', 'Source describes a slight pressing component; hybrid accessory, not a basic press.', false, true),
  review(216, Equipment.CABLE, 'FLEXED', 'BENCH', 'Supine low-cable French extension; fixed shoulder is the default.', 'Optional shoulder motion would define a different execution, not mandatory hybrid status.'),
  review(217, Equipment.DUMBBELL, 'FLEXED', 'BENCH', 'Supine Tate extension with laterally directed elbows, no shoulder press.', 'Kettlebell option is not availability of the default dumbbell variant.'),
  review(218, Equipment.CABLE, 'NEUTRAL', 'NONE', 'Unilateral high-cable pushdown with shoulder fixed near torso.', 'The kickback label does not imply a dumbbell-like terminal-loading curve.', true),
  review(219, Equipment.CABLE, 'NEUTRAL', 'HAND_SUPPORT', 'Bent-over cable kickback, free hand supported, pulley below shoulder.', 'Pulley height can shift demand from early/mid to late elbow extension.', true),
  review(220, Equipment.MACHINE, 'FLEXED', 'ARM_PAD', 'Machine French extension, upper arm on pad, shoulder near 90 degrees.', 'Cam, axis alignment and available elbow excursion vary by manufacturer.'),
  review(221, Equipment.CABLE, 'FLEXED', 'NONE', 'Standing chest-height extension, usually crossed cables, shoulder near 90 degrees.', 'Cable height changes peak demand; no muscle-head multiplier is inferred.'),
  review(222, Equipment.CABLE, 'NEUTRAL', 'BENCH', 'Supine cable kickback, shoulder fixed, long/double ropes clear the torso.', 'Bench or mat and cable placement needed; not a standing overhead variant.'),
  review(223, Equipment.CABLE, 'NEUTRAL', 'NONE', 'Back-to-high-cable unilateral pushdown with line near shoulder.', 'Usually unilateral; a two-hand execution requires a suitable cable portal.', true),
  review(224, Equipment.MACHINE, 'FLEXED', 'BACKREST', 'Seated machine elbow extension with shoulder/arm support.', 'Manufacturer-specific ROM, axis and cam cannot be inferred from MACHINE.'),
  review(225, Equipment.CABLE, 'NEUTRAL', 'NONE', 'High-cable pushdown using bar/multigrip plus independent handles.', 'Attachment requirements differ from an ordinary bar pushdown.'),
  review(226, Equipment.DUMBBELL, 'OVERHEAD', 'BENCH', 'Seated two-dumbbell overhead French extension.', 'Distinct loading/hand setup from the one-dumbbell two-hand entry.'),
  review(227, Equipment.DUMBBELL, 'OVERHEAD', 'BENCH', 'Seated unilateral diagonal katana extension.', 'Free-hand support is optional; vertical alignment unloads the terminal elbow range.', true),
  review(228, Equipment.CABLE, 'NEUTRAL', 'BENCH', 'High-cable elbow extension with torso on 45-60 degree bench.', 'Source contains a shoulder-motion typo; fixed shoulder is consistently specified elsewhere.'),
  review(229, Equipment.CABLE, 'NEUTRAL', 'NONE', 'Rapunzel pushdown using extra-long crossed ropes near shoulders.', 'Cable/rope clearance matters; ordinary short ropes are not an equivalent setup.'),
  review(230, Equipment.CABLE, 'NEUTRAL', 'NONE', 'High-cable rope pushdown, elbow-only action, no forced rope separation.', 'Rope versus cuff growth superiority is not established.'),
  review(231, Equipment.DUMBBELL, 'MOVING', 'BENCH', 'Supine PJR combines elbow extension and substantial shoulder movement.', 'Dumbbell is the indexed default; bar alternative is not silently equipment-equivalent.', false, true),
];

const byPage = new Map(TRICEPS_SOURCE_REVIEWS.map((entry) => [entry.page, entry]));
export function tricepsSourceReview(page: number): TricepsSourceReview | undefined { return byPage.get(page); }

/** Ranges are expert uncertainty bands, not confidence intervals or production scores. */
export function tricepsCriterionBands(entry: TricepsSourceReview):
  Record<keyof ExerciseCriteria, readonly [number, number] | null> {
  return {
    stretchedPositionLoading: entry.shoulder === 'OVERHEAD' ? [4, 5]
      : entry.shoulder === 'FLEXED' ? [3, 4] : [2, 4],
    rangeOfMotion: entry.equipment === Equipment.MACHINE || entry.page === 202 || entry.hybrid ? [3, 4] : [4, 5],
    // A cable/machine label alone cannot validate matching to the athlete's force curve.
    resistanceProfileMatch: null,
    stabilityCost: entry.support === 'NONE' ? [3, 4]
      : entry.support === 'PARALLEL_BARS' ? [2, 4] : entry.equipment === Equipment.SMITH_MACHINE
        || entry.equipment === Equipment.MACHINE ? [4, 5] : [3, 4],
    loadProgressability: entry.equipment === Equipment.BODYWEIGHT || entry.equipment === Equipment.DUMBBELL ? [2, 4] : [4, 5],
    systemicFatigueCost: entry.hybrid ? [3, 4] : [4, 5],
  };
}

export interface TricepsEligibility {
  tier: ExerciseGenerationTier;
  reason: string;
}

const AUTOMATIC = ExerciseGenerationTier.STANDARD;
const MANUAL = ExerciseGenerationTier.MANUAL_ONLY;

/** Individual automatic-programming decision for every triceps-primary catalogue entry. */
export const TRICEPS_ELIGIBILITY: Readonly<Record<string, TricepsEligibility>> = {
  'extension-sobre-cabeza-polea': { tier: AUTOMATIC, reason: 'Overhead cable extension: the lengthened-long-head role tested directly by Maeo et al. 2023.' },
  'extension-sobre-cabeza-mancuerna': { tier: AUTOMATIC, reason: 'Overhead role without a cable station; coarser dumbbell increments.' },
  'press-frances': { tier: AUTOMATIC, reason: 'Flexed-shoulder barbell extension; the single-joint arm of Brandao et al. 2020.' },
  'pushdown-barra': { tier: AUTOMATIC, reason: 'Neutral-shoulder complement with low skill demand and stack increments.' },
  'pushdown-cuerda': { tier: AUTOMATIC, reason: 'Same neutral-shoulder role as the bar pushdown with another attachment.' },
  'extension-triceps-maquina': { tier: AUTOMATIC, reason: 'Supported, low-skill extension; the specific machine geometry stays unverified.' },
  'fondos-banco': { tier: ExerciseGenerationTier.FALLBACK, reason: 'Bodyweight hybrid for equipment-limited plans; coarse loading and end-range shoulder extension.' },
  'press-banca-cerrado': { tier: AUTOMATIC, reason: 'Triceps-primary press. It currently counts as direct triceps work; that definition is allocator debt.' },
  'guide-198': { tier: MANUAL, reason: 'Same overhead-cable role as extension-sobre-cabeza-polea, plus a bench.' },
  'guide-199': { tier: MANUAL, reason: 'Fills the flexed-shoulder dumbbell role, but its promotion experiment was rejected: a near-zero time squeeze then drops 2.5-4 chest sets in dumbbell-only plans.' },
  'guide-201': { tier: MANUAL, reason: 'Same role as the seated overhead dumbbell entry with less support; source text and figure disagree.' },
  'guide-202': { tier: MANUAL, reason: 'Near-duplicate of press-frances with a shorter endpoint.' },
  'guide-203': { tier: MANUAL, reason: 'Hybrid dip classified as a horizontal press; it would fill the chest-press slot before its role is decided.' },
  'guide-204': { tier: MANUAL, reason: 'Needs two cable stations, which availability does not model.' },
  'guide-205': { tier: MANUAL, reason: 'Unilateral, doubling time per set, in a role the pushdowns already cover.' },
  'guide-206': { tier: MANUAL, reason: 'Needs independent cables and a backrest, which availability does not model.' },
  'guide-207': { tier: MANUAL, reason: 'Unilateral flexed-shoulder role already covered bilaterally.' },
  'guide-208': { tier: MANUAL, reason: 'Unilateral overhead role already covered bilaterally.' },
  'guide-209': { tier: MANUAL, reason: 'Needs two low cables and a bench, which availability does not model.' },
  'guide-210': { tier: MANUAL, reason: 'Technique-dependent press-extension hybrid in the close-grip-bench role; revisit with beginner eligibility.' },
  'guide-211': { tier: MANUAL, reason: 'Technique-dependent press-extension hybrid in the close-grip-bench role; revisit with beginner eligibility.' },
  'guide-212': { tier: MANUAL, reason: 'Disputed identity: the text says 90-degree shoulder flexion, the figure looks overhead.' },
  'guide-214': { tier: MANUAL, reason: 'Coordination-heavy coupled elbow and shoulder extension.' },
  'guide-215': { tier: MANUAL, reason: 'Hybrid with a pressing component in the pushdown role.' },
  'guide-216': { tier: MANUAL, reason: 'Needs a cable and a bench; the flexed-shoulder role is already covered.' },
  'guide-217': { tier: MANUAL, reason: 'Unusual lateral elbow path; guide-199 covers the flexed dumbbell role.' },
  'guide-218': { tier: MANUAL, reason: 'Unilateral pushdown.' },
  'guide-219': { tier: MANUAL, reason: 'Unilateral kickback.' },
  'guide-220': { tier: MANUAL, reason: 'Same supported-machine role as extension-triceps-maquina; manufacturer-specific.' },
  'guide-221': { tier: MANUAL, reason: 'Needs two cable stations, which availability does not model.' },
  'guide-222': { tier: MANUAL, reason: 'Needs long or double ropes and a bench at the cable.' },
  'guide-223': { tier: MANUAL, reason: 'Unilateral pushdown.' },
  'guide-225': { tier: MANUAL, reason: 'Needs a multigrip plus independent handles in the pushdown role.' },
  'guide-226': { tier: MANUAL, reason: 'Same overhead dumbbell role as extension-sobre-cabeza-mancuerna.' },
  'guide-227': { tier: MANUAL, reason: 'Unilateral, and vertical alignment unloads the terminal range.' },
  'guide-228': { tier: MANUAL, reason: 'Needs a bench at the cable; the neutral role is already covered.' },
  'guide-229': { tier: MANUAL, reason: 'Needs extra-long ropes.' },
  'guide-231': { tier: MANUAL, reason: 'Hybrid with substantial shoulder movement; technique-dependent.' },
};

/** Individually assigned scores for imports, kept apart from the eligibility decision. */
export const REVIEWED_TRICEPS_CRITERIA: Readonly<Record<number, ExerciseCriteria>> = {
  199: { stretchedPositionLoading: 4, rangeOfMotion: 4, resistanceProfileMatch: 3,
    stabilityCost: 3, loadProgressability: 3, systemicFatigueCost: 4 },
};

export function tricepsSourceClassification(entry: TricepsSourceReview) {
  return { equipment: entry.equipment,
    movementVector: entry.page === 203 ? MovementVector.PUSH_HORIZONTAL : MovementVector.ELBOW_EXTENSION,
    profile: entry.hybrid ? ExerciseProfile.COMPOUND_SECONDARY : ExerciseProfile.ISOLATION,
    stimulusTags: [`SHOULDER:${entry.shoulder}`, `SUPPORT:${entry.support}`,
      ...(entry.unilateral ? ['LATERALITY:UNILATERAL'] : [])] };
}
