/**
 * Cálculo de volumen de entrenamiento — LÓGICA PURA (PRD §3, §3.6).
 *
 * POR QUÉ EXISTE LA CAPA DE REGIÓN
 *   La literatura da los rangos de volumen por REGIÓN ("espalda: 12-24 series
 *   semanales"), no por la taxonomía fina que usa esta app. Aplicar el rango de
 *   la espalda a cada porción por separado multiplicaba el volumen por tres: el
 *   plan pedía 43 series de espalda donde la referencia dice 12-24.
 *
 *   Así que el presupuesto vive en la REGIÓN y se reparte entre sus músculos. La
 *   taxonomía fina sigue sirviendo para elegir y equilibrar ejercicios; lo que no
 *   puede hacer es multiplicar el volumen.
 *
 * CADENA DE CÁLCULO
 *   objetivo + nivel  ─→  MEV/MAV/MRV de la REGIÓN  ─→  reparto entre músculos
 *                                                        ─→  MEAV por músculo
 *
 * NO TODAS LAS REGIONES SE ENTRENAN
 *   Tibial, aductores, trapecio superior, deltoides frontal y lumbar están
 *   DESACTIVADAS por defecto: reciben trabajo indirecto suficiente o su
 *   contribución a hipertrofia, fuerza y salud no justifica gastar volumen y
 *   recuperación en ellas. Gemelos también, por la misma razón. Se activan
 *   explícitamente. Prescribir las diecinueve a la vez es la otra mitad de por
 *   qué el total se iba de rango.
 *
 * DOS UNIDADES DISTINTAS, Y NO SE MEZCLAN
 *   - Por músculo, el volumen es ATRIBUIDO: una serie de press acredita 1 al
 *     pecho y 0,5 al tríceps. Los rangos por grupo muscular de la literatura se
 *     cuentan así.
 *   - El total de la rutina es EJECUTADO: series duras hechas en el gimnasio. Los
 *     rangos de volumen total se cuentan así.
 *   Comparar uno con el otro es lo que hacía parecer aceptables 124 series.
 *
 * UNIDAD TEMPORAL: series por MICROCICLO, no por semana. El modelo no tiene
 * semanas (§3.1). Los rangos de la literatura son semanales y se aplican tal
 * cual, porque un microciclo cumple la misma función que una semana.
 */
import { MuscleGroup } from '@/models';
import { ExperienceLevel } from '@/models/athlete';

/** Objetivo del mesociclo. La fuerza necesita menos volumen que la hipertrofia. */
export enum TrainingGoal {
  HYPERTROPHY = 'HYPERTROPHY',
  STRENGTH = 'STRENGTH',
}

/**
 * Región de volumen: la unidad a la que la literatura asigna rangos.
 *
 * Los hombros van en tres regiones separadas y no en una porque sus porciones no
 * comparten presupuesto en la práctica: el deltoides lateral tolera y necesita
 * mucho más volumen directo que el frontal, que se nutre de todo el empuje.
 */
export enum VolumeRegion {
  CHEST = 'CHEST',
  BACK = 'BACK',
  DELTS_LATERAL = 'DELTS_LATERAL',
  DELTS_REAR = 'DELTS_REAR',
  DELTS_FRONT = 'DELTS_FRONT',
  NECK = 'NECK',
  BICEPS = 'BICEPS',
  FOREARMS = 'FOREARMS',
  TRICEPS = 'TRICEPS',
  QUADS = 'QUADS',
  HAMSTRINGS = 'HAMSTRINGS',
  GLUTES = 'GLUTES',
  ADDUCTORS = 'ADDUCTORS',
  CALVES = 'CALVES',
  TIBIALIS = 'TIBIALIS',
  ERECTORS = 'ERECTORS',
  CORE = 'CORE',
}

/** Puntos de referencia de volumen, en series ATRIBUIDAS por microciclo. */
export interface VolumeLandmarks {
  /** Volumen mínimo para mantener. Por debajo se pierde masa. */
  mv: number;
  /** Volumen mínimo efectivo: el mínimo con el que se gana. */
  mev: number;
  /** Volumen adaptativo máximo: mejor relación adaptación/fatiga. */
  mav: number;
  /** Volumen máximo recuperable: techo absoluto. */
  mrv: number;
}

