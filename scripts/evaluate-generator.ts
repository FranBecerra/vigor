/// <reference types="node" />
/** Versioned, paired audit. Writes every input, session and diagnostic to an artifact. */
import { writeFileSync, readFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { cases } from './evaluate-exercise-ranking';
import { Equipment, ExperienceLevel, SplitStructure } from '../src/models';
import { EXERCISE_CATALOGUE, filterCatalogue } from '../src/services/training/exerciseCatalogue';
import { planMesocycle, type MesocyclePlanInput } from '../src/services/training/mesocyclePlanner';
import { auditCatalogue, evaluateGeneratorQuality } from '../src/services/training/generatorQuality';
import { TrainingGoal, VolumeRegion } from '../src/services/training/volumePlan';
import { catalogueWithReviewedTags, reviewedExerciseMetadata } from '../src/services/training/exerciseMetadataReview';
import { toPlannedSessions } from '../src/services/training/routineMapper';
import { findAlternativeSchedule } from '../src/services/training/alternativeSchedule';
import { GENERATOR_QUALITY_VERSION } from '../src/services/training/generatorQualityContract';
import { AUDIT_SCHEMA_VERSION, AUDIT_MATRIX_VERSION, fingerprint, snapshotInput, replayInput,
  compareAudits, comparisonGate, parseSeedCount, type AuditArchive } from './generator-audit-protocol';
import { crossedAuditCases, expandAuditCases } from './generator-audit-matrix';

const option = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const valueOptions = ['output', 'baseline', 'replay', 'case', 'matrix', 'policy', 'metadata', 'seeds'];
const flags = ['--extended', '--exclude-unscored', '--allow-version-drift'];
for (const arg of process.argv.slice(2)) if (!flags.includes(arg) && !valueOptions.some((name) => arg.startsWith(`--${name}=`) && arg.length > name.length + 3)) {
  throw new Error(`Unknown or incomplete audit option: ${arg}`);
}
const output = option('output') ?? '/private/tmp/vigor-generator-audit.json';
const baselinePath = option('baseline');
const replayPath = option('replay');
const matrix = option('matrix') ?? 'full';
if (!['legacy', 'full'].includes(matrix)) throw new Error('Matrix must be legacy or full');
if (option('policy') && !['ordinal', 'volume-aware', 'accessory-aware', 'coupled-control', 'legacy-weighted'].includes(option('policy')!)) {
  throw new Error('Unknown ranking policy');
}
if (option('metadata') && option('metadata') !== 'reviewed') throw new Error('Unknown metadata experiment');
const policy: MesocyclePlanInput['rankingPolicy'] = option('policy') === 'ordinal' ? 'ordinal' : option('policy') === 'volume-aware' ? 'volume-aware'
  : option('policy') === 'accessory-aware' ? 'accessory-aware'
  : option('policy') === 'coupled-control' ? 'coupled-control'
  : option('policy') === 'legacy-weighted' ? 'legacy-weighted' : undefined;
const seedCount = parseSeedCount(option('seeds'));
const controlledCatalogue = process.argv.includes('--exclude-unscored')
  ? EXERCISE_CATALOGUE.filter((e) => e.criteria !== undefined) : EXERCISE_CATALOGUE;
const sourceCatalogue = option('metadata') === 'reviewed' ? catalogueWithReviewedTags(controlledCatalogue) : controlledCatalogue;
const catalogueFingerprint = createHash('sha256').update(JSON.stringify(sourceCatalogue)).digest('hex');
const engineFingerprint = createHash('sha256').update([
  'mesocyclePlanner', 'exerciseSelection', 'sessionDistribution', 'volumePlan', 'trainingCapacity', 'strengthProgram',
  'exerciseCatalogue', 'exercisePrescription', 'microcyclePrescription', 'sessionDuration', 'sessionSummary', 'exerciseFamilies', 'scheduleTemplate', 'alternativeSchedule', 'tricepsSourceReview', 'sessionCoherence',
].map((name) => readFileSync(`src/services/training/${name}.ts`, 'utf8')).join('\n')).digest('hex');
const sourcePaths = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = `${directory}/${entry.name}`;
  return entry.isDirectory() ? entry.name === '__tests__' ? [] : sourcePaths(path)
    : /\.(ts|json)$/.test(entry.name) ? [path] : [];
});
const sourceFiles = [...sourcePaths('src/models'), ...sourcePaths('src/data'), ...sourcePaths('src/services/training'),
  ...sourcePaths('scripts'), 'package.json', 'package-lock.json', 'tsconfig.json', 'babel.config.js'];
