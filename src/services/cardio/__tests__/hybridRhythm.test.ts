import { buildCardioPreview, type CardioPreviewInput } from '../cardioPreview';
import { cardioGapCost } from '../cardioSpacing';
import { hybridRhythmQuality, hybridRhythmRankIsBetter, hybridRunningProximity, HybridRhythmCancelled, suggestHybridRhythm } from '../hybridRhythm';

const base = (patch: Partial<CardioPreviewInput> = {}): CardioPreviewInput => ({ placementPolicy: 'BALANCED_V2', modalities: ['CYCLING'],
  profile: { schemaVersion: 1, modalities: {} }, cycleDays: 8, availableDays: [0, 1, 2, 3, 4, 5, 6, 7],
  sessions: 2, cardioMinutes: 40, sessionMinutes: 20, maxActiveDays: 6, allowDoubles: false,
  strength: [0, 1, 2, 3].map(day => ({ id: `s${day}`, name: `s${day}`, dayIndex: day, estimatedMinutes: 45, lowerBodyDemand: 'LOW' })), ...patch });
const noWait = async () => undefined;
it('jointly preserves spread easy cardio and isolated training days without altering the strength roster', async () => {
  const input = base({ spacingPolicy: 'SPREAD_EASY_V1', strength: [0, 4].map((day, n) => ({ ...base().strength[n], dayIndex: day })), maxActiveDays: 4 });
  const result = await suggestHybridRhythm(input, { yieldControl: noWait });
  expect(result.preview.scheduled).toHaveLength(2); expect(result.after.longestRun).toBe(1);
  expect(cardioGapCost(result.preview.scheduled.map(s => s.dayIndex), 8)).toBe(32);
  expect(result.input.strength.map(({ dayIndex, ...s }) => s)).toEqual(input.strength.map(({ dayIndex, ...s }) => s));
  expect(result.preview.usedMinutes).toBe(40);
});
it('never trades coverage for tidier spacing and keeps an exact tie unchanged', () => {
  expect(hybridRhythmRankIsBetter([0, 0, 40, 5, 4, 90, 4], [1, 0, 0, 3, 1, 0, 0])).toBe(true);
  expect(hybridRhythmRankIsBetter([0, 0, 40, 2, 1, 0, 0], [0, 0, 0, 3, 2, 90, 9])).toBe(false);
  expect(hybridRhythmRankIsBetter([0, 0, 0, 3, 2, 90, 9], [0, 0, 0, 3, 2, 90, 9])).toBe(false);
});
it('reproduces six consecutive days and redistributes an eight-day cycle without changing either dose or strength order', async () => {
  const input = base(), before = JSON.stringify(input), original = buildCardioPreview(input);
  expect(hybridRhythmQuality(input, original).longestRun).toBe(6);
  const result = await suggestHybridRhythm(input, { yieldControl: noWait });
  expect(result.changed).toBe(true); expect(result.after.longestRun).toBe(3); expect(result.after.proximity).toBe(0);
  expect(result.preview.scheduled).toHaveLength(2); expect(result.preview.usedMinutes).toBe(original.usedMinutes);
  expect(result.input.strength.map(({ dayIndex, ...s }) => s)).toEqual(input.strength.map(({ dayIndex, ...s }) => s));
  expect(result.input.strength.map(s => s.dayIndex)).toEqual([...result.input.strength.map(s => s.dayIndex)].sort((a, b) => a! - b!));
  expect(JSON.stringify(input)).toBe(before); expect(result.input.profile).toBe(input.profile);
  expect((await suggestHybridRhythm(input, { yieldControl: noWait })).input).toEqual(result.input);
});
it('prioritizes full coverage and lower-body proximity over cosmetic rest spacing', async () => {
  const input = base({ modalities: ['RUNNING'], strength: base().strength.map((s, i) => ({ ...s, lowerBodyDemand: i === 1 ? 'HIGH' : 'LOW' })) });
  const before = buildCardioPreview(input), result = await suggestHybridRhythm(input, { yieldControl: noWait });
  expect(result.preview.omitted.length).toBeLessThanOrEqual(before.omitted.length);
  expect(result.after.proximity).toBeLessThanOrEqual(result.before.proximity);
  expect(result.input.availableDays).toEqual(input.availableDays);
  const grouped = base({ modalities: ['RUNNING'], allowDoubles: true, availableDays: [0, 1, 2, 3], maxActiveDays: 4 });
  expect((await suggestHybridRhythm(grouped, { yieldControl: noWait })).preview.scheduled).toHaveLength(2);
});
it('keeps an unchanged optimum and explicit constraints rather than inventing extra days or removing requests', async () => {
  const input = base({ availableDays: [0, 1, 2, 3], maxActiveDays: 4 });
  const result = await suggestHybridRhythm(input);
  expect(result.changed).toBe(false); expect(result.input).toBe(input); expect(result.preview.omitted).toHaveLength(2);
  const empty = base({ strength: [] }); expect((await suggestHybridRhythm(empty)).changed).toBe(false);
  const all = base({ cycleDays: 7, availableDays: [0, 1, 2, 3, 4, 5, 6], strength: [], sessions: 7, cardioMinutes: 140, maxActiveDays: 7 });
  expect(hybridRhythmQuality(all, buildCardioPreview(all)).longestRun).toBe(7);
});
it.each([7, 10, 14, 31])('bounds search, yields to input and retains valid placement for %i-day cycles', async days => {
  const input = base({ cycleDays: days, availableDays: Array.from({ length: days }, (_, i) => i) }), yieldControl = jest.fn(noWait);
  const result = await suggestHybridRhythm(input, { yieldControl });
  expect(result.examined).toBeLessThanOrEqual(days <= 10 ? 300 : 128); expect(yieldControl).toHaveBeenCalled();
  expect(result.preview.omitted).toHaveLength(0); expect(result.after.proximity).toBeLessThanOrEqual(result.before.proximity);
});
it('scores same/adjacent lower-body work, same-day workload and cycle-boundary activity honestly', async () => {
  const input = base({ modalities: ['RUNNING'], allowDoubles: true, availableDays: [0, 1, 2, 3],
    strength: base().strength.map(s => ({ ...s, lowerBodyDemand: 'HIGH' })) });
  const quality = hybridRhythmQuality(input, buildCardioPreview(input)); expect(quality.proximity).toBeGreaterThan(100);
  const result = await suggestHybridRhythm(input); expect(result.changed).toBe(false);
});
it.each([null, { ...base(), strength: [{ ...base().strength[0], dayIndex: undefined }] },
  { ...base(), availableDays: [1, 2, 3, 4] }, { ...base(), strength: [...base().strength].reverse() }])('rejects uncertain or reordered strength sources', async input => {
  await expect(suggestHybridRhythm(input as any)).rejects.toThrow('invalidHybridRhythm');
});
it('cancels before, during and immediately after a search without returning a stale proposal', async () => {
  await expect(suggestHybridRhythm(base(), { isCancelled: () => true })).rejects.toBeInstanceOf(HybridRhythmCancelled);
  let cancelled = false;
  await expect(suggestHybridRhythm(base(), { isCancelled: () => cancelled, yieldControl: async () => { cancelled = true; } })).rejects.toBeInstanceOf(HybridRhythmCancelled);
  let calls = 0;
  await expect(suggestHybridRhythm(base({ strength: [] }), { isCancelled: () => ++calls > 1 })).rejects.toBeInstanceOf(HybridRhythmCancelled);
});
it.each([[0, 2], [1, 3], [2, 4], [1, 2, 3]])('keeps deterministic results for symmetric placement alternatives %j', async (...days: number[]) => {
  const input = base({ strength: days.map((day, i) => ({ ...base().strength[i], dayIndex: day })) });
  const first = await suggestHybridRhythm(input, { yieldControl: noWait }), second = await suggestHybridRhythm(input, { yieldControl: noWait });
  expect(first.input).toEqual(second.input); expect(first.after.longestRun).toBeLessThanOrEqual(first.before.longestRun);
});
it('keeps a run closer to the lighter leg prescription when categorical conflicts tie', async () => {
  const input = base({ modalities: ['RUNNING'], availableDays: [0, 1, 2], maxActiveDays: 3, sessions: 1,
    strength: base().strength.slice(0, 2).map(s => ({ ...s, lowerBodyDemand: 'HIGH' })) });
  const runDay = async (a: number, b: number) => (await suggestHybridRhythm(input, {
    legSets: new Map([['s0', a], ['s1', b]]), yieldControl: noWait,
  })).preview.scheduled[0].dayIndex;
  expect(await runDay(2, 8)).toBe(0);
  expect(await runDay(8, 2)).toBe(2);
});

