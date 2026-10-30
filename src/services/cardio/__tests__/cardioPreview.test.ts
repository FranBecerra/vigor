import type { RoutineView } from '@/services/training/routineView';
import { buildCardioPreview, cardioPreviewIssue, strengthPlacements, suggestCardioCapacity, type CardioPreviewInput } from '../cardioPreview';

const base = (patch: Partial<CardioPreviewInput> = {}): CardioPreviewInput => ({
  modalities: ['CYCLING'], profile: { schemaVersion: 1, modalities: {} }, cycleDays: 8,
  availableDays: [0, 1, 2, 3, 4, 5, 6, 7], sessions: 2, cardioMinutes: 60, sessionMinutes: 30,
  maxActiveDays: 5, allowDoubles: false, strength: [], ...patch,
});
const lift = (id: string, dayIndex?: number, lowerBodyDemand: 'HIGH' | 'LOW' = 'HIGH') => ({ id, name: id, dayIndex, estimatedMinutes: 55, lowerBodyDemand });
const routine = (patch: any = {}): RoutineView => ({ id: 'r', currentMicrocycleIndex: 0, microcycles: [{ sessions: [
  { id: 'a', name: 'Upper', plannedSessionIndex: 0, exercises: [{ primaryMuscle: 'CHEST', primaryMuscles: ['CHEST'], secondaryMuscles: [], sets: [], restSeconds: 60 }] },
  { id: 'b', name: 'Lower', plannedSessionIndex: 1, exercises: [{ primaryMuscle: 'QUADS', secondaryMuscles: [], sets: [], restSeconds: 60 }] },
] }], ...patch } as any);

