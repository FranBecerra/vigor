#!/usr/bin/env npx tsx
/**
 * Banco de pruebas del GENERADOR, relanzable a mano.
 *
 * La PRIMERA LÍNEA es el veredicto: dice de un vistazo si el plan es sano, sin
 * leer el resto. Lo demás es el detalle para cuando el veredicto sorprende.
 *
 * Uso:
 *   npm run volume
 *   npm run volume -- --brief                     solo el veredicto
 *   npm run volume -- --goal=strength
 *   npm run volume -- --level=beginner
 *   npm run volume -- --priority-regions=BACK,QUADS
 *   npm run volume -- --deprioritize-regions=CALVES,CORE
 *   npm run volume -- --sessions=3 --minutes=60
 *   npm run volume -- --split=upper_lower
 *   npm run volume -- --deload                    el microciclo de descarga
 *   npm run volume -- --regions=CHEST,BACK,QUADS  solo estas
 *   npm run volume -- --add-regions=CALVES
 *   npm run volume -- --declared=BACK:20
 *   npm run volume -- --seed=7
 *   npm run volume -- --seeds=5
 *   npm run volume -- --equipment=DUMBBELL,BODYWEIGHT
 *   npm run volume -- --veto=press-banca
 *   npm run volume -- --compare
 */
import {
  Equipment,
  ExerciseGenerationTier,
  MuscleGroup,
} from '../src/models/biomechanics';
import { ExperienceLevel, SplitStructure } from '../src/models/athlete';
import {
  DEFAULT_TRAINED_REGIONS,
  EmphasisLimitError,
  RegionEmphasis,
  TOTAL_SETS_RANGE,
  TrainingGoal,
  VOLUME_REGIONS,
  VolumeRegion,
  buildVolumePlan,
  deloadVolumePlan,
  totalAttributedSets,
  volumeWarnings,
  type VolumePlan,
} from '../src/services/training/volumePlan';
import { EXERCISE_CATALOGUE, filterCatalogue } from '../src/services/training/exerciseCatalogue';
import {
  equipmentFamily,
  selectExercises,
  type SelectionResult,
} from '../src/services/training/exerciseSelection';
import { approximateSetCapacity } from '../src/services/training/trainingCapacity';
import { stimulusQuality } from '../src/services/training/exerciseCatalogue';
import { planMesocycle, type MesocyclePlan } from '../src/services/training/mesocyclePlanner';
import { isSessionAnchor } from '../src/services/training/sessionDistribution';
import { DEFAULT_GENERATOR_EQUIPMENT } from '../src/services/training/generatorDefaults';
import {
  exercisePrescription,
  formatRepRange,
} from '../src/services/training/exercisePrescription';

// --- Parámetros -------------------------------------------------------------

/** Error de uso del script: se imprime limpio, sin traza. */
class UsageError extends Error {}

function fail(message: string): never {
  throw new UsageError(message);
}