export interface RegionDefinition {
  /** Músculos que comparten el presupuesto de la región. */
  muscles: readonly MuscleGroup[];
  /**
   * Reparto del presupuesto entre esos músculos. Suma 1.
   * A smaller share does not mean "less important": it means that the muscle
   * already receives substantial secondary credit from compound exercises.
   */
  shares: readonly number[];
  /** Referencias para INTERMEDIO orientado a HIPERTROFIA. Lo demás se escala. */
  landmarks: VolumeLandmarks;
  /**
   * Si la región entra en un plan sin configurar.
   * false para las que se nutren de trabajo indirecto (deltoides frontal,
   * lumbar, trapecio superior) y para las de aportación marginal a hipertrofia,
   * fuerza y salud (tibial, aductores, gemelos).
   */
  trainedByDefault: boolean;
}

/**
 * Definición de cada región.
 *
 * Los rangos salen de las referencias habituales para hipertrofia en
 * intermedios: pecho 10-20, espalda 12-24, cuádriceps 10-20, isquios 8-16,
 * deltoides lateral hasta 30 en avanzados, bíceps y tríceps 10-20, gemelos
 * 12-30. Son valores de CONTENIDO, ajustables con el script sin tocar el
 * algoritmo.
 */
export const VOLUME_REGIONS: Record<VolumeRegion, RegionDefinition> = {
  [VolumeRegion.CHEST]: {
    muscles: [MuscleGroup.CHEST],
    shares: [1],
    landmarks: { mv: 4, mev: 10, mav: 16, mrv: 20 },
    trainedByDefault: true,
  },
  [VolumeRegion.BACK]: {
    muscles: [MuscleGroup.LATS, MuscleGroup.MID_BACK],
    shares: [0.55, 0.45],
    landmarks: { mv: 6, mev: 12, mav: 18, mrv: 24 },
    trainedByDefault: true,
  },
  [VolumeRegion.DELTS_LATERAL]: {
    muscles: [MuscleGroup.DELTS_LATERAL],
    shares: [1],
    landmarks: { mv: 4, mev: 10, mav: 18, mrv: 26 },
    trainedByDefault: true,
  },
  [VolumeRegion.DELTS_REAR]: {
    muscles: [MuscleGroup.DELTS_REAR],
    shares: [1],
    landmarks: { mv: 3, mev: 6, mav: 12, mrv: 18 },
    trainedByDefault: true,
  },
  [VolumeRegion.DELTS_FRONT]: {
    muscles: [MuscleGroup.DELTS_FRONT],
    shares: [1],
    landmarks: { mv: 0, mev: 4, mav: 8, mrv: 12 },
    trainedByDefault: false,
  },
  [VolumeRegion.NECK]: {
    muscles: [MuscleGroup.NECK],
    shares: [1],
    landmarks: { mv: 0, mev: 4, mav: 10, mrv: 16 },
    trainedByDefault: false,
  },
  [VolumeRegion.BICEPS]: {
    muscles: [MuscleGroup.BICEPS],
    shares: [1],
    landmarks: { mv: 4, mev: 10, mav: 14, mrv: 20 },
    trainedByDefault: true,
  },
  [VolumeRegion.FOREARMS]: {
    muscles: [MuscleGroup.FOREARMS],
    shares: [1],
    // No defensible individual volume landmarks have been established here.
    landmarks: { mv: 0, mev: 0, mav: 0, mrv: 0 },
    trainedByDefault: false,
  },
  [VolumeRegion.TRICEPS]: {
    muscles: [MuscleGroup.TRICEPS],
    shares: [1],
    landmarks: { mv: 4, mev: 10, mav: 14, mrv: 20 },
    trainedByDefault: true,
  },
  [VolumeRegion.QUADS]: {
    muscles: [MuscleGroup.QUADS],
    shares: [1],
    landmarks: { mv: 4, mev: 10, mav: 16, mrv: 20 },
    trainedByDefault: true,
  },
  [VolumeRegion.HAMSTRINGS]: {
    muscles: [MuscleGroup.HAMSTRINGS],
    shares: [1],
    landmarks: { mv: 3, mev: 8, mav: 12, mrv: 16 },
    trainedByDefault: true,
  },
  [VolumeRegion.GLUTES]: {
    muscles: [MuscleGroup.GLUTES],
    shares: [1],
    landmarks: { mv: 0, mev: 6, mav: 12, mrv: 16 },
    trainedByDefault: true,
  },
  [VolumeRegion.ADDUCTORS]: {
    muscles: [MuscleGroup.ADDUCTORS],
    shares: [1],
    landmarks: { mv: 0, mev: 4, mav: 8, mrv: 12 },
    trainedByDefault: false,
  },
  [VolumeRegion.CALVES]: {
    muscles: [MuscleGroup.CALVES],
    shares: [1],
    landmarks: { mv: 0, mev: 8, mav: 16, mrv: 26 },
    trainedByDefault: false,
  },
  [VolumeRegion.TIBIALIS]: {
    muscles: [MuscleGroup.TIBIALIS],
    shares: [1],
    landmarks: { mv: 0, mev: 4, mav: 6, mrv: 10 },
    trainedByDefault: false,
  },
  [VolumeRegion.ERECTORS]: {
    muscles: [MuscleGroup.ERECTORS],
    shares: [1],
    landmarks: { mv: 0, mev: 4, mav: 8, mrv: 12 },
    trainedByDefault: false,
  },
  [VolumeRegion.CORE]: {
    muscles: [MuscleGroup.CORE],
    shares: [1],
    landmarks: { mv: 0, mev: 5, mav: 10, mrv: 16 },
    trainedByDefault: true,
  },
};