it('authors real easy sessions, accounts for full durations and returns every relative day', () => {
  const input = base({ modalities: ['RUNNING', 'CYCLING'], strength: [lift('lower', 0)] });
  const copy = JSON.stringify(input), result = buildCardioPreview(input);
  expect(result.scheduled.map(s => s.modality).sort()).toEqual(['CYCLING', 'RUNNING']);
  expect(result.usedMinutes).toBe(40); expect(result.days).toHaveLength(8);
  expect(result.days[0].strength[0].id).toBe('lower');
  expect(result.scheduled.find(s => s.modality === 'RUNNING')!.dayIndex).not.toBe(7);
  expect(result.prescriptions.every(s => s.basis === 'FAMILIARIZATION')).toBe(true);
  result.days[0].strength[0].name = 'Changed'; result.scheduled[0].candidateDays.pop();
  expect(JSON.stringify(input)).toBe(copy);
});
it('respects requested modality order, count, per-session duration and cardio budget', () => {
  const result = buildCardioPreview(base({ modalities: ['CYCLING', 'MACHINE'], sessions: 3,
    profile: { schemaVersion: 1, modalities: { CYCLING: { status: 'REGULAR', qualityExposure: 'CURRENTLY_TOLERATED', typicalSessionMinutes: 10 } } }, cardioMinutes: 35 }));
  expect(result.usedMinutes).toBe(30); expect(result.scheduled).toHaveLength(2);
  expect(result.omitted).toEqual([{ candidateId: 'easy-02-cycling', reason: 'TIME_CAP' }]);
  expect(result.prescriptions[0].segments.reduce((n, s) => n + s.durationSeconds, 0)).toBe(result.prescriptions[0].durationSeconds);
});
it('reports empty availability rather than inventing training or interpreting it as completion', () => {
  const result = buildCardioPreview(base({ availableDays: [] }));
  expect(result.scheduled).toEqual([]); expect(result.omitted).toHaveLength(2);
  expect(result.days.every(day => !day.cardio.length && !day.strength.length)).toBe(true);
});
it('reports wrapped lower-body and cardio-to-cardio proximity but does not warn for easy cycling', () => {
  const run = base({ modalities: ['RUNNING'], sessions: 1, availableDays: [7], strength: [lift('lower', 0)] });
  expect(buildCardioPreview(run).closeDemandingSessions).toBe(true);
  expect(buildCardioPreview({ ...run, availableDays: [0], allowDoubles: true }).closeDemandingSessions).toBe(true);
  expect(buildCardioPreview({ ...run, availableDays: [3] }).closeDemandingSessions).toBe(false);
  expect(buildCardioPreview({ ...run, modalities: ['CYCLING'] }).closeDemandingSessions).toBe(false);
  expect(buildCardioPreview(base({ modalities: ['RUNNING'], availableDays: [0, 7] })).closeDemandingSessions).toBe(true);
});
it.each([
  [null, 'MODALITIES'], [{ modalities: null }, 'MODALITIES'], [{ modalities: [] }, 'MODALITIES'], [{ modalities: ['SWIMMING'] }, 'MODALITIES'],
  [{ modalities: ['CYCLING', 'CYCLING'] }, 'MODALITIES'], [{ modalities: ['RUNNING', 'CYCLING', 'MACHINE', 'CYCLING'] }, 'MODALITIES'],
  [{ profile: null }, 'PROFILE'], [{ cycleDays: 6 }, 'LIMITS'], [{ cycleDays: 32 }, 'LIMITS'], [{ sessions: 0 }, 'LIMITS'],
  [{ sessions: 15 }, 'LIMITS'], [{ cardioMinutes: 0 }, 'LIMITS'], [{ sessionMinutes: Infinity }, 'LIMITS'], [{ maxActiveDays: 9 }, 'LIMITS'], [{ allowDoubles: undefined }, 'LIMITS'],
  [{ availableDays: null }, 'AVAILABILITY'], [{ availableDays: [8] }, 'AVAILABILITY'], [{ availableDays: [0, 0] }, 'AVAILABILITY'],
  [{ strength: null }, 'STRENGTH_DAY'], [{ strength: [null] }, 'STRENGTH_DAY'], [{ strength: [lift('a')] }, 'STRENGTH_DAY'],
  [{ strength: [lift(' ', 0)] }, 'STRENGTH_DAY'], [{ strength: [{ ...lift('a', 0), name: '' }] }, 'STRENGTH_DAY'],
  [{ strength: [{ ...lift('a', 0), estimatedMinutes: NaN }] }, 'STRENGTH_DAY'], [{ strength: [{ ...lift('a', 0), estimatedMinutes: -1 }] }, 'STRENGTH_DAY'],
  [{ strength: [{ ...lift('a', 0), estimatedMinutes: 601 }] }, 'STRENGTH_DAY'], [{ strength: [{ ...lift('a', 0), lowerBodyDemand: '' }] }, 'STRENGTH_DAY'],
  [{ strength: [lift('a', 0), lift('a', 1)] }, 'STRENGTH_DAY'], [{ strength: [lift('a', 0), lift('b', 0)] }, 'STRENGTH_COLLISION'],
  [{ maxActiveDays: 1, strength: [lift('a', 0), lift('b', 2)] }, 'ACTIVE_DAYS'],
  [{ placementPolicy: 'FUTURE' }, 'LIMITS'],
] as const)('rejects invalid preview input %# with an explainable issue', (patch, issue) => {
  const input = patch === null ? null : base(patch as any);
  expect(cardioPreviewIssue(input as any)).toBe(issue);
  expect(() => buildCardioPreview(input as any)).toThrow(issue);
});
it('supports a 31-day cycle, zero known strength minutes, single opportunities and no doubles', () => {
  const input = base({ cycleDays: 31, sessions: 1, availableDays: [30], strength: [{ ...lift('upper', 0, 'LOW'), estimatedMinutes: 0 }] });
  expect(buildCardioPreview(input).days).toHaveLength(31);
  expect(buildCardioPreview(input).scheduled[0].dayIndex).toBe(30);
  expect(buildCardioPreview({ ...input, availableDays: [0] }).omitted[0].reason).toBe('NO_AVAILABLE_DAY');
});
it('uses explicit rest metadata while preserving order and does not infer dates', () => {
  const input = routine({ mesocycleSnapshot: { restDays: [{ id: 'before', afterSessionIndex: null }, { id: 'after', afterSessionIndex: 0 }] } });
  const before = JSON.stringify(input), result = strengthPlacements(input);
  expect(result.cycleDays).toBe(4); expect(result.sessions.map(s => s.dayIndex)).toEqual([1, 3]);
  expect(result.sessions.map(s => s.lowerBodyDemand)).toEqual(['LOW', 'HIGH']);
  expect(JSON.stringify(input)).toBe(before);
  expect(strengthPlacements(routine()).sessions.every(s => s.dayIndex === undefined)).toBe(true);
  expect(strengthPlacements(routine({ mesocycleSnapshot: {} })).cycleDays).toBeUndefined();
});
it('uses an existing schedule template and returns unplaced sessions if its metadata is malformed', () => {
  const result = strengthPlacements(routine({ mesocycleSnapshot: { scheduleTemplate: { days: 3, slots: [{ kind: 'workout', sessionIndex: 0 }, { kind: 'rest' }, { kind: 'workout', sessionIndex: 1 }] } } }));
  expect(result.sessions.map(s => s.dayIndex)).toEqual([0, 2]);
  const invalid = strengthPlacements(routine({ mesocycleSnapshot: { restDays: [{ id: 'x', afterSessionIndex: 42 }] } }));
  expect(invalid.cycleDays).toBeUndefined(); expect(invalid.sessions[0].dayIndex).toBeUndefined();
  expect(strengthPlacements(routine({ microcycles: [] })).sessions).toEqual([]);
});
it('treats unknown or empty exercise exposure conservatively without changing source prescriptions', () => {
  const r = routine(); r.microcycles[0].sessions[0].exercises = [];
  expect(strengthPlacements(r).sessions[0].lowerBodyDemand).toBe('HIGH');
  r.microcycles[0].sessions[0].exercises = [{ primaryMuscle: 'CHEST', secondaryMuscles: ['GLUTES'], sets: [], restSeconds: 0 } as any];
  expect(strengthPlacements(r).sessions[0].lowerBodyDemand).toBe('HIGH');
  expect(strengthPlacements(r, true).sessions[0].lowerBodyDemand).toBe('LOW');
  r.microcycles[0].sessions[0].exercises[0].primaryMuscles = ['CHEST', 'GLUTES'] as any;
  expect(strengthPlacements(r, true).sessions[0].lowerBodyDemand).toBe('HIGH');
});

