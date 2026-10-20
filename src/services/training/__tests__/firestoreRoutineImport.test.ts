import source from '@/data/imports/2026-10-micro-1.json';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { importAuthoredMicrocycle } from '../routineImport';
import { manualRoutineDocuments } from '../manualRoutine';
import { firestoreValue, routineImportCommit } from '../firestoreRoutineImport';
import { TrainingGoal } from '../volumePlan';

const catalogue = new Map(EXERCISE_CATALOGUE.map((ex) => [ex.id, ex]));
const documents = () => manualRoutineDocuments({ userId: 'u', routineId: 'r', name: 'Imported plan', goal: TrainingGoal.HYPERTROPHY,
  microcycles: 6, sessions: importAuthoredMicrocycle(source, catalogue), catalogue, now: 1, active: false, accentColor: '#aaa', automaticProgression: true });
it('creates exactly the linked mesocycle and inactive routine atomically, never overwriting either document', () => {
  const result = routineImportCommit('vigor-project', documents());
  expect(result.writes.map((write) => write.update.name)).toEqual([
    'projects/vigor-project/databases/(default)/documents/mesocycles/r-m0',
    'projects/vigor-project/databases/(default)/documents/routines/r',
  ]);
  expect(result.writes.every((write) => write.currentDocument.exists === false)).toBe(true);
  expect(result.writes[1].update.fields.isActive).toEqual({ booleanValue: false });
  expect(result.writes[1].update.fields.id).toBeUndefined();
  expect(result.writes[0].update.fields.prescriptionMode).toEqual({ stringValue: 'AUTOMATIC' });
});
it('encodes Firestore primitives, empty containers, fractional credits and nested maps explicitly', () => {
  expect(firestoreValue(null)).toEqual({ nullValue: null });
  expect(firestoreValue(2)).toEqual({ integerValue: '2' });
  expect(firestoreValue(0.5)).toEqual({ doubleValue: 0.5 });
  expect(firestoreValue(false)).toEqual({ booleanValue: false });
  expect(firestoreValue('')).toEqual({ stringValue: '' });
  expect(firestoreValue([])).toEqual({ arrayValue: { values: [] } });
  expect(firestoreValue({})).toEqual({ mapValue: { fields: {} } });
  expect(firestoreValue({ values: [1] })).toEqual({ mapValue: { fields: { values: { arrayValue: { values: [{ integerValue: '1' }] } } } } });
});
it.each([undefined, NaN, Infinity, () => 1, new Date(), [[1]], { bad: undefined }])('rejects unsupported values instead of silently dropping them: %p', (value) => {
  expect(() => firestoreValue(value)).toThrow();
});
it.each(['project', 'identity', 'owner', 'link', 'mesocycleLink', 'activation'])('rejects unsafe document imports: %s', (kind) => {
  const docs = documents(); let project = 'vigor-project';
  if (kind === 'project') project = 'other/path';
  if (kind === 'identity') docs.routine.id = '../other';
  if (kind === 'owner') docs.mesocycle.userId = 'other';
  if (kind === 'link') docs.routine.activeMesocycleId = 'other';
  if (kind === 'mesocycleLink') docs.mesocycle.routineId = 'other';
  if (kind === 'activation') docs.routine.isActive = true;
  expect(() => routineImportCommit(project, docs)).toThrow('unsafeRoutineImport');
});