/** Región a la que pertenece cada músculo. Derivado, para no repetir el mapa. */
export const REGION_OF_MUSCLE: Record<MuscleGroup, VolumeRegion> = (() => {
  const map = {} as Record<MuscleGroup, VolumeRegion>;
  (Object.entries(VOLUME_REGIONS) as [VolumeRegion, RegionDefinition][]).forEach(
    ([region, definition]) => {
      definition.muscles.forEach((muscle) => {
        map[muscle] = region;
      });
    },
  );
  return map;
})();

/** Regiones activas cuando el atleta no configura nada. */
export const DEFAULT_TRAINED_REGIONS: readonly VolumeRegion[] = (
  Object.entries(VOLUME_REGIONS) as [VolumeRegion, RegionDefinition][]
)
  .filter(([, definition]) => definition.trainedByDefault)
  .map(([region]) => region);

/**
 * Escalado por nivel. Un principiante progresa con MENOS volumen y tolera menos:
 * su umbral efectivo y su techo están más abajo, no es que "deba hacer menos".
 * Derivado de los rangos de la referencia: hipertrofia 6-12 / 10-20 / 12-30.
 */
export const EXPERIENCE_SCALING: Record<ExperienceLevel, number> = {
  [ExperienceLevel.BEGINNER]: 0.65,
  [ExperienceLevel.INTERMEDIATE]: 1,
  [ExperienceLevel.ADVANCED]: 1.3,
};

/**
 * Escalado por objetivo. La fuerza busca adaptaciones neurales y especificidad,
 * así que necesita menos volumen: la referencia da 6-15 series en intermedios
 * frente a 10-20 en hipertrofia.
 */
export const GOAL_SCALING: Record<TrainingGoal, number> = {
  [TrainingGoal.HYPERTROPHY]: 1,
  [TrainingGoal.STRENGTH]: 0.7,
};

/**
 * Rango de volumen TOTAL de la rutina, en series EJECUTADAS por microciclo.
 * Es la comprobación de sensatez del plan completo: un plan que suma bien
 * músculo a músculo puede seguir siendo una barbaridad en conjunto.
 *
 * El techo del AVANZADO está por debajo de la referencia (que daba 140 o más en
 * hipertrofia y 120 en fuerza) por criterio del usuario: en la práctica un
 * avanzado se mueve más cerca de 100 que de 140, y prescribir 135 series porque
 * la horquilla de la literatura lo permite produce un plan que nadie sostiene.
 * Estos rangos son contenido, y el criterio de quien programa manda sobre el
 * extremo de una horquilla poblacional.
 */
export const TOTAL_SETS_RANGE: Record<TrainingGoal, Record<ExperienceLevel, [number, number]>> = {
  [TrainingGoal.HYPERTROPHY]: {
    [ExperienceLevel.BEGINNER]: [20, 50],
    [ExperienceLevel.INTERMEDIATE]: [40, 90],
    [ExperienceLevel.ADVANCED]: [60, 120],
  },
  [TrainingGoal.STRENGTH]: {
    [ExperienceLevel.BEGINNER]: [15, 40],
    [ExperienceLevel.INTERMEDIATE]: [30, 70],
    [ExperienceLevel.ADVANCED]: [50, 100],
  },
};

/** Redondea a series enteras, nunca por debajo de 0. */
function roundSets(value: number): number {
  return Math.max(0, Math.round(value));
}

/** Referencias de una región ajustadas a nivel y objetivo. */
export function landmarksForRegion(
  region: VolumeRegion,
  level: ExperienceLevel,
  goal: TrainingGoal,
): VolumeLandmarks {
  const base = VOLUME_REGIONS[region].landmarks;
  const factor = EXPERIENCE_SCALING[level] * GOAL_SCALING[goal];
  return {
    mv: roundSets(base.mv * factor),
    mev: roundSets(base.mev * factor),
    mav: roundSets(base.mav * factor),
    mrv: roundSets(base.mrv * factor),
  };
}