function arg(name: string): string | undefined {
  return process.argv
    .find((candidate: string) => candidate.startsWith(`--${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseLevel(raw: string | undefined): ExperienceLevel {
  const map: Record<string, ExperienceLevel> = {
    beginner: ExperienceLevel.BEGINNER,
    intermediate: ExperienceLevel.INTERMEDIATE,
    advanced: ExperienceLevel.ADVANCED,
  };
  if (raw === undefined) return ExperienceLevel.INTERMEDIATE;
  const level = map[raw.toLowerCase()];
  if (!level) fail(`Nivel desconocido: "${raw}". Usa beginner, intermediate o advanced.`);
  return level;
}

function parseGoal(raw: string | undefined): TrainingGoal {
  const map: Record<string, TrainingGoal> = {
    hypertrophy: TrainingGoal.HYPERTROPHY,
    hipertrofia: TrainingGoal.HYPERTROPHY,
    strength: TrainingGoal.STRENGTH,
    fuerza: TrainingGoal.STRENGTH,
  };
  if (raw === undefined) return TrainingGoal.HYPERTROPHY;
  const goal = map[raw.toLowerCase()];
  if (!goal) fail(`Objetivo desconocido: "${raw}". Usa hypertrophy o strength.`);
  return goal;
}

function parseSplit(raw: string | undefined): SplitStructure {
  if (raw === undefined) return SplitStructure.AUTO;
  const normalized = raw.trim().toUpperCase();
  if (!Object.values(SplitStructure).includes(normalized as SplitStructure)) {
    fail(`Unknown split: "${raw}". Use ${Object.values(SplitStructure).join(', ')}.`);
  }
  return normalized as SplitStructure;
}

/** Valida contra el enum: un valor mal escrito debe fallar, no ignorarse. */
function parseEnumList<T extends Record<string, string>>(
  enumObject: T,
  raw: string | undefined,
  label: string,
): T[keyof T][] {
  if (!raw) return [];
  return raw.split(',').map((name) => {
    const key = name.trim().toUpperCase();
    if (!Object.values(enumObject).includes(key)) {
      fail(
        `${label} desconocido: "${name.trim()}".\nVálidos: ${Object.values(enumObject).join(', ')}`,
      );
    }
    return key as T[keyof T];
  });
}

function parseDeclared(raw: string | undefined): Partial<Record<VolumeRegion, number>> {
  if (!raw) return {};
  const declared: Partial<Record<VolumeRegion, number>> = {};
  raw.split(',').forEach((pair) => {
    const [name, value] = pair.split(':');
    const [region] = parseEnumList(VolumeRegion, name, 'Región');
    const sets = Number(value);
    if (!Number.isFinite(sets) || sets <= 0) fail(`Series inválidas para ${name}: "${value}".`);
    declared[region] = sets;
  });
  return declared;
}

function parseNumber(raw: string | undefined, fallback: number, label: string): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) fail(`${label} inválido: "${raw}".`);
  return value;
}

// --- Presentación -----------------------------------------------------------

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const LIME = '\x1b[38;5;154m';
const AMBER = '\x1b[38;5;214m';
const AQUA = '\x1b[38;5;79m';

/** Ancho VISIBLE: los códigos de color ocupan caracteres pero no pantalla. */
function visibleWidth(text: string): number {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '').length;
}

function pad(text: string, width: number): string {
  const missing = width - visibleWidth(text);
  return missing <= 0 ? text : text + ' '.repeat(missing);
}

function padLeft(text: string, width: number): string {
  const missing = width - visibleWidth(text);
  return missing <= 0 ? text : ' '.repeat(missing) + text;
}

/** Una decimal solo cuando hace falta: el crédito secundario va en medios. */
function num(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Nombre corto de región, para que las tablas quepan. */
function short(region: VolumeRegion): string {
  return region.toLowerCase().replace('delts_', 'delt-').replace('hamstrings', 'isquios');
}

const EMPHASIS_MARK: Record<RegionEmphasis, string> = {
  [RegionEmphasis.PRIORITY]: `${LIME}▲${RESET}`,
  [RegionEmphasis.NORMAL]: ` `,
  [RegionEmphasis.DEPRIORITIZED]: `${DIM}▼${RESET}`,
};

/** Línea de CAPACIDAD: qué techo ha limitado el plan y cuánto tiempo cuesta. */
function printCapacity(result: MesocyclePlan, sessions: number, minutes: number): void {
  const limited = {
    catalogue: `${AMBER}NO ELIGIBLE EXERCISES${RESET}`,
    recovery: `${LIME}limita la recuperación${RESET}`,
    time: `${AMBER}limita el TIEMPO${RESET}`,
    'insufficient-time': `${AMBER}${BOLD}TIEMPO INSUFICIENTE${RESET}`,
  }[result.limitedBy];

  console.log(
    `${DIM}capacidad${RESET}  ${sessions} × ${minutes} min  ${DIM}·${RESET} ` +
      `${Math.round(result.estimatedWorkMinutes)} de ${result.availableWorkMinutes} min de trabajo  ` +
      `${DIM}·${RESET} ${limited}` +
      (result.squeeze > 0 ? `  ${DIM}·${RESET} ${DIM}recorte ${result.squeeze.toFixed(2)}${RESET}` : ''),
  );
}

function printInputs(input: {
  name: string;
  level: ExperienceLevel;
  goal: TrainingGoal;
  sessions: number;
  minutes: number;
  split: SplitStructure;
  equipment: readonly Equipment[];
  priorityRegions: readonly VolumeRegion[];
  deprioritizedRegions: readonly VolumeRegion[];
  seed: number;
  vetoed: readonly string[];
}): void {
  console.log(`\n${DIM}INPUTS${RESET}`);
  console.log(`  name             ${input.name || '(empty)'}`);
  console.log(`  level / goal     ${input.level} / ${input.goal}`);
  console.log(`  capacity         ${input.sessions} × ${input.minutes} min`);
  console.log(`  split            ${input.split}`);
  console.log(`  equipment        ${input.equipment.join(', ')}`);
  console.log(`  priority         ${input.priorityRegions.join(', ') || '(none)'}`);
  console.log(`  deprioritized    ${input.deprioritizedRegions.join(', ') || '(none)'}`);
  console.log(`  vetoed           ${input.vetoed.join(', ') || '(none)'}`);
  console.log(`  seed             ${input.seed}`);
}

function printSessions(result: MesocyclePlan): void {
  console.log(`\n${DIM}SESSIONS · ${result.distribution.resolvedSplit}${RESET}`);
  result.distribution.sessions.forEach((session) => {
    const sets = session.exercises.reduce((sum, entry) => sum + entry.sets, 0);
    console.log(
      `\n${BOLD}${session.index + 1}. ${session.focus}${RESET}  ` +
        `${AQUA}${sets} sets${RESET} · ${Math.round(session.estimatedWorkMinutes)} min`,
    );
    session.exercises.forEach((entry) => {
      const prescription = exercisePrescription(result.plan.goal, entry.exercise.profile);
      console.log(
        `   ${pad(entry.exercise.name, 44)} ` +
          `${padLeft(`${entry.sets} × ${formatRepRange(prescription.reps)}`, 10)} ` +
          `${DIM}RPE ${10 - prescription.targetRIR}${RESET}`,
      );
    });
  });
  result.distribution.structureWarnings.forEach((warning) =>
    console.log(`${AMBER} ! ${warning.kind}${RESET} ${DIM}${warning.detail}${RESET}`),
  );
  result.distribution.sequencingWarnings.forEach((warning) =>
    console.log(
      `${AMBER} ! sequencing${RESET} ${DIM}${warning.precedingSessionIndex ?? 'previous'} → ` +
        `${warning.followingSessionIndex}; risk ${warning.risk.toFixed(1)}${RESET}`,
    ),
  );
}

function printCapacitySeedAudit(
  count: number,
  planForSeed: (seed: number) => MesocyclePlan,
): void {
  const plans = Array.from({ length: count }, (_, index) => planForSeed(index + 1));
  const performed = plans.map((plan) => plan.selection.performedSets);
  const minimumSessionSets = plans.map((plan) =>
    Math.min(
      ...plan.distribution.sessions.map((session) =>
        session.exercises.reduce((sum, entry) => sum + entry.sets, 0),
      ),
    ),
  );
  const loadSpread = plans.map(
    (plan) => plan.distribution.maxSessionWorkMinutes - plan.distribution.minSessionWorkMinutes,
  );
  const duplicatePlans = plans.filter((plan) => {
    const ids = plan.distribution.sessions.flatMap((session) =>
      session.exercises.map((entry) => entry.exercise.id),
    );
    return new Set(ids).size !== ids.length;
  }).length;
  const fallbackPlans = plans.filter((plan) =>
    plan.selection.selected.some(
      (entry) => entry.exercise.generationTier === ExerciseGenerationTier.FALLBACK,
    ),
  ).length;
  const sessionsWithoutAnchor = plans.reduce(
    (total, plan) =>
      total +
      plan.distribution.sessions.filter((session) => {
        const first = session.exercises[0];
        return first === undefined || !isSessionAnchor(first);
      }).length,
    0,
  );
  const equipmentShares = plans.map((plan) => {
    const families = plan.selection.selected.map((entry) => equipmentFamily(entry.exercise));
    return {
      free: families.filter((family) => family === 'FREE_WEIGHT').length / families.length,
      guided: families.filter((family) => family === 'GUIDED').length / families.length,
    };
  });

  console.log(`\n${DIM}SEED AUDIT · ${count} plans${RESET}`);
  console.log(
    `  performed sets      ${Math.min(...performed)}–${Math.max(...performed)}\n` +
      `  min session sets   ${Math.min(...minimumSessionSets)}\n` +
      `  max load spread    ${Math.round(Math.max(...loadSpread))} min\n` +
      `  repeated exercise  ${duplicatePlans} plans\n` +
      `  fallback exercise  ${fallbackPlans} plans\n` +
      `  sessions no anchor ${sessionsWithoutAnchor} of ${count * plans[0].distribution.sessions.length}\n` +
      `  free-weight share  ${Math.round(Math.min(...equipmentShares.map((item) => item.free)) * 100)}–` +
      `${Math.round(Math.max(...equipmentShares.map((item) => item.free)) * 100)}%\n` +
      `  guided share       ${Math.round(Math.min(...equipmentShares.map((item) => item.guided)) * 100)}–` +
      `${Math.round(Math.max(...equipmentShares.map((item) => item.guided)) * 100)}%`,
  );
}

/**
 * VEREDICTO en una línea. Es lo primero que se imprime, para saber si el plan es
 * sano sin leer el resto.
 */
function printVerdict(
  result: SelectionResult,
  plan: VolumePlan,
  label: string,
  accumulationSets?: number,
  /** true cuando ni en mantenimiento cabe el plan: el veredicto NO puede ser sano. */
  insufficientTime = false,
): void {
  const [min, max] = TOTAL_SETS_RANGE[plan.goal][plan.level];
  const gaps = result.unmet.filter((u) => !u.uncloseable).length;
  const warnings = volumeWarnings(plan).length;
  const ok =
    !insufficientTime &&
    (result.totalVerdict === 'within' || result.totalVerdict === 'not-applicable') &&
    gaps === 0;

  const badge = ok ? `${LIME}${BOLD}✓${RESET}` : `${AMBER}${BOLD}!${RESET}`;
  const rangeText =
    accumulationSets !== undefined
      ? `${DIM}${Math.round((result.performedSets / accumulationSets) * 100)} % de las ` +
        `${accumulationSets} de acumulación${RESET}`
      : result.totalVerdict === 'not-applicable'
        ? `${DIM}el rango ${min}-${max} no aplica${RESET}`
        : result.totalVerdict === 'within'
          ? `${DIM}de ${min}-${max}${RESET}`
          : `${AMBER}FUERA de ${min}-${max}${RESET}`;
  const ratio = result.performedSets > 0 ? result.attributedSets / result.performedSets : 0;

  console.log(
    `\n${badge} ${label}  ` +
      `${AQUA}${BOLD}${result.performedSets}${RESET} ejecutadas ${rangeText}  ` +
      `${DIM}·${RESET} ${LIME}${num(result.attributedSets)}${RESET} atribuidas ${DIM}${ratio.toFixed(2)}×${RESET}  ` +
      `${DIM}·${RESET} ${result.selected.length} ejercicios  ` +
      `${DIM}·${RESET} ${gaps === 0 ? `${DIM}sin huecos${RESET}` : `${AMBER}${gaps} huecos${RESET}`}` +
      (warnings > 0 ? `  ${DIM}·${RESET} ${AMBER}${warnings} avisos${RESET}` : ''),
  );
}

function printPlan(plan: VolumePlan): void {
  const rows = plan.regions.map((region) => {
    const parts = plan.muscles
      .filter((m) => m.region === region.region && m.meav > 0)
      .map((m) => `${short(m.muscle as unknown as VolumeRegion)} ${m.meav}`)
      .join(', ');
    return { region, parts };
  });

  console.log(
    `\n${DIM}${pad('REGIÓN', 16)}${padLeft('MV', 4)}${padLeft('MEV', 5)}${padLeft('MAV', 5)}` +
      `${padLeft('MRV', 5)}${padLeft('MEAV', 7)}   REPARTO${RESET}`,
  );
  rows.forEach(({ region, parts }) => {
    const { landmarks: l } = region;
    const flags = [
      region.cappedByMrv ? `${AMBER}tope${RESET}` : '',
      region.basis === 'declared' ? `${DIM}decl${RESET}` : '',
    ]
      .filter(Boolean)
      .join(' ');
    console.log(
      `${EMPHASIS_MARK[region.emphasis]}${pad(short(region.region), 15)}` +
        padLeft(String(l.mv), 4) +
        padLeft(String(l.mev), 5) +
        padLeft(String(l.mav), 5) +
        padLeft(String(l.mrv), 5) +
        padLeft(`${LIME}${BOLD}${region.meav}${RESET}`, 7) +
        `   ${DIM}${parts}${RESET} ${flags}`,
    );
  });

  const off = (Object.keys(VOLUME_REGIONS) as VolumeRegion[]).filter(
    (region) => !plan.regions.some((r) => r.region === region),
  );
  console.log(
    `${DIM} ${pad('', 15)}${padLeft('', 19)}${RESET}` +
      padLeft(`${BOLD}${totalAttributedSets(plan)}${RESET}`, 7) +
      `   ${DIM}atribuidas · ${plan.regions.length} regiones` +
      (off.length > 0 ? ` · sin entrenar: ${off.map(short).join(', ')}` : '') +
      RESET,
  );

  volumeWarnings(plan).forEach((w) => {
    const text =
      w.kind === 'capped-by-mrv' ? 'recortado por tocar el MRV' : 'por debajo del mínimo efectivo';
    console.log(`${AMBER} ! ${RESET}${pad(short(w.region), 15)}${DIM}${text}${RESET}`);
  });
}

function printExercises(result: SelectionResult, plan: VolumePlan): void {
  console.log('');
  plan.regions.forEach((region) => {
    const muscles = plan.muscles.filter((m) => m.region === region.region && m.meav > 0);
    const entries = result.selected.filter((e) =>
      muscles.some((m) => m.muscle === e.exercise.primaryMuscle),
    );
    entries.forEach((entry, index) => {
      const label = index === 0 ? short(region.region) : '';
      const sec =
        entry.exercise.secondaryMuscles.length > 0
          ? `${DIM}+${entry.exercise.secondaryMuscles.map((m) => m.toLowerCase()).join(' +')}${RESET}`
          : '';
      console.log(
        `${EMPHASIS_MARK[index === 0 ? region.emphasis : RegionEmphasis.NORMAL]}` +
          `${pad(label, 15)}${LIME}${padLeft(String(entry.sets), 2)}${RESET}${DIM}×${RESET} ` +
          pad(entry.exercise.name, 42) +
          `${DIM}q${stimulusQuality(entry.exercise).toFixed(1)} ${pad(entry.exercise.equipment.toLowerCase(), 14)}${RESET}${sec}`,
      );
    });
  });

  const gaps = result.unmet.filter((u) => !u.uncloseable);
  if (gaps.length > 0) {
    console.log(`\n${AMBER}HUECOS${RESET} ${DIM}revisar material o vetos${RESET}`);
    gaps.forEach((u) =>
      console.log(
        `${AMBER} ! ${RESET}${pad(u.muscle.toLowerCase(), 20)}` +
          `${DIM}faltan ${num(u.target - u.attributed)} de ${u.target}${RESET}`,
      ),
    );
  }
  console.log('');
}

function printSeedComparison(
  plan: VolumePlan,
  catalogue: typeof EXERCISE_CATALOGUE,
  count: number,
): void {
  console.log(
    `\n${DIM}${pad('SEMILLA', 9)}${padLeft('EJEC.', 7)}${padLeft('ATRIB.', 8)}` +
      `${padLeft('EJERC.', 8)}   COMÚN CON LA 1${RESET}`,
  );
  let firstIds: string[] = [];
  for (let seed = 1; seed <= count; seed += 1) {
    const result = selectExercises({ volumePlan: plan, catalogue, seed });
    let shared = '';
    if (seed === 1) firstIds = result.selected.map((e) => e.exercise.id);
    else {
      const ids = new Set(result.selected.map((e) => e.exercise.id));
      const count = firstIds.filter((id) => ids.has(id)).length;
      shared = `${DIM}   ${count} de ${firstIds.length}${RESET}`;
    }
    const mark = result.totalVerdict === 'within' ? `${LIME}✓${RESET}` : `${AMBER}!${RESET}`;
    console.log(
      `${mark}${pad(String(seed), 8)}` +
        padLeft(`${AQUA}${result.performedSets}${RESET}`, 7) +
        padLeft(`${LIME}${num(result.attributedSets)}${RESET}`, 8) +
        padLeft(String(result.selected.length), 8) +
        shared,
    );
  }
  console.log('');
}

function printLevelComparison(
  base: Omit<Parameters<typeof buildVolumePlan>[0], 'level'>,
  catalogue: typeof EXERCISE_CATALOGUE,
  seed: number,
): void {
  const levels = [ExperienceLevel.BEGINNER, ExperienceLevel.INTERMEDIATE, ExperienceLevel.ADVANCED];
  const plans = levels.map((level) => buildVolumePlan({ ...base, level }));
  const results = plans.map((plan) => selectExercises({ volumePlan: plan, catalogue, seed }));

  console.log(
    `\n${DIM}${pad('NIVEL', 15)}${padLeft('EJEC.', 7)}${padLeft('RANGO', 10)}` +
      `${padLeft('ATRIB.', 8)}${padLeft('EJERC.', 8)}${RESET}`,
  );
  levels.forEach((level, index) => {
    const [min, max] = TOTAL_SETS_RANGE[base.goal][level];
    const result = results[index];
    const mark = result.totalVerdict === 'within' ? `${LIME}✓${RESET}` : `${AMBER}!${RESET}`;
    console.log(
      `${mark}${pad(level.toLowerCase(), 14)}` +
        padLeft(`${AQUA}${BOLD}${result.performedSets}${RESET}`, 7) +
        padLeft(`${DIM}${min}-${max}${RESET}`, 10) +
        padLeft(String(totalAttributedSets(plans[index])), 8) +
        padLeft(String(result.selected.length), 8),
    );
  });
  console.log('');
}

// --- Ejecución --------------------------------------------------------------

function main(): void {
  const level = parseLevel(arg('level'));
  const goal = parseGoal(arg('goal'));
  const split = parseSplit(arg('split'));
  const name = arg('name') ?? '';
  const priorityMuscles = parseEnumList(MuscleGroup, arg('priority'), 'Músculo');
  const deprioritizedMuscles = parseEnumList(MuscleGroup, arg('deprioritize'), 'Músculo');
  const priorityRegions = parseEnumList(
    VolumeRegion,
    arg('priority-regions'),
    'Priority region',
  );
  const deprioritizedRegions = parseEnumList(
    VolumeRegion,
    arg('deprioritize-regions'),
    'Deprioritized region',
  );
  const declaredVolume = parseDeclared(arg('declared'));
  const equipment = parseEnumList(Equipment, arg('equipment'), 'Material');
  const vetoed = arg('veto')?.split(',').map((id) => id.trim()) ?? [];
  const seed = parseNumber(arg('seed'), 1, 'Semilla');

  const onlyRegions = parseEnumList(VolumeRegion, arg('regions'), 'Región');
  const addRegions = parseEnumList(VolumeRegion, arg('add-regions'), 'Región');
  const trainedRegions =
    onlyRegions.length > 0
      ? onlyRegions
      : addRegions.length > 0
        ? [...DEFAULT_TRAINED_REGIONS, ...addRegions]
        : undefined;

  const resolvedEquipment = equipment.length > 0 ? equipment : [...DEFAULT_GENERATOR_EQUIPMENT];
  const catalogue = filterCatalogue(EXERCISE_CATALOGUE, {
    availableEquipment: resolvedEquipment,
    vetoedExerciseIds: vetoed,
  });
  if (catalogue.length === 0) fail('El filtro de material y vetos ha dejado el catálogo vacío.');

  const base = {
    goal,
    trainedRegions,
    declaredVolume,
    priorityMuscles,
    deprioritizedMuscles,
    priorityRegions,
    deprioritizedRegions,
  };

  if (hasFlag('compare')) {
    printLevelComparison(base, catalogue, seed);
    return;
  }

  const sessions = arg('sessions') ? parseNumber(arg('sessions'), 4, 'Sesiones') : undefined;
  const minutes = arg('minutes') ? parseNumber(arg('minutes'), 60, 'Minutos por sesión') : undefined;
  const capacity =
    sessions !== undefined || minutes !== undefined
      ? { sessionsPerMicrocycle: sessions ?? 4, minutesPerSession: minutes ?? 60 }
      : undefined;

  if (capacity !== undefined) {
    const planned = planMesocycle({ ...base, level, capacity, catalogue, seed, split });
    const labelWithCapacity = [
      level.toLowerCase(),
      goal.toLowerCase(),
      priorityMuscles.length + priorityRegions.length > 0
        ? `▲${priorityMuscles.length + priorityRegions.length}`
        : '',
      deprioritizedMuscles.length + deprioritizedRegions.length > 0
        ? `▼${deprioritizedMuscles.length + deprioritizedRegions.length}`
        : '',
    ]
      .filter(Boolean)
      .join(' · ');
    printVerdict(
      planned.selection,
      planned.plan,
      `${DIM}${labelWithCapacity}${RESET}`,
      undefined,
      planned.limitedBy === 'insufficient-time',
    );
    printCapacity(planned, capacity.sessionsPerMicrocycle, capacity.minutesPerSession);
    printInputs({
      name,
      level,
      goal,
      sessions: capacity.sessionsPerMicrocycle,
      minutes: capacity.minutesPerSession,
      split,
      equipment: resolvedEquipment,
      priorityRegions,
      deprioritizedRegions,
      seed,
      vetoed,
    });
    console.log(
      `${DIM}          capacidad aproximada ${approximateSetCapacity(capacity)} series · ` +
        `plan sin recortar ${totalAttributedSets(planned.uncappedPlan)} atribuidas${RESET}`,
    );
    if (arg('seeds')) {
      const seedCount = parseNumber(arg('seeds'), 20, 'Número de semillas');
      if (!Number.isInteger(seedCount) || seedCount < 1) {
        fail('Número de semillas debe ser un entero positivo.');
      }
      printCapacitySeedAudit(
        seedCount,
        (auditSeed) => planMesocycle({ ...base, level, capacity, catalogue, seed: auditSeed, split }),
      );
      console.log('');
      return;
    }
    if (hasFlag('brief')) {
      console.log('');
      return;
    }
    printSessions(planned);
    printPlan(planned.plan);
    printExercises(planned.selection, planned.plan);
    return;
  }

  const accumulation = buildVolumePlan({ ...base, level });
  const isDeload = hasFlag('deload');
  const plan = isDeload ? deloadVolumePlan(accumulation) : accumulation;
  const result = selectExercises({ volumePlan: plan, catalogue, seed });
  // En una descarga la referencia útil es el plan de acumulación del que sale, no
  // el rango de volumen total.
  const accumulationSets = isDeload
    ? selectExercises({ volumePlan: accumulation, catalogue, seed }).performedSets
    : undefined;

  const labelParts = [
    level.toLowerCase(),
    goal.toLowerCase(),
    isDeload ? 'DESCARGA' : '',
    priorityMuscles.length > 0 ? `▲${priorityMuscles.length}` : '',
    deprioritizedMuscles.length > 0 ? `▼${deprioritizedMuscles.length}` : '',
    catalogue.length < EXERCISE_CATALOGUE.length
      ? `${catalogue.length}/${EXERCISE_CATALOGUE.length} ejercicios`
      : '',
  ].filter(Boolean);
  printVerdict(result, plan, `${DIM}${labelParts.join(' · ')}${RESET}`, accumulationSets);

  if (hasFlag('brief')) {
    console.log('');
    return;
  }

  printPlan(plan);

  if (arg('seeds')) {
    printSeedComparison(plan, catalogue, parseNumber(arg('seeds'), 5, 'Número de semillas'));
  } else if (!hasFlag('no-selection')) {
    printExercises(result, plan);
  } else {
    console.log('');
  }
}

try {
  main();
} catch (error) {
  if (error instanceof UsageError || error instanceof EmphasisLimitError) {
    console.error(`\n${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
