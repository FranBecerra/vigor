/**
 * Selección de ejercicios — LÓGICA PURA (PRD §3.6).
 *
 * QUÉ ES DETERMINISTA Y QUÉ NO
 *   Deterministas (y por tanto lo que se testea): el volumen atribuido a cada
 *   músculo, el reparto de series, el equilibrio de vectores y los topes.
 *   No determinista: QUÉ ejercicio concreto cubre cada hueco. Al algoritmo le da
 *   igual que salga sentadilla hack o sentadilla libre.
 *
 *   La semilla existe como función de PRODUCTO, no como recurso de testing: el
 *   atleta refresca la propuesta hasta que le gusta el conjunto, y la misma
 *   semilla devuelve el mismo conjunto.
 *
 * SERIES EJECUTADAS FRENTE A ATRIBUIDAS
 *   Una serie de press de banca se EJECUTA una vez, pero acredita 1 serie al
 *   pecho y 0,5 al tríceps y al deltoides frontal: 2 series atribuidas por 1
 *   ejecutada. Por eso la suma de los MEAV de todos los músculos es muy superior
 *   al trabajo real, y por eso el generador debe razonar sobre ambas cifras: el
 *   MEAV se cubre con volumen atribuido, pero lo que cansa al atleta y ocupa la
 *   sesión son las series ejecutadas.
 *
 * SELECCIÓN PONDERADA, NO UNIFORME
 *   El peso de cada candidato combina su efectividad (campo del catálogo), un
 *   refuerzo a los multiarticulares mientras queda mucho volumen por cubrir, y
 *   una penalización a los vectores ya usados. Así los ejercicios de mayor
 *   estímulo salen más a menudo sin que los demás desaparezcan, y no se acumulan
 *   tres empujes sin ninguna tracción.
 */
import {
  ExerciseProfile,
  MovementVector,
  MuscleGroup,
  type Exercise,
} from '@/models';
import { stimulusQuality } from './exerciseCatalogue';
import { attributedVolumePerMinute, ISOLATION_VOLUME_PER_MINUTE } from './trainingCapacity';
import { totalSetsVerdict, type TotalVolumeVerdict, type VolumePlan } from './volumePlan';

/**
 * COMPOUND PATTERNS THAT ARE NEVER SKIPPED.
 *
 * The audit scores hypertrophy stimulus per set, and that is not the whole value
 * of a squat or a hip hinge. Intermuscular coordination, axial loading,
 * transferable strength and systemic adaptation are outside what those six
 * criteria measure, so a plan must not drop these patterns just because a machine
 * scores better on resistance-profile match or costs less fatigue.
 *
 * Measured before this existed: `KNEE_DOMINANT` was absent from 1 in 10 generated
 * plans, and quad leg extension outranked the barbell squat on stimulus alone.
 *
 * Each pattern is required only when the plan actually trains one of its gating
 * muscles, so a plan with no leg volume is not forced to include a squat.
 */
export const FOUNDATIONAL_PATTERNS: readonly {
  vector: MovementVector;
  muscles: readonly MuscleGroup[];
}[] = [
  { vector: MovementVector.KNEE_DOMINANT, muscles: [MuscleGroup.QUADS] },
  { vector: MovementVector.HIP_DOMINANT, muscles: [MuscleGroup.HAMSTRINGS, MuscleGroup.GLUTES] },
  {
    vector: MovementVector.PUSH_HORIZONTAL,
    muscles: [MuscleGroup.CHEST_MID_LOWER, MuscleGroup.CHEST_UPPER],
  },
  { vector: MovementVector.PULL_VERTICAL, muscles: [MuscleGroup.LATS] },
  {
    vector: MovementVector.PULL_HORIZONTAL,
    muscles: [MuscleGroup.LATS, MuscleGroup.RHOMBOIDS],
  },
];

/** Crédito que recibe un músculo secundario por cada serie ejecutada (PRD §3.2). */
export const SECONDARY_CREDIT = 0.5;