/**
 * Referencias derivadas del volumen que el atleta DECLARA hacer en una región.
 *
 * Criterio: si alguien lleva tiempo haciendo N series y progresando, ese N está
 * en su zona adaptativa. Es mejor dato que cualquier promedio poblacional. Se
 * acota al MRV de su nivel para no convertir un volumen desmedido en una
 * prescripción irrecuperable.
 */
export function landmarksFromDeclaredVolume(
  region: VolumeRegion,
  level: ExperienceLevel,
  goal: TrainingGoal,
  declaredSets: number,
): VolumeLandmarks {
  const byLevel = landmarksForRegion(region, level, goal);
  const mav = Math.min(roundSets(declaredSets), byLevel.mrv);
  return {
    mv: roundSets(mav * 0.3),
    mev: roundSets(mav * 0.6),
    mav,
    mrv: Math.max(mav, roundSets(Math.min(mav * 1.35, byLevel.mrv * 1.1))),
  };
}

/**
 * Énfasis de una región en el mesociclo. Es la palanca que el atleta maneja al
 * crear el mesociclo, tocando el grupo muscular en la pantalla.
 */
export enum RegionEmphasis {
  /** Volumen hacia el MRV. Para el músculo que se quiere hacer progresar. */
  PRIORITY = 'PRIORITY',
  /** Volumen en la parte alta del rango adaptativo. Es el comportamiento normal. */
  NORMAL = 'NORMAL',
  /** Volumen de MANTENIMIENTO. Conserva el músculo sin gastar recuperación en él. */
  DEPRIORITIZED = 'DEPRIORITIZED',
}

/**
 * Cuánto del rango MEV-MAV recibe una región NORMAL, por nivel.
 *
 * Alto a propósito: el atleta quiere estar cerca del límite superior de su rango
 * de volumen, no en el mínimo. Los valores están calibrados con el banco de
 * pruebas para que el plan por defecto caiga en la parte alta de su rango de
 * volumen TOTAL sin tocar el techo, medido sobre veinte semillas.
 *
 * El margen es deliberado y no conservadurismo: la selección de ejercicios es
 * aleatoria, y un plan que elige más multiarticulares necesita menos series
 * ejecutadas para el mismo volumen atribuido. Apuntando al 98 % del techo, seis
 * de cada ocho semillas se salían.
 *
 * El principiante es la excepción y se queda cerca del MEV. No es una concesión:
 * con diez regiones activas cualquier margen sobre el mínimo lo saca de su rango
 * total, que es estrecho, y en esa etapa la técnica y la progresión de carga
 * rinden más que añadir series.
 */
export const NORMAL_RANGE_FRACTION: Record<ExperienceLevel, number> = {
  [ExperienceLevel.BEGINNER]: 0,
  [ExperienceLevel.INTERMEDIATE]: 0.4,
  [ExperienceLevel.ADVANCED]: 0.4,
};

/**
 * Lo mismo, pero cuando el mesociclo TIENE regiones priorizadas.
 *
 * Mucho más bajo, y es la pieza que hace que priorizar signifique algo. El
 * volumen total está acotado por lo que el atleta puede recuperar, así que subir
 * dos regiones al MRV sin bajar nada deja el plan por encima de su techo: medido,
 * 102 series ejecutadas con un rango de 40-90.
 *
 * El trade es AUTOMÁTICO a propósito. Concentrar volumen en lo prioritario y
 * mantener el resto cerca del mínimo efectivo es lo que hace un entrenador, y
 * exigirle al atleta que lo compense a mano desprioriorizando tres regiones
 * convertiría una decisión de programación en un rompecabezas de presupuesto.
 */
export const NORMAL_RANGE_FRACTION_WITH_PRIORITY: Record<ExperienceLevel, number> = {
  [ExperienceLevel.BEGINNER]: 0,
  [ExperienceLevel.INTERMEDIATE]: 0,
  [ExperienceLevel.ADVANCED]: 0.2,
};

/**
 * Cuánto del rango MV-MEV recibe una región DESPRIORIZADA.
 *
 * Por encima del MV puro: el MV mantiene, pero dejar un músculo exactamente ahí
 * durante todo un mesociclo no deja margen para un día flojo. Se sitúa entre el
 * mantenimiento y el mínimo efectivo.
 */
export const DEPRIORITIZED_RANGE_FRACTION = 0.4;

/**
 * Cuánto del rango MAV-MRV recibe una región PRIORIZADA.
 *
 * Por debajo del MRV a propósito, y esto se sigue de la decisión de mantener el
 * volumen ESTÁTICO dentro del mesociclo (§3): el MRV es por definición el máximo
 * recuperable, así que prescribirlo en un volumen que no varía significa vivir en
 * el borde de lo recuperable durante los cuatro a seis microciclos enteros. En un
 * modelo de volumen progresivo el MRV se toca solo en el último microciclo; en uno
 * estático no se toca.
 */
