import {
  Equipment,
  ExerciseGenerationTier,
  ExerciseProfile,
  MovementVector,
  MuscleGroup,
  type Exercise,
} from '@/models';
import { scoreGuideExercise } from './guideScoringRubric';
import { tricepsSourceReview, tricepsSourceClassification, REVIEWED_TRICEPS_CRITERIA, TRICEPS_ELIGIBILITY } from './tricepsSourceReview';

export interface GuideExerciseRecord {
  page: number;
  name: string;
}

/**
 * Pages that describe an exercise already present in Vigor. The guide index keeps
 * every page, but these pages do not create a second selectable exercise.
 */
export const GUIDE_EXISTING_IDS: Readonly<Record<number, string>> = {
  33: 'press-inclinado-mancuernas',
  34: 'press-banca-mancuernas',
  35: 'press-banca-declinado',
  37: 'press-banca-smith',
  40: 'press-inclinado-barra',
  43: 'press-banca-cerrado',
  49: 'cruces-polea-baja',
  51: 'aperturas-inclinadas',
  53: 'aperturas-mancuernas',
  55: 'fondos-paralelas',
  62: 'press-banca',
  68: 'pec-deck',
  69: 'press-pecho-maquina',
  77: 'press-inclinado-maquina',
  80: 'dominadas-supinas',
  82: 'jalon-al-pecho',
  84: 'jalon-agarre-neutro',
  87: 'remo-barra-agarre-supino',
  97: 'pullover-polea',
  98: 'remo-mancuerna',
  111: 'remo-t',
  131: 'remo-con-barra',
  135: 'extension-lumbar-maquina',
  137: 'encogimientos-mancuernas',
  138: 'encogimientos-barra',
  139: 'encogimientos-polea',
  141: 'encogimientos-inclinado',
  149: 'pajaros-mancuernas',
  150: 'pajaros-polea',
  154: 'pec-deck-invertido',
  161: 'face-pull',
  163: 'elevacion-lateral-mancuernas',
  165: 'elevacion-lateral-inclinado',
  166: 'elevacion-lateral-polea',
  168: 'elevacion-lateral-maquina',
  172: 'remo-al-menton',
  186: 'press-hombro-maquina',
  188: 'elevacion-frontal',
  194: 'press-militar-barra',
  197: 'extension-sobre-cabeza-mancuerna',
  200: 'press-frances',
  213: 'pushdown-barra',
  224: 'extension-triceps-maquina',
  230: 'pushdown-cuerda',
  233: 'curl-barra',
  234: 'curl-martillo',
  239: 'curl-bayesian',
  241: 'curl-predicador',
  243: 'curl-polea-baja',
  244: 'curl-araña',
  250: 'curl-concentrado',
  278: 'crunch-polea',
  279: 'crunch-maquina',
  280: 'elevacion-piernas-colgado',
  284: 'pallof-press',
  274: 'rueda-abdominal',
  291: 'hip-thrust',
  293: 'puente-gluteo',
  298: 'patada-gluteo-polea',
  300: 'abduccion-cadera-maquina',
  306: 'abduccion-cadera-banda',
  323: 'sentadilla-hack',
  326: 'prensa-45',
  330: 'extension-cuadriceps',
  331: 'zancadas',
  337: 'sentadilla-libre',
  342: 'sentadilla-sissy',
  349: 'sentadilla-frontal',
  352: 'peso-muerto-rumano',
  353: 'peso-muerto-piernas-rigidas',
  356: 'curl-femoral-tumbado',
  357: 'curl-femoral-sentado',
  360: 'buenos-dias',
  365: 'peso-muerto-rumano-mancuernas',
  373: 'gemelos-prensa',
  376: 'gemelos-de-pie',
  377: 'gemelos-sentado',
  380: 'aduccion-cadera-maquina',
  383: 'copenhagen',
};

