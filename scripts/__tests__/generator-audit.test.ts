import { Equipment, ExperienceLevel, SplitStructure } from '../../src/models';
import { EXERCISE_CATALOGUE } from '../../src/services/training/exerciseCatalogue';
import { TrainingGoal } from '../../src/services/training/volumePlan';
import { AUDIT_SCHEMA_VERSION, canonicalJson, compareAudits, comparisonGate, fingerprint, parseSeedCount, replayInput,
  snapshotInput, type AuditArchive, type AuditRecord } from '../generator-audit-protocol';
import { crossedAuditCases, expandAuditCases } from '../generator-audit-matrix';

const input = { goal: TrainingGoal.HYPERTROPHY, level: ExperienceLevel.INTERMEDIATE, seed: 42,
  capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 75 }, split: SplitStructure.AUTO, catalogue: EXERCISE_CATALOGUE.slice(0, 2) };
function archive(): AuditArchive {
  const snapshots = {};
  const record = snapshotInput('a', input, snapshots);
  const files = { 'example.ts': { content: 'source', sha256: fingerprint('source') } };
  return { schemaVersion: AUDIT_SCHEMA_VERSION, catalogueFingerprint: 'global', catalogueSnapshots: snapshots,
    manifest: { files, sourceFingerprint: fingerprint({ 'example.ts': files['example.ts'].sha256 }),
      runtime: { node: 'test', tsx: 'test' }, qualityVersion: '2', matrixVersion: '1' },
    reports: [{ ...record, prescription: ['a'], quality: { totalSets: 60, setSpread: 2, valid: true,
      issues: [], assessment: { version: '2' } } }] };
}
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

it('canonicalizes object keys while preserving meaningful array order and rejecting nonfinite values', () => {
  expect(fingerprint({ a: 1, b: 2 })).toBe(fingerprint({ b: 2, a: 1, ignored: undefined }));
  expect(fingerprint([1, 2])).not.toBe(fingerprint([2, 1]));
  expect(canonicalJson([undefined, null])).toBe('[null,null]');
  expect(() => fingerprint({ a: Infinity })).toThrow('Non-finite');
  expect(() => fingerprint(undefined)).toThrow('Missing');
});

it('replays all settings and catalogue parameters from snapshots, without using the current catalogue', () => {
  expect(replayInput(archive(), 'a')).toEqual(input);
  const a = archive(); const snapshots = a.catalogueSnapshots!;
  snapshotInput('b', input, snapshots);
  expect(Object.keys(snapshots)).toHaveLength(1);
});

it.each(['source', 'manifest', 'catalogue', 'input', 'ids', 'missing-case', 'missing-catalogue', 'legacy'])(
  'rejects incomplete or tampered replay data: %s', (mode) => {
    const a = clone(archive());
    if (mode === 'source') a.manifest!.files['example.ts'].content = 'modified';
    if (mode === 'manifest') a.manifest!.sourceFingerprint = 'wrong';
    if (mode === 'catalogue') Object.values(a.catalogueSnapshots!)[0][0].name = 'modified';
    if (mode === 'input') a.reports[0].input.seed += 1;
    if (mode === 'ids') a.reports[0].input.catalogueIds.reverse();
    if (mode === 'missing-case') a.reports = [];
    if (mode === 'missing-catalogue') a.catalogueSnapshots = {};
    if (mode === 'legacy') a.schemaVersion = 1;
    expect(() => replayInput(a, 'a')).toThrow();
  });

it('separates catalogue experiments even when exercises are added or removed', () => {
  const before = archive(), after = clone(before);
  after.reports[0].input.catalogueIds.push('new');
  after.reports[0].catalogueFingerprint = 'changed';
  expect(compareAudits(before, after)[0]).toMatchObject({ sameInputs: true, sameCatalogue: false,
    comparisonType: 'catalogue-experiment', comparable: false, disposition: 'experiment-review-required' });
});

it('detects parameter changes even with identical catalogue IDs and global hashes', () => {
  const before = archive(), after = clone(before);
  after.reports[0].catalogueFingerprint = 'parameter-change';
  expect(compareAudits(before, after)[0].comparisonType).toBe('catalogue-experiment');
});

it('compares ranking policies at fixed inputs, detects regressions and distinguishes measurement changes', () => {
  const before = archive(), after = clone(before);
  after.reports[0].input.rankingPolicy = 'ordinal';
  after.reports[0].quality!.totalSets = 40;
  after.reports[0].quality!.valid = false;
  after.reports[0].quality!.issues = [{ code: 'time-overflow', severity: 'error' }, { code: 'underfilled-session', severity: 'warning' }];
  after.reports[0].prescription = ['changed'];
  expect(compareAudits(before, after)[0]).toMatchObject({ comparisonType: 'fixed-input', comparable: true,
    hardRegression: true, volumeRegression: true, prescriptionChanged: true, underfilledDelta: 1, disposition: 'regression' });
  after.reports[0].quality!.assessment!.version = 'new';
  expect(compareAudits(before, after)[0]).toMatchObject({ qualityComparable: false, hardRegression: false, underfilledDelta: null });
});

