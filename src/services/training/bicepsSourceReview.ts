/** Individually read guide mechanics. No measured growth hierarchy or numeric rating approval. */
import { Equipment } from '@/models';

export interface BicepsSourceReview {
  page: number;
  equipment: Equipment;
  shoulder: 'NEUTRAL' | 'EXTENDED' | 'FLEXED';
  support: 'NONE' | 'BACKREST' | 'ARM_PAD' | 'CHEST' | 'THIGH';
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
  { page: 250, equipment: Equipment.DUMBBELL, shoulder: 'FLEXED', support: 'THIGH', grip: 'SUPINATED',
    setup: 'Seated unilateral concentration curl, upper arm supported against the inner thigh.',
    unresolved: 'Loading increments and bilateral elapsed time need implementation-specific treatment; no superior growth or precise local fatigue score is inferred.' },
];

const byPage = new Map(BICEPS_SOURCE_REVIEWS.map((entry) => [entry.page, entry]));
export function bicepsSourceReview(page: number): BicepsSourceReview | undefined { return byPage.get(page); }
