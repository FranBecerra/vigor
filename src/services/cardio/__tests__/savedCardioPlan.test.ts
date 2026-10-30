import { archiveCardioProposal, cardioStrengthChanged, cardioStrengthSource, saveCardioProposal, validSavedCardioPlan } from '../savedCardioPlan';
import type { CardioPreviewInput } from '../cardioPreview';
import fixture from './fixtures/cardio-preview-v1.json';

const now = Date.UTC(2026, 9, 29, 12);
export const input: CardioPreviewInput = { modalities: ['CYCLING'], profile: { schemaVersion: 1, modalities: {
  CYCLING: { status: 'REGULAR', qualityExposure: 'UNKNOWN', typicalSessionMinutes: 30 },
} }, cycleDays: 8, availableDays: [0, 1, 2, 3, 4, 5, 6, 7], sessions: 2, cardioMinutes: 60, sessionMinutes: 30,
  maxActiveDays: 5, allowDoubles: false, strength: [] };
const make = () => saveCardioProposal('plan', 'owner', '  Aerobic base  ', input, null, now);
const routine = { id: 'r', currentMicrocycleIndex: 0, microcycles: [{ sessions: [{ plannedSessionIndex: 0, name: 'Lower', exercises: [] }] }] } as any;

it('continues reading a frozen v1 prescription fixture without silently rewriting its placements or omissions', () => {
  expect(validSavedCardioPlan(fixture, 'owner')).toBe(true);
  expect(fixture.preview.days).toHaveLength(8); expect(fixture.preview.omitted).toHaveLength(1);
});

it('separately versions the new placement policy, pins its source cycle and rejects mismatched or missing metadata', () => {
  const v2 = { ...input, placementPolicy: 'BALANCED_V2' as const, strength: [
    { id: 'r:0', name: 'Lower', dayIndex: 3, estimatedMinutes: 40, lowerBodyDemand: 'HIGH' as const },
  ] };
  const source = cardioStrengthSource(routine, 'CARDIO_PREVIEW_V2')!;
  expect(source.microcycleIndex).toBe(0);
  const saved = saveCardioProposal('p', 'owner', 'Plan', v2, source, now);
  expect(saved.policy).toBe('CARDIO_PREVIEW_V2'); expect(validSavedCardioPlan(saved, 'owner')).toBe(true);
  expect(cardioStrengthChanged(saved, routine)).toBe(false);
  expect(cardioStrengthChanged(saved, { ...routine, currentMicrocycleIndex: 1 })).toBe(true);
  expect(validSavedCardioPlan({ ...saved, policy: 'CARDIO_PREVIEW_V1' }, 'owner')).toBe(false);
  for (const microcycleIndex of [undefined, -1, 1.5, NaN]) {
    expect(validSavedCardioPlan({ ...saved, strengthSource: { ...source, microcycleIndex } }, 'owner')).toBe(false);
  }
  expect(validSavedCardioPlan({ ...make(), input: { ...input, placementPolicy: 'BALANCED_V2' } }, 'owner')).toBe(false);
  expect(cardioStrengthSource(routine)).not.toHaveProperty('microcycleIndex');
});

