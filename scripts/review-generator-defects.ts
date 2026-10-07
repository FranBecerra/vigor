/** Read an archived run; classify remaining failures without mutating prescriptions. */
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { shortSessionDisposition } from '../src/services/training/generatorDisposition';

interface ReviewArchive {
  reports: { id: string; expectedInfeasible: boolean; input: { goal: string; level: string };
    quality?: { sessions: { sets: number }[] }; alternative?: unknown }[];
}

const input = process.argv[2]; const output = process.argv[3];
if (!input || !output) throw new Error('Usage: node --import tsx scripts/review-generator-defects.ts INPUT.json.gz OUTPUT.md');
const data = readFileSync(input);
const archive = JSON.parse((input.endsWith('.gz') ? gunzipSync(data) : data).toString()) as ReviewArchive;
const findings = archive.reports.filter((report) => !report.expectedInfeasible && report.quality)
  .map((report) => ({ report, disposition: shortSessionDisposition(report.quality!.sessions.map((s) => s.sets)) }))
  .filter(({ report, disposition }) => report.input.goal === 'HYPERTROPHY' && disposition.shortSessionIndexes.length > 0);
const counts = new Map<string, number>();
for (const { report, disposition } of findings) {
  const key = `${report.input.level}/${disposition.category}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}
const rows = findings.map(({ report, disposition }) => `| ${report.id} | ${report.input.level} | ${report.quality!.sessions.map((s) => s.sets).join('/')} | ${disposition.category} | ${report.alternative ? 'Evaluated fewer-day alternative available' : 'No accepted alternative'} |`);
writeFileSync(output, ['# Remaining generator defects', '', `Archive: ${input}`, '',
  'Counts are generated cases, including seeds and time probes, not distinct athletes. The 12-set threshold is a product heuristic.',
  'Insufficient total dose cannot be repaired by redistribution alone. Offer an evaluated lower-frequency plan; do not add filler.',
  'Allocation bottlenecks have enough total sets but require constrained local search, not a promise that every partition is feasible.', '',
  ...[...counts].map(([key, count]) => `- ${key}: ${count} cases.`), '',
  '| Case | Level | Sets per session | Disposition | Alternative |', '|---|---|---|---|---|', ...rows, '',
  'Numeric scores, set floors and overlap warnings are programming heuristics. They do not identify personal recovery limits.', ''].join('\n'));
console.log(JSON.stringify({ output, affectedCases: findings.length, counts: Object.fromEntries(counts) }));