it('does not hide new crashes, missing coverage or different athlete inputs', () => {
  const before = archive(), after = clone(before);
  after.reports[0].input.capacity.minutesPerSession++;
  expect(compareAudits(before, after)[0].comparisonType).toBe('different-inputs');
  after.reports[0].input.capacity.minutesPerSession--;
  after.reports[0].error = 'crash'; delete after.reports[0].quality; delete after.reports[0].prescription;
  expect(compareAudits(before, after)[0]).toMatchObject({ newCrash: true, disposition: 'regression', setsDelta: null });
  after.reports = [{ ...after.reports[0], id: 'b' }];
  expect(compareAudits(before, after).map((c) => c.comparisonType)).toEqual(['removed-case', 'added-case']);
});

it('labels weaker legacy comparisons and does not count contract changes as regressions', () => {
  const before = archive(), after = clone(before);
  delete before.reports[0].catalogueFingerprint;
  delete before.reports[0].quality!.assessment;
  expect(compareAudits(before, after)[0]).toMatchObject({ comparisonType: 'fixed-input',
    catalogueEvidence: 'legacy-global-hash-and-ids', qualityComparable: false });
  before.catalogueFingerprint = 'old';
  expect(compareAudits(before, after)[0].comparisonType).toBe('catalogue-experiment');
});

it('retains before/after errors and supports records without prescriptions', () => {
  const before = archive(), after = clone(before);
  before.reports[0].error = 'old'; after.reports[0].error = 'next';
  before.reports[0].quality = undefined; after.reports[0].quality = undefined;
  before.reports[0].prescription = undefined; after.reports[0].prescription = undefined;
  expect(compareAudits(before, after)[0]).toMatchObject({ errorBefore: 'old', errorAfter: 'next', newCrash: false, prescriptionChanged: false });
});

it('crosses every goal, level, split, emphasis and equipment profile with unique stable IDs', () => {
  const matrix = crossedAuditCases(EXERCISE_CATALOGUE);
  expect(matrix).toHaveLength(270);
  expect(new Set(matrix.map((c) => c.id)).size).toBe(matrix.length);
  for (const goal of Object.values(TrainingGoal)) for (const level of Object.values(ExperienceLevel)) {
    const group = matrix.filter((c) => c.input.goal === goal && c.input.level === level);
    expect(group).toHaveLength(45);
    expect(new Set(group.map((c) => c.input.split)).size).toBe(5);
    expect(group.find((c) => c.id.endsWith('no-barbell'))!.input.catalogue.every((e) => e.equipment !== Equipment.BARBELL)).toBe(true);
  }
  const expanded = expandAuditCases(matrix, 10);
  expect(expanded).toHaveLength(2970);
  expect(expanded.find((c) => c.id.endsWith('-seed-9'))!.input.seed).toBe(210);
  expect(expanded.find((c) => c.id.endsWith('-time'))!.input.capacity.minutesPerSession).toBe(80);
});

it.each(['0', '1', '21', 'NaN', '2.5', ''])( 'rejects invalid seed counts %s', (raw) => expect(() => parseSeedCount(raw)).toThrow());
it('uses ten seeds by default and accepts bounds', () => {
  expect(parseSeedCount(undefined)).toBe(10); expect(parseSeedCount('2')).toBe(2); expect(parseSeedCount('20')).toBe(20);
});

it('requires experiment review, fails removed coverage and accepts only non-regressing fixed pairs', () => {
  const before = archive(), after = clone(before);
  expect(comparisonGate([])).toBe('no-paired-reference');
  expect(comparisonGate(compareAudits(before, after))).toBe('no-detected-regression');
  after.reports[0].catalogueFingerprint = 'changed';
  expect(comparisonGate(compareAudits(before, after))).toBe('review-required');
  after.reports[0].catalogueFingerprint = before.reports[0].catalogueFingerprint;
  after.reports[0].input.seed++;
  expect(comparisonGate(compareAudits(before, after))).toBe('review-required');
  after.reports[0].input.seed--;
  after.reports[0].quality!.issues.push({ code: 'underfilled-session', severity: 'warning' });
  expect(comparisonGate(compareAudits(before, after))).toBe('regression');
  after.reports = [];
  expect(comparisonGate(compareAudits(before, after))).toBe('regression');
});
