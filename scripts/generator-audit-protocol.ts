/// <reference types="node" />
/** Portable audit records. Only data is replayed; archived source is never executed. */
import { createHash } from 'node:crypto';
import type { Exercise } from '../src/models';
import type { MesocyclePlanInput } from '../src/services/training/mesocyclePlanner';

export const AUDIT_SCHEMA_VERSION = 2;
export const AUDIT_MATRIX_VERSION = 'goal-crossed-1';

export function canonicalJson(value: unknown): string {
  const normalize = (v: unknown): unknown => {
    if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('Non-finite audit data');
    if (Array.isArray(v)) return v.map((item) => normalize(item ?? null));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v)
      .filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : 1)
      .map(([key, item]) => [key, normalize(item)]));
    return v;
  };
  const serialized = JSON.stringify(normalize(value));
  if (serialized === undefined) throw new Error('Missing audit data');
  return serialized;
}
export const fingerprint = (value: unknown): string => createHash('sha256').update(canonicalJson(value)).digest('hex');

export interface AuditRecord {
  id: string;
  input: Omit<MesocyclePlanInput, 'catalogue'> & { catalogueIds: string[] };
  catalogueFingerprint?: string;
  inputFingerprint?: string;
  prescription?: unknown;
  error?: string;
  quality?: { totalSets: number; setSpread: number; valid: boolean;
    issues: { code: string; severity: string }[]; assessment?: { version: string } };
}
export interface AuditArchive {
  schemaVersion: number;
  catalogueFingerprint: string;
  catalogueSnapshots?: Record<string, Exercise[]>;
  manifest?: { sourceFingerprint: string; files: Record<string, { sha256: string; content: string }>;
    runtime: { node: string; tsx: string }; qualityVersion: string; matrixVersion: string };
  reports: AuditRecord[];
}

export function snapshotInput(id: string, input: MesocyclePlanInput, snapshots: Record<string, Exercise[]>) {
  const { catalogue, ...settings } = input;
  const catalogueFingerprint = fingerprint(catalogue);
  snapshots[catalogueFingerprint] ??= [...catalogue];
  const serialized = { ...settings, catalogueIds: catalogue.map((e) => e.id) };
  return { id, input: serialized, catalogueFingerprint,
    inputFingerprint: fingerprint({ settings: serialized, catalogueFingerprint }) };
}

/** Verify integrity before reconstructing inputs; old ID-only artifacts cannot replay safely. */
export function replayInput(archive: AuditArchive, id: string): MesocyclePlanInput {
  if (archive.schemaVersion !== AUDIT_SCHEMA_VERSION || !archive.catalogueSnapshots || !archive.manifest) {
    throw new Error('Replay requires schema 2 with complete snapshots; legacy artifacts are comparison-only');
  }
  if (fingerprint(Object.fromEntries(Object.entries(archive.manifest.files).map(([path, file]) => [path, file.sha256])))
    !== archive.manifest.sourceFingerprint || Object.values(archive.manifest.files).some((file) =>
      fingerprint(file.content) !== file.sha256)) throw new Error('Source manifest integrity mismatch');
  const record = archive.reports.find((r) => r.id === id);
  if (!record || !record.catalogueFingerprint) throw new Error(`Missing replay case: ${id}`);
  const catalogue = archive.catalogueSnapshots[record.catalogueFingerprint];
  if (!catalogue || fingerprint(catalogue) !== record.catalogueFingerprint) throw new Error('Catalogue snapshot integrity mismatch');
  const { catalogueIds, ...settings } = record.input;
  if (canonicalJson(catalogueIds) !== canonicalJson(catalogue.map((e) => e.id))
    || fingerprint({ settings: record.input, catalogueFingerprint: record.catalogueFingerprint }) !== record.inputFingerprint) {
    throw new Error('Input snapshot integrity mismatch');
  }
  return { ...settings, catalogue };
}

const athleteInputs = ({ rankingPolicy: _policy, catalogueIds: _ids, ...settings }: AuditRecord['input']) => settings;