export interface SelectionConfig {
  /** Series mínimas para que un ejercicio merezca estar en el plan. */
  minSetsPerExercise: number;
  /** Tope de series por ejercicio y microciclo. */
  maxSetsPerExercise: number;
  /** Tope de ejercicios por músculo, para no fragmentar el volumen. */
  maxExercisesPerMuscle: number;
  /**
   * Refuerzo al peso de los multiarticulares mientras el músculo tiene mucho
   * volumen pendiente. Los pone primero sin necesidad de una regla de orden
   * aparte: cuando la necesidad es alta, su peso domina.
   */
  compoundBoost: number;
  /**
   * Exponente de la eficiencia por minuto cuando el plan está limitado por
   * TIEMPO. A 1 el sesgo es proporcional a la eficiencia; a 2 se acentúa lo
   * suficiente para que el aislamiento salga solo cuando no hay alternativa.
   */
  timeEfficiencyExponent: number;
  /**
   * Cuánto penaliza repetir un vector ya usado. Reparte los patrones de la sesión.
   */
  vectorPenalty: number;
  /**
   * Lo mismo cuando el techo es el TIEMPO, y mucho más bajo.
   *
   * La penalización por vector es buena para el equilibrio pero, con el tiempo
   * apretado, trabaja EN CONTRA del objetivo: los ejercicios de aislamiento suelen
   * ocupar vectores que los multiarticulares no usan, así que premiar la variedad
   * de patrones los favorece justo cuando son lo primero que debería sobrar.
   * Medido: con la penalización normal salían sentadilla sissy y extensión de
   * cuádriceps en un plan de tres horas semanales.
   */
  vectorPenaltyWhenTimeConstrained: number;
  /**
   * Tope de ejercicios por músculo cuando el techo es el TIEMPO. Más bajo que el
   * normal: con menos plazas, las ocupan los ejercicios de más peso, que son los
   * de mayor rendimiento por minuto.
   */
  maxExercisesPerMuscleWhenTimeConstrained: number;
}

/**
 * Valores por defecto.
 *
 * El mínimo de 3 series es deliberado y no cosmético: con un mínimo de 2 el
 * algoritmo repartía 13 series de deltoides lateral entre cuatro variantes de
 * elevación lateral. No eran ejercicios raros, sino redundantes, y es el mismo
 * defecto de fondo. Concentrar el volumen en menos ejercicios y mejores es tanto
 * mejor programación como mejor propuesta.
 */
export const DEFAULT_SELECTION_CONFIG: SelectionConfig = {
  minSetsPerExercise: 3,
  maxSetsPerExercise: 6,
  maxExercisesPerMuscle: 3,
  compoundBoost: 2.5,
  timeEfficiencyExponent: 2,
  vectorPenalty: 0.6,
  vectorPenaltyWhenTimeConstrained: 0.15,
  maxExercisesPerMuscleWhenTimeConstrained: 2,
};

export interface SelectedExercise {
  exercise: Exercise;
  /** Series EJECUTADAS de este ejercicio por microciclo. */
  sets: number;
}

export interface UnmetVolume {
  muscle: MuscleGroup;
  /** Series atribuidas que pedía el plan. */
  target: number;
  /** Series atribuidas que se han conseguido. */
  attributed: number;
  /**
   * true si el déficit es menor que el mínimo de series de un ejercicio, así que
   * no se puede cerrar sin pasarse del objetivo.
   *
   * La distinción importa: un hueco de 1,5 series en el deltoides frontal no es
   * un fallo de programación, es el resto que queda cuando el músculo se nutre
   * de trabajo indirecto. Añadir tres series de elevación frontal para cerrarlo
   * empeoraría el plan. Un hueco de 8 series sí es un problema real, y suele
   * significar que el material disponible o los vetos dejaron al músculo sin
   * ejercicios.
   */
  uncloseable: boolean;
}

