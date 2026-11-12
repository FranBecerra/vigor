import { SplitStructure, type PlannedSessionFocus } from '@/models';
import { generatedStructureName } from '../generatedStructureName';
const labels = { focus: (s: PlannedSessionFocus) => s, split: (s: SplitStructure) => s, mixed: 'Mixed' };
it.each([
  [[], 'Mixed'], [['FULL_BODY', 'FULL_BODY'], 'FULL_BODY'], [['UPPER', 'LOWER', 'UPPER', 'LEGS'], 'UPPER_LOWER'],
  [['PUSH', 'PULL', 'LEGS'], 'PUSH_PULL_LEGS'], [['PUSH', 'PULL', 'LOWER'], 'PUSH_PULL_LEGS'],
  [['FULL_BODY', 'FULL_BODY', 'FULL_BODY', 'UPPER'], 'FULL_BODY ×3 + UPPER'],
  [['UPPER', 'UPPER'], 'UPPER'], [['LOWER'], 'LOWER'], [['PUSH', 'PULL'], 'PUSH + PULL'],
  [['UPPER', 'FULL_BODY', 'UPPER', 'FULL_BODY'], 'UPPER ×2 + FULL_BODY ×2'],
])('names the actual presented structure %j', (focuses, expected) => {
  expect(generatedStructureName(focuses as PlannedSessionFocus[], labels)).toBe(expected);
});