it('prefers lighter same-day strength in v2 while keeping v1 ordering and primary leg separation', () => {
  const input = base({ availableDays: [0, 2], sessions: 1, maxActiveDays: 2, allowDoubles: true,
    strength: [{ ...lift('upper', 0, 'LOW'), estimatedMinutes: 90 }, { ...lift('push', 2, 'LOW'), estimatedMinutes: 35 }] });
  expect(buildCardioPreview(input).scheduled[0].dayIndex).toBe(0);
  const v2 = { ...input, placementPolicy: 'BALANCED_V2' as const };
  expect(buildCardioPreview(v2).scheduled[0].dayIndex).toBe(2);
  expect(buildCardioPreview({ ...v2, modalities: ['RUNNING'], strength: [input.strength[0], { ...input.strength[1], lowerBodyDemand: 'HIGH' }] }).scheduled[0].dayIndex).toBe(0);
  expect(buildCardioPreview({ ...v2, allowDoubles: false }).scheduled).toHaveLength(0);
  expect(buildCardioPreview({ ...v2, cardioMinutes: 5 }).scheduled).toHaveLength(0);
});

it('offers a conservative editable starting point, scales non-seven-day frequency and never increases short tolerance', () => {
  expect(suggestCardioCapacity(base())).toEqual({ sessions: 2, sessionMinutes: 20, cardioMinutes: 40, maxActiveDays: 2 });
  const known = base({ cycleDays: 10, modalities: ['RUNNING'], strength: [lift('upper', 0)], profile: { schemaVersion: 1, modalities: {
    RUNNING: { status: 'REGULAR', qualityExposure: 'UNKNOWN', sessionsPerWeek: 3, typicalSessionMinutes: 55 },
  } } });
  expect(suggestCardioCapacity(known)).toEqual({ sessions: 4, sessionMinutes: 40, cardioMinutes: 160, maxActiveDays: 5 });
  const short = { ...known, profile: { schemaVersion: 1 as const, modalities: { RUNNING: { status: 'RETURNING' as const,
    qualityExposure: 'UNKNOWN' as const, typicalSessionMinutes: 12.5 } } } };
  expect(suggestCardioCapacity(short)).toMatchObject({ sessions: 3, sessionMinutes: 12, cardioMinutes: 36 });
  const mixed = base({ modalities: ['RUNNING', 'CYCLING', 'MACHINE'], cycleDays: 31 });
  expect(suggestCardioCapacity(mixed)).toEqual({ sessions: 9, sessionMinutes: 20, cardioMinutes: 180, maxActiveDays: 9 });
});
it.each([null, { modalities: null }, { modalities: [] }, { modalities: ['BAD'] }, { modalities: ['RUNNING', 'RUNNING'] },
  { profile: null }, { cycleDays: 6 }, { cycleDays: 32 }, { strength: null }, { strength: Array(9).fill({}) }])('rejects invalid suggestion context %p', patch => {
  expect(() => suggestCardioCapacity(patch === null ? null as any : base(patch as any))).toThrow('invalidCardioSuggestion');
});