export const PRIORITY_RANGE_FRACTION = 0.6;

/**
 * Regiones a las que se aplica el límite ampliado de prioridades.
 *
 * Lo que las agrupa no es el tamaño del músculo sino su COSTE DE RECUPERACIÓN:
 * priorizar bíceps o gemelos no compite con el resto del entrenamiento como lo
 * hace priorizar espalda o cuádriceps. El deltoides lateral entra aquí aunque
 * absorba mucho volumen, porque ese volumen no es sistémicamente caro.
 */
export const LOW_COST_REGIONS: readonly VolumeRegion[] = [
  VolumeRegion.BICEPS,
  VolumeRegion.TRICEPS,
  VolumeRegion.CALVES,
  VolumeRegion.DELTS_LATERAL,
  VolumeRegion.DELTS_REAR,
  VolumeRegion.DELTS_FRONT,
  VolumeRegion.NECK,
  VolumeRegion.TIBIALIS,
  VolumeRegion.ADDUCTORS,
  VolumeRegion.CORE,
  VolumeRegion.ERECTORS,
];

/**
 * Presupuesto de prioridades, en "plazas".
 *
 * Dos regiones caras, o hasta tres cuando alguna es de bajo coste de
 * recuperación: una región cara ocupa una plaza entera y una barata media. Así
 * salen espalda + cuádriceps (2 plazas), o espalda + bíceps + gemelos (2), o
 * bíceps + tríceps + gemelos (1,5), pero nunca tres regiones caras (3).
 *
 * El tope duro de tres regiones existe aparte del presupuesto: seis regiones
 * baratas cabrían en las plazas y no serían una priorización, serían un plan sin
 * foco.
 */
export const PRIORITY_SLOT_BUDGET = 2;
export const HIGH_COST_PRIORITY_SLOTS = 1;
export const LOW_COST_PRIORITY_SLOTS = 0.5;
export const MAX_PRIORITY_REGIONS = 3;

/** Plazas que consume priorizar una región. */
export function prioritySlotsOf(region: VolumeRegion): number {
  return LOW_COST_REGIONS.includes(region) ? LOW_COST_PRIORITY_SLOTS : HIGH_COST_PRIORITY_SLOTS;
}

export class EmphasisLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmphasisLimitError';
  }
}

/**
 * Comprueba los límites de énfasis. Lanza en lugar de recortar en silencio: la
 * pantalla debe impedir el cuarto toque, y si llega aquí es un error de programa.
 */
export function assertEmphasisLimits(
  priority: readonly VolumeRegion[],
  deprioritized: readonly VolumeRegion[],
): void {
  const overlap = priority.filter((region) => deprioritized.includes(region));
  if (overlap.length > 0) {
    throw new EmphasisLimitError(
      `Una región no puede estar priorizada y desprioriorizada a la vez: ${overlap.join(', ')}.`,
    );
  }
  if (priority.length > MAX_PRIORITY_REGIONS) {
    throw new EmphasisLimitError(
      `Como máximo ${MAX_PRIORITY_REGIONS} regiones priorizadas; se han pedido ${priority.length}.`,
    );
  }
  const slots = priority.reduce((sum, region) => sum + prioritySlotsOf(region), 0);
  if (slots > PRIORITY_SLOT_BUDGET) {
    throw new EmphasisLimitError(
      `Prioridades por encima del presupuesto: ${slots} plazas de ${PRIORITY_SLOT_BUDGET}. ` +
        'Dos regiones de alto coste de recuperación, o hasta tres cuando alguna es de bajo coste.',
    );
  }
}

/**
 * MEAV de una región según su énfasis.
 *
 * - PRIORITY: hacia el MRV, que es el techo de lo recuperable.
 * - NORMAL: parte alta del rango adaptativo.
 * - DEPRIORITIZED: mantenimiento, entre el MV y el MEV.
 *
 * Nunca supera el MRV.
 */
export function meavForRegion(
  landmarks: VolumeLandmarks,
  emphasis: RegionEmphasis,
  level: ExperienceLevel,
  priorityLoad = 0,
): number {
  const { mv, mev, mav, mrv } = landmarks;
  let target: number;
  switch (emphasis) {
    case RegionEmphasis.PRIORITY:
      target = mav + (mrv - mav) * PRIORITY_RANGE_FRACTION;
      break;
    case RegionEmphasis.DEPRIORITIZED:
      target = mv + (mev - mv) * DEPRIORITIZED_RANGE_FRACTION;
      break;
    default: {
      // A cheap priority (triceps) must not cost the rest as much as two expensive ones.
      const load = Math.min(1, Math.max(0, priorityLoad));
      const fraction = NORMAL_RANGE_FRACTION[level]
        + (NORMAL_RANGE_FRACTION_WITH_PRIORITY[level] - NORMAL_RANGE_FRACTION[level]) * load;
      target = mev + (mav - mev) * fraction;
    }
  }
  return Math.min(roundSets(target), mrv);
}

