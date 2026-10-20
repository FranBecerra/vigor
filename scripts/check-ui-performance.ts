import { readFileSync } from 'node:fs';
import { assessUiPerformance, type UiPerformanceReport } from '../src/services/performance/uiPerformance';

const [reportPath, baselinePath] = process.argv.slice(2);
if (!reportPath) throw new Error('Usage: npm run test:performance -- report.json [baseline.json]');
const read = (path: string) => {
  const value = JSON.parse(readFileSync(path, 'utf8'));
  if (!value || value.version !== 1 || !Array.isArray(value.samples) || !value.environment || value.error) throw new Error(`Invalid/incomplete report: ${path}`);
  return value as UiPerformanceReport;
};
const assessment = assessUiPerformance(read(reportPath), baselinePath ? read(baselinePath) : undefined);
console.table(assessment.metrics);
assessment.failures.forEach((failure) => console.error(failure));
process.exitCode = assessment.passed ? 0 : 1;