/** Primary resistance implement established from each page's description or figure. */
export const GUIDE_EQUIPMENT_OVERRIDES: Readonly<Record<number, Equipment>> = {
  47: Equipment.CABLE,
  75: Equipment.CABLE,
  76: Equipment.CABLE,
  83: Equipment.CABLE,
  85: Equipment.CABLE,
  86: Equipment.CABLE,
  100: Equipment.LANDMINE,
  102: Equipment.CABLE,
  104: Equipment.CABLE,
  106: Equipment.CABLE,
  107: Equipment.CABLE,
  108: Equipment.BARBELL,
  110: Equipment.LANDMINE,
  112: Equipment.LANDMINE,
  119: Equipment.DUMBBELL,
  120: Equipment.BARBELL,
  122: Equipment.MACHINE,
  123: Equipment.DUMBBELL,
  125: Equipment.MACHINE,
  126: Equipment.MACHINE,
  127: Equipment.MACHINE,
  130: Equipment.CABLE,
  160: Equipment.CABLE,
  176: Equipment.DUMBBELL,
  177: Equipment.DUMBBELL,
  178: Equipment.DUMBBELL,
  181: Equipment.DUMBBELL,
  195: Equipment.LANDMINE,
  208: Equipment.CABLE,
  210: Equipment.SMITH_MACHINE,
  211: Equipment.BARBELL,
  221: Equipment.CABLE,
  225: Equipment.CABLE,
  228: Equipment.CABLE,
  229: Equipment.CABLE,
  231: Equipment.DUMBBELL,
  252: Equipment.CABLE,
  254: Equipment.BARBELL,
  259: Equipment.CABLE,
  277: Equipment.STABILITY_BALL,
  281: Equipment.BODYWEIGHT,
  282: Equipment.BODYWEIGHT,
  283: Equipment.CABLE,
  285: Equipment.BODYWEIGHT,
  286: Equipment.DUMBBELL,
  287: Equipment.STABILITY_BALL,
  299: Equipment.CABLE,
  304: Equipment.ROMAN_CHAIR,
  305: Equipment.BANDS,
  311: Equipment.BANDS,
  312: Equipment.MACHINE,
  325: Equipment.BARBELL,
  334: Equipment.MACHINE,
  336: Equipment.SAFETY_BAR,
  338: Equipment.DUMBBELL,
  340: Equipment.MACHINE,
  341: Equipment.MACHINE,
  343: Equipment.SAFETY_BAR,
  345: Equipment.MACHINE,
  347: Equipment.BODYWEIGHT,
  348: Equipment.SAFETY_BAR,
  359: Equipment.ROMAN_CHAIR,
  367: Equipment.BODYWEIGHT,
  368: Equipment.SAFETY_BAR,
};

function sourceMuscle(page: number, name: string): MuscleGroup {
  if (page <= 77) return MuscleGroup.CHEST;
  if (page <= 135) {
    if (page === 102 || page === 107) return MuscleGroup.MID_BACK;
    if (page === 119) return MuscleGroup.LATS;
    if (/LUMBAR/i.test(name)) return MuscleGroup.ERECTORS;
    if (/JALÓN|DOMINADA|PULL.?OVER|PULL DOWN|ADUCCI[ÓO]N|DORSAL|LAT/i.test(name)) {
      return MuscleGroup.LATS;
    }
    return MuscleGroup.MID_BACK;
  }
  if (page <= 146) return MuscleGroup.NECK;
  if (page <= 161) return MuscleGroup.DELTS_REAR;
  if (page <= 181) return MuscleGroup.DELTS_LATERAL;
  if (page <= 195) return MuscleGroup.DELTS_FRONT;
  if (page <= 231) return MuscleGroup.TRICEPS;
  if (page <= 260) return MuscleGroup.BICEPS;
  if (page <= 271) return MuscleGroup.FOREARMS;
  if (page <= 289) return MuscleGroup.CORE;
  if (page <= 320) return MuscleGroup.GLUTES;
  if (page <= 350) return MuscleGroup.QUADS;
  if (page <= 368) return MuscleGroup.HAMSTRINGS;
  if (page <= 378) return MuscleGroup.CALVES;
  return MuscleGroup.ADDUCTORS;
}

function sourceEquipment(page: number, name: string): Equipment {
  const described = GUIDE_EQUIPMENT_OVERRIDES[page];
  if (described !== undefined) return described;
  if (/TRAP BAR/i.test(name)) return Equipment.TRAP_BAR;
  if (/SAFETY BAR/i.test(name)) return Equipment.SAFETY_BAR;
  if (/LANDMINE/i.test(name)) return Equipment.LANDMINE;
  if (/MULTIPOWER/i.test(name)) return Equipment.SMITH_MACHINE;
  if (/POLEA|CABLE/i.test(name)) return Equipment.CABLE;
  if (/MANCUERNA|DUMB.?ELL/i.test(name)) return Equipment.DUMBBELL;
  if (/KETTLEBELL/i.test(name)) return Equipment.KETTLEBELL;
  if (/MINIBAND/i.test(name)) return Equipment.BANDS;
  if (/BARRA|BARBELL/i.test(name)) return Equipment.BARBELL;
  if (/MÁQUINA|MACHINE|PLATE.?LOADED|PRENSA|PENDUL|SKORCHER|LEG CURL|LEG EXTENSION|PEC.?DECK|PEC.?FLY/i.test(name)) return Equipment.MACHINE;
  if (/DOMINADAS|FONDOS EN PARALELAS|AB.?WHEEL|BODY SAW|V.?UPS|STIR THE POT|HANGING|CLAM SHELL|FROG PUMP|MONSTER WALK|SISSY SQUAT|COPEN|GLUTE HAM RAISE|SLIDE LEG CURL/i.test(name)) return Equipment.BODYWEIGHT;
  if (page <= 135 && /GIRONDA/i.test(name)) return Equipment.CABLE;
  return Equipment.UNSPECIFIED;
}