export function compareAudits(before: AuditArchive, after: AuditArchive) {
  const allIds = [...new Set([...before.reports, ...after.reports].map((r) => r.id))];
  return allIds.map((id) => {
    const old = before.reports.find((r) => r.id === id), next = after.reports.find((r) => r.id === id);
    if (!old || !next) return { id, comparable: false, comparisonType: old ? 'removed-case' as const : 'added-case' as const };
    const sameInputs = canonicalJson(athleteInputs(old.input)) === canonicalJson(athleteInputs(next.input));
    // Schema 1 has only a global catalogue hash: weaker, explicitly marked evidence.
    const exactSnapshots = !!old.catalogueFingerprint && !!next.catalogueFingerprint;
    const sameCatalogue = exactSnapshots ? old.catalogueFingerprint === next.catalogueFingerprint
      : before.catalogueFingerprint === after.catalogueFingerprint
        && canonicalJson(old.input.catalogueIds) === canonicalJson(next.input.catalogueIds);
    const comparisonType = !sameInputs ? 'different-inputs' as const : !sameCatalogue ? 'catalogue-experiment' as const : 'fixed-input' as const;
    const qualityComparable = !!old.quality?.assessment && !!next.quality?.assessment
      && old.quality.assessment.version === next.quality.assessment.version;
    const count = (record: AuditRecord, code?: string) => record.quality?.issues.filter((i) =>
      code ? i.code === code : i.severity === 'error').length ?? 0;
    const newCrash = !old.error && !!next.error;
    const volumeRegression = !!old.quality && !!next.quality
      && next.quality.totalSets < old.quality.totalSets - Math.max(3, old.quality.totalSets * 0.1);
    const hardRegression = qualityComparable && (!!old.quality?.valid && !next.quality?.valid);
    return { id, comparisonType, comparable: comparisonType === 'fixed-input', sameInputs, sameCatalogue,
      catalogueEvidence: exactSnapshots ? 'per-case-snapshot' : 'legacy-global-hash-and-ids', qualityComparable,
      newCrash, errorBefore: old.error ?? null, errorAfter: next.error ?? null,
      prescriptionChanged: fingerprint(old.prescription ?? null) !== fingerprint(next.prescription ?? null),
      setsDelta: old.quality && next.quality ? next.quality.totalSets - old.quality.totalSets : null,
      errorsBefore: count(old), errorsAfter: count(next), volumeRegression, hardRegression,
      underfilledDelta: qualityComparable ? count(next, 'underfilled-session') - count(old, 'underfilled-session') : null,
      setSpreadDelta: old.quality && next.quality ? next.quality.setSpread - old.quality.setSpread : null,
      // Changed catalogues require explicit review, never silent promotion by a fixed-input gate.
      disposition: comparisonType === 'catalogue-experiment' ? 'experiment-review-required'
        : comparisonType === 'different-inputs' ? 'not-paired'
          : newCrash || volumeRegression || hardRegression ? 'regression' : 'no-detected-regression' };
  });
}

export function parseSeedCount(raw: string | undefined): number {
  const value = raw === undefined ? 10 : Number(raw);
  if (!Number.isInteger(value) || value < 2 || value > 20) throw new Error('Seeds must be an integer from 2 to 20');
  return value;
}

/** Experiments and unmatched inputs require review, not automatic promotion. */
export function comparisonGate(comparisons: ReturnType<typeof compareAudits>) {
  if (comparisons.some((c) => c.comparisonType === 'removed-case'
    || ('disposition' in c && c.comparable && (c.disposition === 'regression' || (c.underfilledDelta ?? 0) > 0)))) {
    return 'regression' as const;
  }
  if (comparisons.some((c) => c.comparisonType === 'catalogue-experiment' || c.comparisonType === 'different-inputs')) {
    return 'review-required' as const;
  }
  return comparisons.some((c) => c.comparable) ? 'no-detected-regression' as const : 'no-paired-reference' as const;
}