export type VolumeBasis = 'declared' | 'experience';

/** Presupuesto de una región, antes de repartirlo entre sus músculos. */
export interface RegionVolumeTarget {
  region: VolumeRegion;
  /** Series atribuidas por microciclo para toda la región. */
  meav: number;
  landmarks: VolumeLandmarks;
  basis: VolumeBasis;
  emphasis: RegionEmphasis;
  cappedByMrv: boolean;
}

/** Objetivo de un músculo: su parte del presupuesto de la región. */
export interface MuscleVolumeTarget {
  muscle: MuscleGroup;
  region: VolumeRegion;
  /** Series ATRIBUIDAS por microciclo. */
  meav: number;
  /** Parte del presupuesto de la región que le corresponde. */
  share: number;
  emphasis: RegionEmphasis;
}

export interface VolumePlan {
  goal: TrainingGoal;
  level: ExperienceLevel;
  regions: RegionVolumeTarget[];
  muscles: MuscleVolumeTarget[];
  /**
   * true en el microciclo de DESCARGA. Cambia cómo se juzga el plan: estar por
   * debajo del mínimo efectivo y del rango de volumen total es su función, no un
   * defecto, así que ni se avisa ni se compara contra el rango de acumulación.
   */
  isDeload: boolean;
  /**
   * true cuando el volumen se ha recortado para caber en el TIEMPO disponible.
   * Igual que la descarga, deja de tener sentido juzgarlo contra el rango de
   * recuperación: la vara de medir pasa a ser los minutos disponibles.
   */
  capacityCapped: boolean;
}

export interface VolumePlanInput {
  level: ExperienceLevel;
  goal: TrainingGoal;
  /** Regiones a entrenar. Omitido usa las activas por defecto. */
  trainedRegions?: readonly VolumeRegion[];
  /** Volumen declarado por región. Prevalece sobre la estimación por nivel. */
  declaredVolume?: Partial<Record<VolumeRegion, number>>;
  /**
   * Músculos a priorizar. Su región entera pasa a prioritaria, que es donde vive
   * el presupuesto: no se puede subir el volumen del dorsal sin subir el de la
   * espalda.
   */
  priorityMuscles?: readonly MuscleGroup[];
  /** Músculos a desprioriorizar, que bajan su región a volumen de mantenimiento. */
  deprioritizedMuscles?: readonly MuscleGroup[];
  /**
   * Regiones a priorizar, declaradas directamente.
   *
   * La pantalla de generación elige REGIONES, que es donde vive el presupuesto de
   * plazas, así que pasarlas por un músculo intermedio sería un viaje de ida y
   * vuelta que no añade nada. Se unen con las que salgan de `priorityMuscles`.
   */
  priorityRegions?: readonly VolumeRegion[];
  /** Regiones a desprioriorizar, declaradas directamente. */
  deprioritizedRegions?: readonly VolumeRegion[];
}