function sourceVector(page: number, name: string): MovementVector {
  if (page === 210 || page === 211) return MovementVector.ELBOW_EXTENSION;
  // The described movement keeps the elbow fixed and extends the shoulder.
  if (page === 159) return MovementVector.SHOULDER_EXTENSION;
  if (page <= 77) {
    return /PRESS|FONDOS/i.test(name)
      ? MovementVector.PUSH_HORIZONTAL
      : MovementVector.SHOULDER_HORIZONTAL_ADDUCTION;
  }
  if (page <= 135) {
    if (/LUMBAR/i.test(name)) return MovementVector.SPINAL_EXTENSION;
    if (/RACK PULL/i.test(name)) return MovementVector.HIP_DOMINANT;
    if (/PULL.?OVER|ADUCCI[ÓO]N|EXTENSI[ÓO]N DE HOMBRO/i.test(name)) return MovementVector.SHOULDER_EXTENSION;
    if (/JALÓN|DOMINADAS|PULL DOWN/i.test(name)) return MovementVector.PULL_VERTICAL;
    return MovementVector.PULL_HORIZONTAL;
  }
  if (page <= 146) return /FARMER WALK/i.test(name) ? MovementVector.LOADED_CARRY : MovementVector.SCAPULAR_ELEVATION;
  if (page <= 161) return /ROW/i.test(name) ? MovementVector.PULL_HORIZONTAL : MovementVector.SHOULDER_HORIZONTAL_ABDUCTION;
  if (page <= 181) return MovementVector.SHOULDER_ABDUCTION;
  if (page <= 195) return /PRESS/i.test(name) ? MovementVector.PUSH_VERTICAL : MovementVector.SHOULDER_FLEXION;
  if (page <= 231) return /FONDOS|JM PRESS|KAZ PRESS/i.test(name) ? MovementVector.PUSH_HORIZONTAL : MovementVector.ELBOW_EXTENSION;
  if (page <= 260) return MovementVector.ELBOW_FLEXION;
  if (page <= 271) {
    if (/EXTENSI[ÓO]N/i.test(name)) return MovementVector.WRIST_EXTENSION;
    if (/TWIST|TURN/i.test(name)) return MovementVector.FOREARM_ROTATION;
    if (/AGARRE/i.test(name)) return MovementVector.GRIP;
    return MovementVector.WRIST_FLEXION;
  }
  if (page <= 289) {
    if (/SUITCASE CARRY/i.test(name)) return MovementVector.LOADED_CARRY;
    return /CRUNCH|PIERNAS|V.?UPS|PIKE/i.test(name) ? MovementVector.SPINAL_FLEXION : MovementVector.CORE_ANTI_MOVEMENT;
  }
  if (page <= 320) {
    if (/ABDUC|CLAM|MONSTER|LEG SWING/i.test(name)) return MovementVector.HIP_ABDUCTION;
    if (/PRENSA/i.test(name)) return MovementVector.KNEE_DOMINANT;
    if (/BÚLGARA/i.test(name)) return MovementVector.UNILATERAL_KNEE;
    if (/PATADA|KICK|GLUTE PRESS|FROG/i.test(name)) return MovementVector.HIP_EXTENSION_ISOLATED;
    return MovementVector.HIP_DOMINANT;
  }
  if (page <= 350) {
    if (/LEG EXTENSION|SISSY|KNEELING LEG/i.test(name)) return MovementVector.KNEE_EXTENSION;
    if (/SPLIT|BÚLGARA|ZANCADA|STEP UP/i.test(name)) return MovementVector.UNILATERAL_KNEE;
    return MovementVector.KNEE_DOMINANT;
  }
  if (page <= 368) return /CURL|GLUTE HAM RAISE/i.test(name) ? MovementVector.KNEE_FLEXION : MovementVector.HIP_DOMINANT;
  if (page <= 378) return MovementVector.ANKLE_PLANTAR_FLEXION;
  return MovementVector.HIP_ADDUCTION;
}

