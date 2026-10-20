/** Read an archived run; classify remaining failures without mutating prescriptions. */
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { shortSessionDisposition, summarizeSessionDispositions } from '../src/services/training/generatorDisposition';

interface ReviewArchive {
  reports: { id: string; expectedInfeasible: boolean; input: { goal: string; level: string; split?: string;
    seed?: number; capacity?: { sessionsPerMicrocycle: number; minutesPerSession: number };
    priorityRegions?: string[]; deprioritizedRegions?: string[] };
    quality?: { sessions: { sets: number }[] }; alternative?: unknown }[];
}

const input = process.argv[2]; const output = process.argv[3];
if (!input || !output) throw new Error('Usage: node --import tsx scripts/review-generator-defects.ts INPUT.json.gz OUTPUT.md');
const data = readFileSync(input);
const archive = JSON.parse((input.endsWith('.gz') ? gunzipSync(data) : data).toString()) as ReviewArchive;
const summary = summarizeSessionDispositions(archive.reports);
const findings = archive.reports.filter((report) => !report.expectedInfeasible && report.quality)
  .map((report) => ({ report, disposition: shortSessionDisposition(report.quality!.sessions.map((s) => s.sets)) }))
  .filter(({ report, disposition }) => report.input.goal === 'HYPERTROPHY' && disposition.shortSessionIndexes.length > 0);
const counts = new Map<string, number>();
for (const { report, disposition } of findings) {
  const key = `${report.input.level}/${disposition.category}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}
const rows = findings.map(({ report, disposition }) => `| ${report.id} | ${report.input.level} | ${report.quality!.sessions.map((s) => s.sets).join('/')} | ${disposition.category} | ${report.alternative ? 'Evaluated fewer-day alternative available' : 'No accepted alternative'} |`);
const bottlenecks = findings.filter(({ disposition }) => disposition.category === 'allocation-bottleneck-needs-local-repair');
const bottleneckRows = bottlenecks.map(({ report }) => {
  const settings = report.input;
  return `| ${report.id} | ${settings.level} | ${settings.split ?? 'Unrecorded'} | ${settings.capacity ? `${settings.capacity.sessionsPerMicrocycle} × ${settings.capacity.minutesPerSession}` : 'Unrecorded'} | ${settings.seed ?? 'Unrecorded'} | ${settings.priorityRegions?.join(', ') || 'None'} | ${settings.deprioritizedRegions?.join(', ') || 'None'} | ${report.quality!.sessions.map((session) => session.sets).join('/')} |`;
});
writeFileSync(output, ['# Remaining generator defects', '', `Archive: ${input}`, '',
  `Sample: ${summary.totalCases} total cases; ${summary.hypertrophyCases} hypertrophy cases; ${summary.evaluableHypertrophyCases} evaluable hypertrophy cases; ${summary.expectedInfeasibleHypertrophyCases} expected infeasible controls; ${summary.missingQualityHypertrophyCases} missing quality records.`,
  `${summary.shortCases} affected cases contain ${summary.shortSessions} short sessions: ${summary.insufficientDoseCases} insufficient-total-dose cases and ${summary.allocationBottleneckCases} sufficient-total-dose allocation candidates.`, '',
  'Counts are generated cases, including seeds and time probes, not distinct athletes. The 12-set threshold is a product heuristic.',
  'Insufficient total dose cannot be repaired by redistribution alone. Offer an evaluated lower-frequency plan; do not add filler.',
  'Allocation bottlenecks have enough total sets but require constrained local search, not a promise that every partition is feasible.', '',
  ...[...counts].map(([key, count]) => `- ${key}: ${count} cases.`), '',
  '## Sufficient-total-dose cases and exact inputs', '',
  'Enough aggregate sets is a necessary condition, not proof that a valid partition exists under time, anchoring, variety and recovery constraints.', '',
  '| Case | Level | Split | Sessions × minutes | Seed | Priority | Deprioritized | Sets |',
  '|---|---|---|---|---|---|---|---|', ...bottleneckRows, '',
  '## All short-session cases', '',
  '| Case | Level | Sets per session | Disposition | Alternative |', '|---|---|---|---|---|', ...rows, '',
  'Numeric scores, set floors and overlap warnings are programming heuristics. They do not identify personal recovery limits.', ''].join('\n'));
console.log(JSON.stringify({ output, ...summary, counts: Object.fromEntries(counts) }));
