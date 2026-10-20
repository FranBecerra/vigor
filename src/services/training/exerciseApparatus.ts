/** Individually reviewed arm setups. Availability is not inferred from a generic machine/cable flag. */
import { ExerciseApparatus as A, type Exercise } from '@/models';

export const GUIDE_ARM_APPARATUS: Readonly<Record<number, readonly A[]>> = {
  197: [A.SEAT], 198: [A.SEAT, A.ROPE_ATTACHMENT], 199: [A.FLAT_BENCH],
  200: [A.FLAT_BENCH], 201: [], 202: [A.FLAT_BENCH], 203: [A.PARALLEL_BARS],
  204: [A.DUAL_CABLE], 205: [A.SINGLE_HANDLE],
  206: [A.ADJUSTABLE_BENCH, A.DUAL_CABLE], 207: [A.SINGLE_HANDLE],
  208: [A.SINGLE_HANDLE], 209: [A.ADJUSTABLE_BENCH, A.DUAL_CABLE],
  210: [A.FLAT_BENCH], 211: [A.FLAT_BENCH], 212: [],
  213: [A.BAR_ATTACHMENT], 214: [A.BAR_ATTACHMENT], 215: [A.BAR_ATTACHMENT],
  216: [A.FLAT_BENCH, A.BAR_ATTACHMENT], 217: [A.FLAT_BENCH],
  218: [A.SINGLE_HANDLE], 219: [A.SINGLE_HANDLE], 220: [A.TRICEPS_EXTENSION_MACHINE],
  221: [A.DUAL_CABLE, A.HANDLE_PAIR], 222: [],
  223: [A.SINGLE_HANDLE], 224: [A.TRICEPS_EXTENSION_MACHINE],
  225: [A.BAR_ATTACHMENT, A.HANDLE_PAIR], 226: [A.SEAT], 227: [A.SEAT],
  228: [A.ADJUSTABLE_BENCH, A.BAR_ATTACHMENT], 229: [A.LONG_ROPE_PAIR],
  230: [A.ROPE_ATTACHMENT], 231: [A.FLAT_BENCH],
  233: [], 234: [], 235: [A.ROMAN_BAR], 236: [A.SEAT], 237: [],
  238: [A.ADJUSTABLE_BENCH], 239: [A.ADJUSTABLE_BENCH, A.DUAL_CABLE, A.HANDLE_PAIR],
  240: [A.ADJUSTABLE_BENCH], 241: [A.BICEPS_PREACHER_MACHINE],
  242: [A.ADJUSTABLE_BENCH, A.SINGLE_HANDLE], 243: [A.BAR_ATTACHMENT],
  244: [A.ADJUSTABLE_BENCH], 245: [A.ADJUSTABLE_BENCH],
  246: [A.ADJUSTABLE_BENCH, A.BAR_ATTACHMENT], 247: [A.BICEPS_BEHIND_BODY_MACHINE],
  248: [A.DUAL_CABLE, A.HANDLE_PAIR], 249: [A.DUAL_CABLE, A.HANDLE_PAIR],
  250: [A.SEAT], 251: [A.DUAL_CABLE, A.ROPE_PAIR],
  252: [A.FLAT_BENCH, A.BAR_ATTACHMENT], 253: [A.SINGLE_HANDLE],
  254: [A.PREACHER_BENCH], 255: [A.PREACHER_BENCH],
  256: [A.FLAT_BENCH, A.DUAL_CABLE, A.WIDE_CABLE_PORTAL, A.HANDLE_PAIR],
  257: [A.ADJUSTABLE_BENCH, A.BAR_ATTACHMENT],
  258: [A.ADJUSTABLE_BENCH, A.DUAL_CABLE, A.HANDLE_PAIR],
  259: [A.SINGLE_HANDLE], 260: [A.HIGH_CURL_MACHINE],
};

/** Explicit alternatives in the guide, not a requirement to own every substitute. */
export const GUIDE_ARM_OPTIONS: Readonly<Record<number, readonly (readonly A[])[]>> = {
  204: [[A.HANDLE_PAIR, A.CUFF_PAIR, A.ROPE_PAIR]],
  206: [[A.HANDLE_PAIR, A.CUFF_PAIR, A.ROPE_PAIR]],
  212: [[A.BAR_ATTACHMENT, A.ROPE_ATTACHMENT]],
  222: [[A.FLAT_BENCH, A.MAT], [A.LONG_ROPE, A.ROPE_PAIR]],
};

/** Generic names do not establish a supported execution or a specific attachment. */
export const BASE_ARM_APPARATUS: Readonly<Record<string, readonly A[]>> = {
  'curl-barra': [], 'curl-martillo': [], 'curl-inclinado': [A.ADJUSTABLE_BENCH],
  'curl-predicador': [A.BICEPS_PREACHER_MACHINE], 'curl-polea-baja': [A.BAR_ATTACHMENT],
  'curl-concentrado': [A.SEAT], 'curl-araña': [A.ADJUSTABLE_BENCH],
  'press-frances': [A.FLAT_BENCH], 'pushdown-barra': [A.BAR_ATTACHMENT],
  'pushdown-cuerda': [A.ROPE_ATTACHMENT], 'extension-triceps-maquina': [A.TRICEPS_EXTENSION_MACHINE],
  'fondos-banco': [A.FLAT_BENCH], 'press-banca-cerrado': [A.FLAT_BENCH],
};

/** Bench capabilities only; do not infer a specialty machine from MACHINE. */
export function apparatusCapabilities(available: readonly A[]): ReadonlySet<A> {
  const capabilities = new Set(available);
  if (capabilities.has(A.ADJUSTABLE_BENCH)) capabilities.add(A.FLAT_BENCH);
  if (capabilities.has(A.FLAT_BENCH)) capabilities.add(A.SEAT);
  if (capabilities.has(A.LONG_ROPE_PAIR)) { capabilities.add(A.LONG_ROPE); capabilities.add(A.ROPE_PAIR); }
  if (capabilities.has(A.LONG_ROPE)) capabilities.add(A.ROPE_ATTACHMENT);
  if (capabilities.has(A.ROPE_PAIR)) capabilities.add(A.ROPE_ATTACHMENT);
  if (capabilities.has(A.HANDLE_PAIR)) capabilities.add(A.SINGLE_HANDLE);
  if (capabilities.has(A.WIDE_CABLE_PORTAL)) capabilities.add(A.DUAL_CABLE);
  return capabilities;
}

export function apparatusRequirements(exercise: Pick<Exercise, 'id' | 'guidePage' | 'requiredApparatus'>): readonly A[] | undefined {
  return exercise.requiredApparatus ?? BASE_ARM_APPARATUS[exercise.id]
    ?? (exercise.guidePage === undefined ? undefined : GUIDE_ARM_APPARATUS[exercise.guidePage]);
}

export function apparatusOptions(exercise: Pick<Exercise, 'guidePage' | 'apparatusOptions'>): readonly (readonly A[])[] | undefined {
  return exercise.apparatusOptions ?? (exercise.guidePage === undefined ? undefined : GUIDE_ARM_OPTIONS[exercise.guidePage]);
}