export function buildVolumePlan(input: VolumePlanInput): VolumePlan {
  const trained = new Set(input.trainedRegions ?? DEFAULT_TRAINED_REGIONS);

  // Los énfasis se declaran por músculo pero se aplican por región, que es donde
  // vive el presupuesto: no se puede subir el dorsal sin subir la espalda.
  const priorityRegions = [
    ...new Set([
      ...(input.priorityRegions ?? []),
      ...(input.priorityMuscles ?? []).map((muscle) => REGION_OF_MUSCLE[muscle]),
    ]),
  ];
  const deprioritizedRegions = [
    ...new Set([
      ...(input.deprioritizedRegions ?? []),
      ...(input.deprioritizedMuscles ?? []).map((muscle) => REGION_OF_MUSCLE[muscle]),
    ]),
  ];
  assertEmphasisLimits(priorityRegions, deprioritizedRegions);

  const emphasisOf = (region: VolumeRegion): RegionEmphasis => {
    if (priorityRegions.includes(region)) return RegionEmphasis.PRIORITY;
    if (deprioritizedRegions.includes(region)) return RegionEmphasis.DEPRIORITIZED;
    return RegionEmphasis.NORMAL;
  };

  const regions: RegionVolumeTarget[] = [];
  const muscles: MuscleVolumeTarget[] = [];

  (Object.keys(VOLUME_REGIONS) as VolumeRegion[]).forEach((region) => {
    const definition = VOLUME_REGIONS[region];

    if (!trained.has(region)) {
      // Una región desactivada no aparece en el plan y no recibe volumen. El
      // trabajo indirecto que le llegue de los multiarticulares no se persigue.
      definition.muscles.forEach((muscle, index) => {
        muscles.push({
          muscle,
          region,
          meav: 0,
          share: definition.shares[index],
          emphasis: RegionEmphasis.NORMAL,
        });
      });
      return;
    }

    const emphasis = emphasisOf(region);
    const declared = input.declaredVolume?.[region];
    const useDeclared = declared !== undefined && Number.isFinite(declared) && declared > 0;
    const landmarks = useDeclared
      ? landmarksFromDeclaredVolume(region, input.level, input.goal, declared)
      : landmarksForRegion(region, input.level, input.goal);

    const meav = meavForRegion(landmarks, emphasis, input.level,
      priorityRegions.reduce((sum, r) => sum + prioritySlotsOf(r), 0) / PRIORITY_SLOT_BUDGET);

    regions.push({
      region,
      meav,
      landmarks,
      basis: useDeclared ? 'declared' : 'experience',
      emphasis,
      cappedByMrv: meav >= landmarks.mrv && landmarks.mrv > 0,
    });

    // El reparto se redondea acumulando el resto, para que la suma de las partes
    // sea exactamente el presupuesto de la región y no se pierda ni se invente
    // una serie al redondear.
    let assigned = 0;
    definition.muscles.forEach((muscle, index) => {
      const isLast = index === definition.muscles.length - 1;
      const share = definition.shares[index];
      const sets = isLast ? meav - assigned : roundSets(meav * share);
      assigned += sets;
      muscles.push({ muscle, region, meav: sets, share, emphasis });
    });
  });

  return { goal: input.goal, level: input.level, regions, muscles, isDeload: false, capacityCapped: false };
}

/**
 * Factor de volumen de la DESCARGA (PRD §3.4): la mitad del volumen que se venía
 * haciendo. La descarga recorta volumen y carga para disipar fatiga, no para
 * perder adaptaciones, así que el recorte no baja del volumen de mantenimiento:
 * bajar del MV durante la descarga costaría masa, que es justo lo contrario de su
 * función.
 */
export const DELOAD_VOLUME_FACTOR = 0.5;

/**
 * Plan de volumen de la DESCARGA, derivado del plan de acumulación.
 *
 * Se deriva del plan en vigor y no de las referencias, porque el recorte es
 * relativo a lo que el atleta VENÍA haciendo: la mitad de un mesociclo con la
 * espalda priorizada no es la mitad de un mesociclo genérico.
 *
 * Los énfasis se conservan para que la vista de mesociclo siga mostrando qué se
 * estaba priorizando, aunque durante la descarga no cambien el volumen.
 */
export function deloadVolumePlan(plan: VolumePlan): VolumePlan {
  const regions = plan.regions.map((region) => {
    const meav = Math.max(
      Math.min(region.landmarks.mv, region.meav),
      roundSets(region.meav * DELOAD_VOLUME_FACTOR),
    );
    return { ...region, meav, cappedByMrv: false };
  });

  const muscles = plan.muscles.map((muscle) => {
    const region = regions.find((candidate) => candidate.region === muscle.region);
    if (region === undefined) return { ...muscle, meav: 0 };
    const source = plan.regions.find((candidate) => candidate.region === muscle.region)!;
    // Se reparte proporcionalmente al presupuesto recortado para que las partes
    // sigan sumando el total, igual que en el plan de acumulación.
    const ratio = source.meav > 0 ? region.meav / source.meav : 0;
    return { ...muscle, meav: roundSets(muscle.meav * ratio) };
  });

  return { ...plan, regions, muscles, isDeload: true };
}

/** Series ATRIBUIDAS que pide el plan. No es el trabajo real: ver §3.6. */
export function totalAttributedSets(plan: VolumePlan): number {
  return plan.regions.reduce((sum, region) => sum + region.meav, 0);
}

export type TotalVolumeVerdict =
  | 'below'
  | 'within'
  | 'above'
  /**
   * La pregunta no aplica: el volumen de este plan está determinado por otra cosa
   * que el rango de recuperación, así que compararlo con él no dice nada. Ocurre en
   * la DESCARGA (está por debajo por diseño) y cuando manda el techo de TIEMPO
   * (está por debajo porque el atleta tiene tres horas, no porque el plan esté mal).
   */
  | 'not-applicable';

/**
 * Compara las series EJECUTADAS con el rango del objetivo y el nivel.
 * Se informa, no se corrige: es el atleta quien decide si acepta una carga alta,
 * pero debe saber que está fuera de rango.
 */