const COMPOUND = new Set<MovementVector>([
  MovementVector.PUSH_HORIZONTAL, MovementVector.PUSH_VERTICAL,
  MovementVector.PULL_HORIZONTAL, MovementVector.PULL_VERTICAL,
  MovementVector.KNEE_DOMINANT, MovementVector.HIP_DOMINANT,
  MovementVector.UNILATERAL_KNEE, MovementVector.LOADED_CARRY,
]);

function sourceProfile(vector: MovementVector, equipment: Equipment): ExerciseProfile {
  if (!COMPOUND.has(vector)) return ExerciseProfile.ISOLATION;
  return [Equipment.BARBELL, Equipment.SAFETY_BAR, Equipment.TRAP_BAR].includes(equipment)
    ? ExerciseProfile.COMPOUND_PRIMARY
    : ExerciseProfile.COMPOUND_SECONDARY;
}

/** Every source page is retained, including pages mapped to a pre-existing id. */
export function guideExerciseId(record: GuideExerciseRecord): string {
  return GUIDE_EXISTING_IDS[record.page] ?? `guide-${record.page}`;
}

/**
 * Unreviewed imports retain provisional rubric scores. Individually reviewed
 * triceps mechanics override classification and withdraw unsupported point
 * ratings; uncertainty bands are diagnostic only. Neither source inspection nor
 * provisional scoring alone makes an import eligible for automatic programming:
 * only an individual decision in `TRICEPS_ELIGIBILITY` does, and individual
 * scores in `REVIEWED_TRICEPS_CRITERIA` do not by themselves promote an entry.
 */
export function buildGuideExercises(
  records: readonly GuideExerciseRecord[],
  existing: readonly Exercise[],
): Exercise[] {
  const known = new Set(existing.map((exercise) => exercise.id));
  const pages = new Set<number>();
  return records.flatMap((record) => {
    if (pages.has(record.page)) throw new Error(`Duplicate guide page ${record.page}`);
    pages.add(record.page);
    const alias = GUIDE_EXISTING_IDS[record.page];
    if (alias !== undefined) {
      if (!known.has(alias)) throw new Error(`Guide page ${record.page} aliases missing exercise ${alias}`);
      return [];
    }
    const muscle = sourceMuscle(record.page, record.name);
    const equipment = sourceEquipment(record.page, record.name);
    const vector = sourceVector(record.page, record.name);
    const hybridTriceps = record.page === 210 || record.page === 211;
    const profile = hybridTriceps ? ExerciseProfile.COMPOUND_SECONDARY : sourceProfile(vector, equipment);
    const sourceReview = tricepsSourceReview(record.page);
    const reviewedCriteria = REVIEWED_TRICEPS_CRITERIA[record.page];
    const id = guideExerciseId(record);
    return [{
      id,
      name: record.page === 210 ? 'Kaz Press / JM Press (Smith machine)' : record.page === 211 ? 'JM Press (barbell)'
        : record.name.toLocaleLowerCase('es-ES').replace(/^./, (letter) => letter.toLocaleUpperCase('es-ES')),
      primaryMuscle: muscle,
      secondaryMuscles: [],
      movementVector: vector,
      profile,
      equipment,
      // Reviewed mechanics must not retain a generic numeric rating as if verified.
      criteria: sourceReview ? reviewedCriteria : scoreGuideExercise({ page: record.page, name: record.name, vector, profile, equipment }),
      ...(hybridTriceps ? { stimulusTags: ['FAMILY:TRICEPS_PRESS_EXTENSION', record.page === 210 ? 'IMPLEMENT:GUIDED_BAR' : 'IMPLEMENT:FREE_BAR'] } : {}),
      ...(sourceReview ? { ...tricepsSourceClassification(sourceReview),
        stimulusTags: [...tricepsSourceClassification(sourceReview).stimulusTags,
          ...(hybridTriceps ? ['FAMILY:TRICEPS_PRESS_EXTENSION'] : [])] } : {}),
      generationTier: TRICEPS_ELIGIBILITY[id]?.tier ?? ExerciseGenerationTier.MANUAL_ONLY,
      guidePage: record.page,
      isCustom: false,
    }];
  });
}