it('saves a detached eight-day snapshot with full prescriptions, not an active mesocycle or workout', () => {
  const before = JSON.stringify(input), saved = make();
  expect(saved).toMatchObject({ policy: 'CARDIO_PREVIEW_V1', name: 'Aerobic base', createdAt: now, archivedAt: null, strengthSource: null });
  expect(saved.preview.days).toHaveLength(8); expect(saved.preview.usedMinutes).toBe(60);
  expect(saved.preview.prescriptions[0].durationSeconds).toBe(1800);
  saved.input.availableDays.pop(); saved.input.profile.modalities.CYCLING!.typicalSessionMinutes = 10;
  expect(JSON.stringify(input)).toBe(before); expect(validSavedCardioPlan(saved, 'owner')).toBe(false);
});
it('whitelists planning fields and refuses snapshots containing arbitrary extra input', () => {
  const draft = { ...input, healthData: 'do not persist', profile: { ...input.profile, extra: true } };
  const saved = saveCardioProposal('p', 'owner', 'Plan', draft, null, now);
  expect(JSON.stringify(saved)).not.toContain('healthData'); expect(JSON.stringify(saved)).not.toContain('extra');
  expect(validSavedCardioPlan({ ...saved, input: { ...saved.input, healthData: 123 } }, 'owner')).toBe(false);
  expect(validSavedCardioPlan({ ...saved, input: { ...saved.input, strength: Array(32).fill(null) } }, 'owner')).toBe(false);
});
it.each([
  null, [], { schemaVersion: 2 }, { policy: 'FUTURE' }, { id: '../x' }, { userId: 'other' },
  { name: '' }, { name: ' x' }, { name: 'x'.repeat(81) }, { name: 0 }, { createdAt: 0 }, { createdAt: NaN },
  { archivedAt: now - 1 }, { archivedAt: Infinity }, { archivedAt: undefined },
  { input: null }, { preview: null }, { strengthSource: {} }, { strengthSource: { routineId: 'r', fingerprint: 'x' } },
])('rejects malformed, foreign or unsupported saved data: %p', patch => {
  expect(validSavedCardioPlan(patch === null ? null : Array.isArray(patch) ? [] : { ...make(), ...patch }, 'owner')).toBe(false);
});
it('requires a valid owner and verifies all derived placements and durations rather than trusting totals', () => {
  expect(validSavedCardioPlan({ get schemaVersion() { throw Error('decode'); } }, 'owner')).toBe(false);
  expect(validSavedCardioPlan({}, 'owner')).toBe(false);
  expect(validSavedCardioPlan(make(), '')).toBe(false);
  const saved = make(); saved.preview.usedMinutes = 999; expect(validSavedCardioPlan(saved, 'owner')).toBe(false);
  const reordered = JSON.parse(JSON.stringify(make())); reordered.input = Object.fromEntries(Object.entries(reordered.input).reverse());
  expect(validSavedCardioPlan(reordered, 'owner')).toBe(true);
  expect(() => saveCardioProposal('p', 'owner', 'Plan', { ...input, sessions: 0 }, null, now)).toThrow('invalidCardioPlan');
  expect(() => saveCardioProposal('p', 'owner', 'Plan', { ...input, availableDays: [] }, null, now)).toThrow('invalidCardioPlan');
  expect(() => saveCardioProposal('p', 'owner', null as any, input, null, now)).toThrow();
});
it('keeps source identity separate from reviewed placements and detects changed, replaced or missing strength', () => {
  const source = cardioStrengthSource(routine)!;
  const draft = { ...input, strength: [{ id: 'r:0', name: 'Lower', dayIndex: 3, estimatedMinutes: 40, lowerBodyDemand: 'HIGH' as const }] };
  const saved = saveCardioProposal('p', 'owner', 'Plan', draft, source, now);
  expect(validSavedCardioPlan(saved, 'owner')).toBe(true); expect(cardioStrengthChanged(saved, routine)).toBe(false);
  expect(cardioStrengthChanged(saved, { ...routine, id: 'replacement' })).toBe(true);
  expect(cardioStrengthChanged(saved, { ...routine, currentMicrocycleIndex: 1 })).toBe(true);
  expect(cardioStrengthChanged(saved)).toBe(true); expect(cardioStrengthChanged(make(), routine)).toBe(false);
  expect(cardioStrengthSource()).toBeNull();
  expect(() => saveCardioProposal('p', 'owner', 'Plan', draft, null, now)).toThrow();
  for (const strengthSource of [{ routineId: '../bad', fingerprint: 'x' }, { routineId: 'r', fingerprint: '' }, { routineId: 'r', fingerprint: 'x'.repeat(30001) }, { routineId: 'r', fingerprint: 1 }]) {
    expect(validSavedCardioPlan({ ...saved, strengthSource }, 'owner')).toBe(false);
  }
  expect(validSavedCardioPlan({ ...saved, input: { ...draft, strength: [{ ...draft.strength[0], name: 'x'.repeat(161) }] } }, 'owner')).toBe(false);
  expect(validSavedCardioPlan({ ...saved, input: { ...draft, strength: [{ ...draft.strength[0], id: 'x'.repeat(257) }] } }, 'owner')).toBe(false);
});
it('archives recoverably without mutating the saved plan or its prescriptions', () => {
  const saved = make(), before = JSON.stringify(saved), archived = archiveCardioProposal(saved, 'owner', now + 1);
  expect(archived.archivedAt).toBe(now + 1); expect(validSavedCardioPlan(archived, 'owner')).toBe(true); expect(JSON.stringify(saved)).toBe(before);
  expect(() => archiveCardioProposal(archived, 'owner', now + 2)).toThrow();
  expect(() => archiveCardioProposal(saved, 'owner', now - 1)).toThrow();
  expect(() => archiveCardioProposal(saved, 'other', now)).toThrow();
  expect(() => archiveCardioProposal(saved, 'owner', NaN)).toThrow();
});