export interface SelectionResult {
  selected: SelectedExercise[];
  /** Series que el atleta EJECUTA de verdad en el microciclo. */
  performedSets: number;
  /** Series ATRIBUIDAS: principal completo más 0,5 por secundario. */
  attributedSets: number;
  attributedByMuscle: Partial<Record<MuscleGroup, number>>;
  vectorCounts: Partial<Record<MovementVector, number>>;
  /**
   * Foundational patterns the plan trains muscles for but could not include,
   * because the athlete's equipment or vetoes leave no compound option. Reported
   * rather than silently skipped: it is the kind of gap worth telling someone about.
   */
  missingFoundationalPatterns: MovementVector[];
  /** Músculos cuyo objetivo no se ha podido cubrir, y por cuánto. */
  unmet: UnmetVolume[];
  /**
   * Si las series EJECUTADAS caen dentro del rango de volumen total del objetivo
   * y el nivel. Es la comprobación de sensatez del plan completo: sumar bien
   * músculo a músculo no garantiza que el conjunto sea razonable.
   */
  totalVerdict: TotalVolumeVerdict;
}

// --- Aleatoriedad reproducible ---------------------------------------------

/**
 * Generador con semilla (mulberry32). Hace falta uno propio porque `Math.random`
 * no acepta semilla, y sin semilla el botón de refrescar no podría volver a una
 * propuesta anterior.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Elige un elemento con probabilidad proporcional a su peso.
 * Con pesos no positivos cae a una elección uniforme, para no devolver nada
 * cuando todos los candidatos están penalizados al mismo tiempo.
 */
