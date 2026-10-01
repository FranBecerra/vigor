#!/usr/bin/env npx tsx
/**
 * Validación y cobertura del catálogo de ejercicios.
 *
 * Pásalo después de editar `src/data/exercises.json` a mano: la validación
 * atrapa un músculo o un vector mal escrito antes de que llegue a la app, y el
 * resumen de cobertura señala los músculos con tan pocos ejercicios que el
 * generador no puede darles variedad.
 *
 * Uso:
 *   npm run catalogue
 *   npm run catalogue -- --validate     solo valida
 *   npm run catalogue -- --muscle=LATS  detalle de un músculo
 */
import { Equipment, MovementVector, MuscleGroup } from '../src/models/biomechanics';
import {
  CRITERIA_KEYS,
  EXERCISE_CATALOGUE,
  fatigueCost,
  isTopTierStimulus,
  stimulusQuality,
} from '../src/services/training/exerciseCatalogue';

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const LIME = '\x1b[38;5;154m';
const AMBER = '\x1b[38;5;214m';

/** Por debajo de esto el generador repite siempre los mismos ejercicios. */
const MIN_PER_MUSCLE = 3;

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function padLeft(text: string, width: number): string {
  return text.length >= width ? text : ' '.repeat(width - text.length) + text;
}

function arg(name: string): string | undefined {
  return process.argv.find((c: string) => c.startsWith(`--${name}=`))?.split('=')[1];
}

// La importación del catálogo ya valida: si llegamos aquí, el fichero está bien.
console.log(
  `\n${LIME}✓${RESET} catálogo válido · ${BOLD}${EXERCISE_CATALOGUE.length}${RESET} ejercicios`,
);

if (process.argv.includes('--validate')) process.exit(0);

const muscleFilter = arg('muscle')?.toUpperCase();
if (muscleFilter) {
  if (!Object.values(MuscleGroup).includes(muscleFilter as MuscleGroup)) {
    console.error(`\nMúsculo desconocido: "${muscleFilter}".`);
    console.error(`Válidos: ${Object.values(MuscleGroup).join(', ')}\n`);
    process.exit(1);
  }
  const matches = EXERCISE_CATALOGUE.filter((e) => e.primaryMuscle === muscleFilter);
  console.log(`\n${BOLD}${muscleFilter}${RESET}  ${DIM}${matches.length} ejercicios${RESET}\n`);
  [...matches]
    .sort((a, b) => (b.criteria ? stimulusQuality(b) : -1) - (a.criteria ? stimulusQuality(a) : -1))
    .forEach((e) => {
      if (!e.criteria) {
        console.log(`  UNRATED  ${pad(e.name, 44)}${e.movementVector}  ${e.equipment}  MANUAL_ONLY`);
        return;
      }
      const scores = CRITERIA_KEYS.map((k) => e.criteria?.[k] ?? 3).join('');
      console.log(
        `  ${LIME}${stimulusQuality(e).toFixed(1)}${RESET} ${DIM}f${fatigueCost(e).toFixed(1)}${RESET} ` +
          `${isTopTierStimulus(e) ? LIME + '★' + RESET : ' '} ${pad(e.name, 44)}` +
          `${DIM}${scores}  ${pad(e.movementVector, 30)}${e.equipment}${RESET}`,
      );
    });
  console.log('');
  process.exit(0);
}

// --- Cobertura por músculo ---------------------------------------------------

console.log(`\n${BOLD}COBERTURA POR MÚSCULO PRINCIPAL${RESET}\n`);
console.log(
  `${DIM}${pad('MÚSCULO', 20)}${padLeft('EJERC.', 8)}${padLeft('MULTI', 7)}` +
    `${padLeft('AISL.', 7)}${padLeft('ESTÍMULO MEDIO', 16)}${RESET}`,
);
console.log(`${DIM}${'─'.repeat(56)}${RESET}`);

const escasos: string[] = [];
Object.values(MuscleGroup).forEach((muscle) => {
  const matches = EXERCISE_CATALOGUE.filter((e) => e.primaryMuscle === muscle);
  const compounds = matches.filter((e) => e.profile !== 'ISOLATION').length;
  const scored = matches.filter((e) => e.criteria !== undefined);
  const mean =
    scored.length > 0
      ? scored.reduce((sum, e) => sum + stimulusQuality(e), 0) / scored.length
      : 0;

  const countText =
    matches.length < MIN_PER_MUSCLE
      ? `${AMBER}${matches.length}${RESET}`
      : `${LIME}${matches.length}${RESET}`;
  if (matches.length < MIN_PER_MUSCLE) escasos.push(muscle);

  console.log(
    pad(muscle, 20) +
      padLeft(countText, matches.length < MIN_PER_MUSCLE ? 17 : 17) +
      padLeft(String(compounds), 7) +
      padLeft(String(matches.length - compounds), 7) +
      padLeft(mean.toFixed(2), 16),
  );
});

if (escasos.length > 0) {
  console.log(
    `\n${AMBER}Con menos de ${MIN_PER_MUSCLE} ejercicios${RESET} ` +
      `${DIM}(el generador repetirá siempre los mismos)${RESET}`,
  );
  escasos.forEach((m) => console.log(`  ${AMBER}·${RESET} ${m}`));
}

// --- Vectores sin cubrir -----------------------------------------------------

const vectoresUsados = new Set(EXERCISE_CATALOGUE.map((e) => e.movementVector));
const vectoresVacios = Object.values(MovementVector).filter((v) => !vectoresUsados.has(v));
if (vectoresVacios.length > 0) {
  console.log(`\n${AMBER}Vectores sin ningún ejercicio${RESET}`);
  vectoresVacios.forEach((v) => console.log(`  ${AMBER}·${RESET} ${v}`));
}

// --- Reparto por material ----------------------------------------------------

console.log(`\n${BOLD}POR MATERIAL${RESET}\n`);
Object.values(Equipment).forEach((equipment) => {
  const count = EXERCISE_CATALOGUE.filter((e) => e.equipment === equipment).length;
  console.log(`  ${pad(equipment, 16)}${padLeft(String(count), 4)}`);
});
console.log('');