export function totalSetsVerdict(
  performedSets: number,
  goal: TrainingGoal,
  level: ExperienceLevel,
): TotalVolumeVerdict {
  const [min, max] = TOTAL_SETS_RANGE[goal][level];
  if (performedSets < min) return 'below';
  if (performedSets > max) return 'above';
  return 'within';
}

export interface VolumeWarning {
  region: VolumeRegion;
  kind: 'capped-by-mrv' | 'below-mev';
}

export function volumeWarnings(plan: VolumePlan): VolumeWarning[] {
  const warnings: VolumeWarning[] = [];
  plan.regions.forEach((region) => {
    if (region.cappedByMrv) {
      warnings.push({ region: region.region, kind: 'capped-by-mrv' });
    } else if (!plan.isDeload && region.meav < region.landmarks.mev) {
      // En una descarga estar por debajo del mínimo efectivo es el objetivo.
      warnings.push({ region: region.region, kind: 'below-mev' });
    }
  });
  return warnings;
}

/**
 * Regiones PROTEGIDAS frente al recorte por falta de tiempo.
 *
 * Son las grandes, movidas por multiarticulares. Cuando el tiempo no da para el
 * volumen que el atleta podría recuperar, estas conservan volumen de adaptación
 * efectiva mientras las demás bajan a mantenimiento: una serie de sentadilla o de
 * remo acredita varios músculos, así que es donde el minuto invertido rinde más.
 *
 * Las que quedan fuera se entrenan sobre todo con aislamiento, que involucra un
 * solo músculo y por tanto es lo primero que sobra cuando falta tiempo.
 */
export const PROTECTED_REGIONS: readonly VolumeRegion[] = [
  VolumeRegion.CHEST,
  VolumeRegion.BACK,
  VolumeRegion.QUADS,
  VolumeRegion.HAMSTRINGS,
  VolumeRegion.GLUTES,
];

/** Recorte máximo: en 2 hasta las regiones protegidas están en mantenimiento. */
export const MAX_SQUEEZE = 2;

/**
 * Volumen de una región con un recorte aplicado, en una escalera de DOS TRAMOS.
 *
 *   recorte 0 → 1   las no protegidas caen de su objetivo al MANTENIMIENTO;
 *                   las protegidas solo hasta el MÍNIMO EFECTIVO.
 *   recorte 1 → 2   las protegidas bajan también del mínimo efectivo al
 *                   mantenimiento.
 *
 * El orden es el que aplicaría un entrenador con una hora al día: sacrificar el
 * aislamiento antes que los patrones grandes, y solo tocar los grandes cuando ya
 * no queda otra. Que todo acabe en mantenimiento es un resultado aceptable; que
 * los grandes bajen antes que el aislamiento, no.
 */
export function squeezedMeav(region: RegionVolumeTarget, squeeze: number): number {
  const { mv, mev } = region.landmarks;
  const target = region.meav;
  const step = Math.max(0, squeeze);

  if (!PROTECTED_REGIONS.includes(region.region)) {
    return roundSets(target - Math.min(1, step) * (target - mv));
  }

  // Una región desprioriorizada ya puede estar por debajo del MEV: su suelo del
  // primer tramo es entonces su propio objetivo, no el MEV.
  const firstFloor = Math.min(target, mev);
  if (step <= 1) return roundSets(target - step * (target - firstFloor));
  return roundSets(firstFloor - Math.min(1, step - 1) * (firstFloor - mv));
}

/** Aplica un recorte a todo el plan, repartiendo cada región entre sus músculos. */
export function squeezePlan(plan: VolumePlan, squeeze: number): VolumePlan {
  if (squeeze <= 0) return plan;

  const regions = plan.regions.map((region) => ({
    ...region,
    meav: squeezedMeav(region, squeeze),
    cappedByMrv: false,
  }));

  const muscles = plan.muscles.map((muscle) => {
    const before = plan.regions.find((r) => r.region === muscle.region);
    const after = regions.find((r) => r.region === muscle.region);
    if (before === undefined || after === undefined || before.meav === 0) {
      return muscle;
    }
    return { ...muscle, meav: roundSets(muscle.meav * (after.meav / before.meav)) };
  });

  return { ...plan, regions, muscles, capacityCapped: true };
}

/** Convierte el plan al formato que persiste `Mesocycle.targetVolumePerGroup`. */
export function toTargetVolumePerGroup(plan: VolumePlan): Record<string, number> {
  const record: Record<string, number> = {};
  plan.muscles.forEach((target) => {
    if (target.meav > 0) record[target.muscle] = target.meav;
  });
  return record;
}