const files = Object.fromEntries(sourceFiles.sort().map((path) => {
  const content = readFileSync(path, 'utf8'); return [path, { content, sha256: fingerprint(content) }];
}));
const manifest = { sourceFingerprint: fingerprint(Object.fromEntries(Object.entries(files).map(([path, file]) => [path, file.sha256]))),
  files, runtime: { node: process.version, tsx: JSON.parse(readFileSync('node_modules/tsx/package.json', 'utf8')).version as string },
  qualityVersion: GENERATOR_QUALITY_VERSION, matrixVersion: matrix === 'full' ? AUDIT_MATRIX_VERSION : 'legacy-605-1' };
const readArchive = (path: string): AuditArchive => {
  const data = JSON.parse((path.endsWith('.gz') ? gunzipSync(readFileSync(path)) : readFileSync(path)).toString('utf8')) as AuditArchive;
  if (![1, 2].includes(data.schemaVersion) || !Array.isArray(data.reports) || !data.catalogueFingerprint
    || new Set(data.reports.map((r) => r.id)).size !== data.reports.length) throw new Error('Invalid baseline archive');
  return data;
};
const inputs: { id: string; input: MesocyclePlanInput }[] = cases.map((scenario) => ({
  id: scenario.id,
  input: { level: scenario.level, goal: 'goal' in scenario ? scenario.goal : TrainingGoal.HYPERTROPHY,
    capacity: { sessionsPerMicrocycle: scenario.sessions, minutesPerSession: scenario.minutes },
    split: scenario.split, seed: scenario.seed, rankingPolicy: policy,
    catalogue: 'equipment' in scenario ? filterCatalogue(sourceCatalogue, { availableEquipment: scenario.equipment }) : sourceCatalogue,
    priorityRegions: 'priority' in scenario ? scenario.priority : [],
    deprioritizedRegions: 'deprioritized' in scenario ? scenario.deprioritized : [] },
}));
for (const level of Object.values(ExperienceLevel)) {
  const base: MesocyclePlanInput = { level, goal: TrainingGoal.HYPERTROPHY,
    capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 65 }, split: SplitStructure.AUTO,
    catalogue: sourceCatalogue, seed: 123, rankingPolicy: policy };
  inputs.push(
    { id: `${level}-short`, input: { ...base, capacity: { sessionsPerMicrocycle: 6, minutesPerSession: 30 } } },
    { id: `${level}-limited`, input: { ...base, catalogue: filterCatalogue(sourceCatalogue,
      { availableEquipment: [Equipment.DUMBBELL, Equipment.BODYWEIGHT] }) } },
    { id: `${level}-emphasis`, input: { ...base, priorityRegions: [VolumeRegion.BACK, VolumeRegion.TRICEPS],
      deprioritizedRegions: [VolumeRegion.QUADS, VolumeRegion.CHEST] } },
    { id: `${level}-empty-catalogue`, input: { ...base, catalogue: [] } },
  );
  if (matrix === 'full' || process.argv.includes('--extended')) inputs.push(
    { id: `${level}-strength`, input: { ...base, goal: TrainingGoal.STRENGTH } },
    { id: `${level}-declared`, input: { ...base, declaredVolume: { [VolumeRegion.BACK]: 8, [VolumeRegion.QUADS]: 4 } } },
    { id: `${level}-upper-only`, input: { ...base, trainedRegions: [VolumeRegion.CHEST, VolumeRegion.BACK, VolumeRegion.BICEPS, VolumeRegion.TRICEPS] } },
    { id: `${level}-veto`, input: { ...base, catalogue: sourceCatalogue.filter((e) =>
      !['peso-muerto-rumano', 'sentadilla-libre', 'press-banca', 'prensa-45'].includes(e.id)) } },
  );
}
if (matrix === 'full') inputs.push(...crossedAuditCases(sourceCatalogue).map((c) => ({ ...c, input: { ...c.input, rankingPolicy: policy } })));
let expanded = expandAuditCases(inputs, seedCount);
let replayArchive: AuditArchive | null = null;
if (replayPath) {
  replayArchive = readArchive(replayPath);
  if (!option('case')) throw new Error('Replay requires --case=ID');
  const input = replayInput(replayArchive, option('case')!);
  const versionMatches = replayArchive.manifest!.sourceFingerprint === manifest.sourceFingerprint
    && fingerprint(replayArchive.manifest!.runtime) === fingerprint(manifest.runtime);
  if (!versionMatches && !process.argv.includes('--allow-version-drift')) {
    throw new Error('Replay source/runtime mismatch. Restore archived versions or use --allow-version-drift for an explicit experiment.');
  }
  expanded = [{ id: option('case')!, input }];
}
if (new Set(expanded.map((c) => c.id)).size !== expanded.length) throw new Error('Duplicate audit IDs');
const catalogueSnapshots: Record<string, import('../src/models').Exercise[]> = {};
const reports = expanded.map(({ id, input }) => {
  const start = performance.now();
  const snapshot = snapshotInput(id, input, catalogueSnapshots);
  try {
    const plan = planMesocycle(input);
    const alternative = findAlternativeSchedule(input, plan);
    const quality = evaluateGeneratorQuality(input, plan);
    return { ...snapshot, expectedInfeasible: input.catalogue.length === 0,
      expectationMatches: input.catalogue.length > 0 ? quality.valid : !quality.valid && quality.totalSets === 0, error: undefined,
      durationMs: Math.round(performance.now() - start), limitedBy: plan.limitedBy,
      squeeze: plan.squeeze, prescription: toPlannedSessions(plan), volumeBudget: plan.plan.regions, strength: plan.strength,
      policyTrace: plan.policyTrace ?? [],
      alternative: alternative ? { capacity: alternative.input.capacity, prescription: toPlannedSessions(alternative.plan),
        quality: alternative.quality } : null,
      quality };
  } catch (error) {
    return { ...snapshot, expectedInfeasible: input.catalogue.length === 0, expectationMatches: false, quality: undefined, prescription: undefined,
      durationMs: Math.round(performance.now() - start), error: String(error) };
  }
});
const groups = Object.fromEntries(Object.values(ExperienceLevel).map((level) => {
  const group = reports.filter((r) => r.input.level === level);
  return [level, { cases: group.length, crashes: group.filter((r) => r.error).length,
    hardFailures: group.filter((r) => r.quality && !r.quality.valid).length,
    underfilled: group.reduce((sum, r) => sum + (r.quality?.issues.filter((i) => i.code === 'underfilled-session').length ?? 0), 0) }];
}));
const sensitivity = replayPath ? [] : inputs.map(({ id }) => {
  const base = reports.find((r) => r.id === id)!;
  const seeds = reports.filter((r) => r.id === id || r.id.startsWith(`${id}-seed`));
  const time = reports.find((r) => r.id === `${id}-time`)!;
  const complete = seeds.every((r) => !!r.quality) && !!time.quality;
  return { id, complete, seedSetDelta: complete ? Math.max(...seeds.map((r) => r.quality!.totalSets)) - Math.min(...seeds.map((r) => r.quality!.totalSets)) : null,
    extraTimeSetDelta: complete ? time.quality!.totalSets - base.quality!.totalSets : null };
});
const baseline = baselinePath ? readArchive(baselinePath) : null;
const comparisons = baseline ? compareAudits(baseline, { schemaVersion: AUDIT_SCHEMA_VERSION, catalogueFingerprint, reports }) : [];
const comparisonStatus = comparisonGate(comparisons);
const goalGroups = Object.values(TrainingGoal).flatMap((goal) => Object.values(ExperienceLevel).map((level) => {
  const group = reports.filter((r) => r.input.goal === goal && r.input.level === level);
  return { goal, level, cases: group.length, feasible: group.filter((r) => r.quality?.valid).length,
    reviewRequired: group.filter((r) => r.quality?.assessment.programming.status === 'review-required').length,
    infeasible: group.filter((r) => r.quality && !r.quality.valid && !r.expectedInfeasible).map((r) => r.id),
    expectedInfeasible: group.filter((r) => r.expectedInfeasible).length, crashes: group.filter((r) => r.error).map((r) => r.id) };
}));
const replayResult = replayArchive ? { source: replayPath, versionMatches: replayArchive.manifest!.sourceFingerprint === manifest.sourceFingerprint
  && fingerprint(replayArchive.manifest!.runtime) === fingerprint(manifest.runtime),
  prescriptionMatches: fingerprint(replayArchive.reports.find((r) => r.id === option('case'))?.prescription ?? null)
    === fingerprint(reports[0].prescription ?? null) } : null;