export function weightedPick<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  random: () => number,
): T | undefined {
  if (items.length === 0) return undefined;

  const weights = items.map((item) => Math.max(0, weightOf(item)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  if (total <= 0) return items[Math.floor(random() * items.length)];

  let threshold = random() * total;
  for (let index = 0; index < items.length; index += 1) {
    threshold -= weights[index];
    if (threshold < 0) return items[index];
  }
  return items[items.length - 1];
}

// --- Selección --------------------------------------------------------------

const COMPOUND_PROFILES: readonly ExerciseProfile[] = [
  ExerciseProfile.COMPOUND_PRIMARY,
  ExerciseProfile.COMPOUND_SECONDARY,
];

function isCompound(exercise: Exercise): boolean {
  return COMPOUND_PROFILES.includes(exercise.profile);
}

export interface SelectionInput {
  /** Plan de volumen. Solo se atienden los músculos con objetivo mayor que cero. */
  volumePlan: VolumePlan;
  /** Catálogo YA filtrado por material disponible y vetos. */
  catalogue: readonly Exercise[];
  seed: number;
  config?: Partial<SelectionConfig>;
  /**
   * true cuando el plan está recortado por falta de TIEMPO, no de recuperación.
   *
   * Mantiene el refuerzo a los multiarticulares activo aunque quede poco volumen
   * por cubrir. Sin esto la lógica se vuelve del revés justo cuando más importa:
   * el refuerzo normal se apaga al bajar el volumen pendiente, así que un plan
   * recortado elegiría MÁS aislamiento, que es lo contrario de lo que conviene
   * cuando cada minuto cuenta. Un multiarticular acredita varios músculos por
   * serie ejecutada, así que rinde más por minuto.
   */
  timeConstrained?: boolean;
}

/** Acumula el crédito de un ejercicio en el mapa de volumen atribuido. */
function credit(
  attributed: Map<MuscleGroup, number>,
  exercise: Exercise,
  sets: number,
): void {
  attributed.set(exercise.primaryMuscle, (attributed.get(exercise.primaryMuscle) ?? 0) + sets);
  exercise.secondaryMuscles.forEach((muscle) => {
    attributed.set(muscle, (attributed.get(muscle) ?? 0) + sets * SECONDARY_CREDIT);
  });
}

export function selectExercises(input: SelectionInput): SelectionResult {
  const config = { ...DEFAULT_SELECTION_CONFIG, ...input.config };
  const random = createRandom(input.seed);
  const maxExercisesPerMuscle =
    input.timeConstrained === true
      ? Math.min(config.maxExercisesPerMuscle, config.maxExercisesPerMuscleWhenTimeConstrained)
      : config.maxExercisesPerMuscle;

  const targets = new Map<MuscleGroup, number>();
  input.volumePlan.muscles.forEach((target) => {
    if (target.meav > 0) targets.set(target.muscle, target.meav);
  });

  const attributed = new Map<MuscleGroup, number>();
  const vectorCounts = new Map<MovementVector, number>();
  const chosen = new Map<string, SelectedExercise>();
  const countPerMuscle = new Map<MuscleGroup, number>();
  /** Músculos para los que ya se agotaron los candidatos o el tope. */
  const closed = new Set<MuscleGroup>();

  /** Volumen que le falta a un músculo, dado su objetivo. */
  const remainingOf = (muscle: MuscleGroup, target: number): number =>
    target - (attributed.get(muscle) ?? 0);

  /** Músculo con más volumen pendiente que todavía admite otro ejercicio. */
  const neediest = (): { muscle: MuscleGroup; remaining: number } | undefined => {
    let best: { muscle: MuscleGroup; remaining: number } | undefined;
    targets.forEach((target, muscle) => {
      if (closed.has(muscle)) return;
      const remaining = remainingOf(muscle, target);
      if (remaining < config.minSetsPerExercise) return;
      if (best === undefined || remaining > best.remaining) best = { muscle, remaining };
    });
    return best;
  };

  // FASE 0 — el suelo de patrones fundamentales. Se coloca ANTES del reparto por
  // volumen para que un patrón de sentadilla o de dominante de cadera no dependa
  // de que gane un sorteo ponderado, y para que el volumen que consume se
  // descuente del objetivo en lugar de sumarse encima.
  const missingFoundationalPatterns: MovementVector[] = [];
  FOUNDATIONAL_PATTERNS.forEach(({ vector, muscles }) => {
    const trains = muscles.some((muscle) => (targets.get(muscle) ?? 0) > 0);
    if (!trains) return;

    const candidates = input.catalogue.filter(
      (exercise) =>
        exercise.movementVector === vector &&
        isCompound(exercise) &&
        !chosen.has(exercise.id) &&
        targets.has(exercise.primaryMuscle),
    );
    if (candidates.length === 0) {
      missingFoundationalPatterns.push(vector);
      return;
    }

    const pick = weightedPick(candidates, (exercise) => stimulusQuality(exercise), random)!;
    const sets = config.minSetsPerExercise;
    chosen.set(pick.id, { exercise: pick, sets });
    countPerMuscle.set(
      pick.primaryMuscle,
      (countPerMuscle.get(pick.primaryMuscle) ?? 0) + 1,
    );
    vectorCounts.set(vector, (vectorCounts.get(vector) ?? 0) + 1);
    credit(attributed, pick, sets);
  });

  // FASE 1 — elegir ejercicios. Cada uno entra con el mínimo de series; el
  // ajuste fino se hace en la fase 2, cuando ya se conoce el crédito indirecto
  // que se han repartido entre ellos.
  for (;;) {
    const next = neediest();
    if (next === undefined) break;
    const { muscle, remaining } = next;

    if ((countPerMuscle.get(muscle) ?? 0) >= maxExercisesPerMuscle) {
      closed.add(muscle);
      continue;
    }

    const available = input.catalogue.filter(
      (exercise) => exercise.primaryMuscle === muscle && !chosen.has(exercise.id),
    );
    if (available.length === 0) {
      closed.add(muscle);
      continue;
    }

    // Con el TIEMPO como techo, el aislamiento solo entra cuando no queda ningún
    // multiarticular para ese músculo. Es una regla y no un sesgo a propósito: con
    // una ponderación probabilística el pecho salía alguna vez con contractor y
    // cruces como único trabajo y sin ningún press, y eso es un defecto visible
    // para quien entrena tres horas a la semana. Los músculos sin ningún
    // multiarticular en el catálogo (bíceps, deltoides lateral, gemelos, core)
    // reciben su aislamiento igual, porque ahí no hay alternativa.
    const compoundsAvailable = available.filter(isCompound);
    const candidates =
      input.timeConstrained === true && compoundsAvailable.length > 0
        ? compoundsAvailable
        : available;

    // `candidates` no está vacío, así que weightedPick siempre devuelve uno.
    const pick = weightedPick(
      candidates,
      (exercise) => {
        let weight = stimulusQuality(exercise);

        if (input.timeConstrained === true) {
          // Con el tiempo como techo, el criterio es el VOLUMEN POR MINUTO, no un
          // refuerzo plano a los multiarticulares. Un remo con barra acredita tres
          // músculos y medio por serie en los mismos 220 s que una extensión de
          // cuádriceps acredita uno: cuatro veces más rendimiento por minuto. Es
          // el cálculo que hace que el aislamiento sea lo primero que sobra.
          weight *=
            (attributedVolumePerMinute(exercise) / ISOLATION_VOLUME_PER_MINUTE) **
            config.timeEfficiencyExponent;
        } else if (isCompound(exercise) && remaining > config.minSetsPerExercise * 2) {
          weight *= config.compoundBoost;
        }

        // Un vector ya muy usado pesa menos, para que la sesión no acumule el
        // mismo patrón.
        const used = vectorCounts.get(exercise.movementVector) ?? 0;
        const penalty =
          input.timeConstrained === true
            ? config.vectorPenaltyWhenTimeConstrained
            : config.vectorPenalty;
        return weight / (1 + used * penalty);
      },
      random,
    )!;

    const sets = Math.min(config.minSetsPerExercise, config.maxSetsPerExercise);
    chosen.set(pick.id, { exercise: pick, sets });
    countPerMuscle.set(muscle, (countPerMuscle.get(muscle) ?? 0) + 1);
    vectorCounts.set(pick.movementVector, (vectorCounts.get(pick.movementVector) ?? 0) + 1);
    credit(attributed, pick, sets);
  }

  // FASE 2 — repartir el volumen que falta entre los ejercicios ya elegidos,
  // empezando por los de mayor efectividad. Sumar series a un buen ejercicio es
  // preferible a añadir otro ejercicio mediocre.
  const byStimulus = [...chosen.values()].sort(
    (a, b) => stimulusQuality(b.exercise) - stimulusQuality(a.exercise),
  );

  let progressed = true;
  while (progressed) {
    progressed = false;
    targets.forEach((target, muscle) => {
      if (remainingOf(muscle, target) < 1) return;
      const entry = byStimulus.find(
        (candidate) =>
          candidate.exercise.primaryMuscle === muscle &&
          candidate.sets < config.maxSetsPerExercise,
      );
      if (entry === undefined) return;
      entry.sets += 1;
      credit(attributed, entry.exercise, 1);
      progressed = true;
    });
  }

  const selected = [...chosen.values()];
  const performedSets = selected.reduce((sum, entry) => sum + entry.sets, 0);
  const attributedSets = selected.reduce(
    (sum, entry) => sum + entry.sets * (1 + entry.exercise.secondaryMuscles.length * SECONDARY_CREDIT),
    0,
  );

  const unmet: UnmetVolume[] = [];
  targets.forEach((target, muscle) => {
    const got = attributed.get(muscle) ?? 0;
    const deficit = target - got;
    // Medio punto de tolerancia: el crédito secundario se mueve en medios y un
    // déficit de 0,5 series no es un hueco real de programación.
    if (deficit > 0.5) {
      unmet.push({
        muscle,
        target,
        attributed: got,
        uncloseable: deficit < config.minSetsPerExercise,
      });
    }
  });

  return {
    selected,
    performedSets,
    attributedSets,
    // Una descarga y un plan recortado por tiempo están por debajo del rango de
    // recuperación por construcción, así que compararlos con él daría siempre
    // 'below' y el veredicto no diría nada de lo que importa.
    totalVerdict:
      input.volumePlan.isDeload || input.volumePlan.capacityCapped
        ? 'not-applicable'
        : totalSetsVerdict(performedSets, input.volumePlan.goal, input.volumePlan.level),
    attributedByMuscle: Object.fromEntries(attributed) as Partial<Record<MuscleGroup, number>>,
    vectorCounts: Object.fromEntries(vectorCounts) as Partial<Record<MovementVector, number>>,
    missingFoundationalPatterns,
    unmet,
  };
}