it('uses priority to protect the earlier session when a run and leg work cannot be separated', async () => {
  const input = base({ cycleDays: 7, modalities: ['RUNNING'], availableDays: [0, 1, 6], maxActiveDays: 3,
    sessions: 1, cardioMinutes: 20, strength: base().strength.slice(0, 2).map(s => ({ ...s, lowerBodyDemand: 'HIGH' })) });
  const legSets = new Map([['s0', 5], ['s1', 5]]);
  const strength = await suggestHybridRhythm(input, { legSets, priority: 'STRENGTH', yieldControl: noWait });
  const cardio = await suggestHybridRhythm(input, { legSets, priority: 'CARDIO', yieldControl: noWait });
  expect(strength.preview.scheduled[0].dayIndex).toBe(1);
  expect(cardio.preview.scheduled[0].dayIndex).toBe(6);
  expect(strength.after.proximity).toBe(cardio.after.proximity);
  for (const result of [strength, cardio]) {
    expect(result.preview.usedMinutes).toBe(20);
    expect(result.preview.omitted).toEqual([]);
    expect(result.input.strength.map(({ dayIndex, ...s }) => s)).toEqual(input.strength.map(({ dayIndex, ...s }) => s));
  }
  expect(hybridRunningProximity(strength.input, strength.preview, legSets, 'STRENGTH')).toEqual({ nearbySets: 5, priorityCost: 0 });
  expect(hybridRunningProximity(strength.input, strength.preview, legSets, 'CARDIO')).toEqual({ nearbySets: 5, priorityCost: 5 });
  expect(hybridRunningProximity(cardio.input, cardio.preview, legSets, 'STRENGTH')).toEqual({ nearbySets: 5, priorityCost: 5 });
  expect(hybridRunningProximity(cardio.input, cardio.preview, legSets)).toEqual({ nearbySets: 5, priorityCost: 0 });
});

it('counts same-day work for either priority and ignores cycling and distant or missing placements', () => {
  const input = base({ modalities: ['RUNNING'], sessions: 1, availableDays: [0], allowDoubles: true, maxActiveDays: 1,
    strength: [{ ...base().strength[0], lowerBodyDemand: 'HIGH' }] });
  const preview = buildCardioPreview(input);
  expect(preview.scheduled).toHaveLength(1);
  expect(hybridRunningProximity(input, preview, undefined, 'CARDIO')).toEqual({ nearbySets: 2, priorityCost: 2 });
  expect(hybridRunningProximity(input, preview, new Map(), 'STRENGTH')).toEqual({ nearbySets: 0, priorityCost: 0 });
  const incomplete = { ...input, strength: [{ ...input.strength[0], dayIndex: undefined }, { ...input.strength[0], dayIndex: 4 }] };
  expect(hybridRunningProximity(incomplete, preview)).toEqual({ nearbySets: 0, priorityCost: 0 });
  const cycling = { ...input, modalities: ['CYCLING'] as CardioPreviewInput['modalities'] };
  expect(hybridRunningProximity(cycling, buildCardioPreview(cycling)))
    .toEqual({ nearbySets: 0, priorityCost: 0 });
});