const artifact = { schemaVersion: AUDIT_SCHEMA_VERSION, generatedAt: new Date().toISOString(), manifest, catalogueSnapshots,
  matrix: { name: matrix, seedCount, baseCases: replayPath ? 1 : inputs.length, cases: expanded.length }, goalGroups, replayResult, comparisonStatus,
  policy: policy ?? 'production-coupled', engineFingerprint, catalogueFingerprint, catalogue: auditCatalogue(sourceCatalogue),
  baselineSource: baselinePath?.endsWith('.gz') ? baselinePath
    : baseline ? output.replace(/\.json(?:\.gz)?$/, '') + '.baseline.json.gz' : null,
  catalogueReview: sourceCatalogue.map(reviewedExerciseMetadata), groups, sensitivity, comparisons, reports };
mkdirSync(dirname(output), { recursive: true });
const serialized = JSON.stringify(artifact, null, 2);
writeFileSync(output, output.endsWith('.gz') ? gzipSync(serialized) : serialized);
if (baseline && !baselinePath?.endsWith('.gz')) writeFileSync(output.replace(/\.json(?:\.gz)?$/, '') + '.baseline.json.gz', gzipSync(JSON.stringify(baseline)));
const review = reports.map((r) => {
  if (!r.quality) return `| ${r.id} | ${r.input.goal}/${r.input.level} | ERROR | — | — | ${r.error} |`;
  const q = r.quality;
  return `| ${r.id} | ${r.input.goal}/${r.input.level} | ${q.sessions.map((s) => s.sets).join('/')} | ${q.assessment.feasibility.status} | ${q.assessment.programming.status} / ${q.assessment.confidence.status} | ${q.issues.map((i) => `${i.code}${i.subject ? ` (${i.subject})` : ''}`).join('; ') || 'No detected flags'} |`;
});
writeFileSync(output.replace(/\.json(?:\.gz)?$/, '') + '.md', [
  '# Generator case review', '', 'Each row must be assessed individually. No flags is not proof of physiological optimality.',
  '', 'Feasibility, programming and evidence confidence are independent. Thresholds are product heuristics.',
  'Full per-session exercises, magnitudes, explanations and original/adjusted volume compromises are in JSON.',
  '', '| Case | Goal / level | Sets per session | Feasibility | Programming / confidence | Findings |', '|---|---|---|---|---|---|', ...review,
  '', 'Full exercises, prescriptions, inputs, budgets and uncertainty are in the paired JSON artifact.',
].join('\n'));
console.log(JSON.stringify({ output, groups, crashes: reports.filter((r) => r.error).length,
  goalGroups, replayResult, comparisonStatus,
  measurementChanges: comparisons.filter((c) => 'qualityComparable' in c && !c.qualityComparable).length,
  comparisons: comparisons.reduce((counts, c) => ({ ...counts, [c.comparisonType]: (counts[c.comparisonType] ?? 0) + 1 }), {} as Record<string, number>),
  timeRegressions: sensitivity.filter((r) => r.extraTimeSetDelta !== null && r.extraTimeSetDelta < -3),
  largeSeedSwings: sensitivity.filter((r) => r.seedSetDelta !== null && Math.abs(r.seedSetDelta) > 10),
  volumeRegressions: comparisons.filter((r) => 'volumeRegression' in r && r.volumeRegression),
  newHardFailures: comparisons.filter((r) => 'hardRegression' in r && r.hardRegression) }, null, 2));
if (reports.some((r) => r.error || !r.expectationMatches)
  || sensitivity.some((r) => !r.complete || (r.extraTimeSetDelta !== null && r.extraTimeSetDelta < -3) || (r.seedSetDelta !== null && r.seedSetDelta > 10))
  || comparisonStatus === 'regression'
  || (replayResult?.versionMatches && !replayResult.prescriptionMatches)) process.exitCode = 1;
else if (comparisonStatus === 'review-required') process.exitCode = 2;
