/** Retain paired prescriptions and explicit soft-metric dispositions from two full archives. */
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';

interface Report {
  id: string;
  input: unknown;
  prescription: unknown;
  durationMs: number;
  quality?: {
    totalSets: number;
    sessions: { sets: number; minutes: number; exercises: unknown[] }[];
    overlapWarnings: unknown[];
    templateRecovery: { reviewSuggested: boolean }[];
  };
}
interface Archive {
  reports: Report[];
  comparisons: { id: string; prescriptionChanged?: boolean }[];
  sensitivity: { id: string; seedSetDelta: number }[];
  comparisonStatus: string;
}
const [baselinePath, currentPath, output] = process.argv.slice(2);
if (!baselinePath || !currentPath || !output) throw new Error('Usage: review-generator-changes.ts BASELINE.json.gz CURRENT.json.gz OUTPUT_PREFIX');
const read = (path: string): Archive => {
  const bytes = readFileSync(path);
  return JSON.parse((path.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString()) as Archive;
};
const before = read(baselinePath), after = read(currentPath);
const prior = new Map(before.reports.map((report) => [report.id, report]));
const changed = new Set(after.comparisons.filter((entry) => entry.prescriptionChanged).map((entry) => entry.id));
const templateCount = (report: Report) => report.quality?.templateRecovery.filter((pair) => pair.reviewSuggested).length ?? 0;
const sequenceCount = (report: Report) => report.quality?.overlapWarnings.length ?? 0;
const qualitySummary = (report: Report) => report.quality && ({ totalSets: report.quality.totalSets,
  sessions: report.quality.sessions.map(({ sets, minutes }) => ({ sets, minutes })),
  overlapWarnings: report.quality.overlapWarnings, templateRecovery: report.quality.templateRecovery });
const pairs = after.reports.filter((report) => changed.has(report.id)).map((report) => {
  const original = prior.get(report.id);
  if (!original) throw new Error(`Missing paired case: ${report.id}`);
  const templateDelta = templateCount(report) - templateCount(original);
  const sequenceDelta = sequenceCount(report) - sequenceCount(original);
  const setsDelta = (report.quality?.totalSets ?? 0) - (original.quality?.totalSets ?? 0);
  const disposition = templateDelta > 0 ? 'Open: new consecutive-day template overlap; not a clean improvement.'
    : sequenceDelta > 0 ? 'Open concentration review: more adjacent-workout flags, without more rest-template flags. No readiness guarantee.'
    : setsDelta < 0 ? 'Dose trade-off: fewer performed sets; inspect original-target coverage, not total alone.'
    : 'Automated guards pass; not an individual coaching sign-off.';
  return { id: report.id, input: report.input, setsDelta, templateDelta, sequenceDelta, disposition,
    before: original.prescription, after: report.prescription,
    qualityBefore: qualitySummary(original), qualityAfter: qualitySummary(report) };
});
const rows = pairs.map((pair) => `| ${pair.id} | ${pair.setsDelta} | ${pair.templateDelta} | ${pair.sequenceDelta} | ${pair.disposition} |`);
writeFileSync(`${output}.json.gz`, gzipSync(JSON.stringify({ baselinePath, currentPath, comparisonStatus: after.comparisonStatus, pairs })));
writeFileSync(`${output}.md`, ['# Changed-case paired review ledger', '',
  `Baseline: ${baselinePath}`, `Current: ${currentPath}`, '',
  `Changed prescriptions: ${pairs.length}. Full paired prescriptions and compact quality findings are retained in the companion JSON.gz.`,
  'This is an automated disposition ledger, not a claim that every routine received an individual scientific/coaching review.', '',
  '| Case | Set delta | Rest-template flag delta | Adjacent-workout flag delta | Disposition |',
  '|---|---:|---:|---:|---|', ...rows, '',
  'Remaining seed spans above ten sets:', ...after.sensitivity.filter((entry) => entry.seedSetDelta > 10)
    .map((entry) => `- ${entry.id}: ${entry.seedSetDelta} sets.`), ''].join('\n'));
console.log(JSON.stringify({ changed: pairs.length, newTemplateWarnings: pairs.filter((pair) => pair.templateDelta > 0).length,
  concentrationReview: pairs.filter((pair) => pair.sequenceDelta > 0).length,
  doseTradeoffs: pairs.filter((pair) => pair.setsDelta < 0).length }));
