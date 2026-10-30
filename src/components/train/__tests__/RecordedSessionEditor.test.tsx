import React from 'react';
import { Alert } from 'react-native';
import { RecordedSessionEditor } from '../RecordedSessionEditor';
import { WorkoutHistoryEditor } from '../WorkoutHistoryEditor';
import { WorkoutHistoryDetails } from '../WorkoutHistoryDetails';
import { RIRProgressionPreview } from '../RIRProgressionPreview';
import { SetType } from '@/models';
const { create, act } = require('react-test-renderer');
const mockGet = jest.fn(), mockEdit = jest.fn(), mockPlan = jest.fn(), mockList = jest.fn(), mockUpdate = jest.fn();
let mockUid: string | null = 'u';
const mockCatalogue = new Map();
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('@/hooks/useExerciseCatalogue', () => ({ useExerciseCatalogue: () => ({ exercisesById: mockCatalogue }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/repositories', () => ({ workoutSessionRepository: { get: (...args: unknown[]) => mockGet(...args),
  editCompletedLocally: (...args: unknown[]) => mockEdit(...args), listByUser: (...args: unknown[]) => mockList(...args) },
  mesocycleRepository: { get: (...args: unknown[]) => mockPlan(...args), update: (...args: unknown[]) => mockUpdate(...args) } }));
jest.mock('../WorkoutHistoryEditor', () => ({ WorkoutHistoryEditor: () => null }));
jest.mock('../WorkoutHistoryDetails', () => ({ WorkoutHistoryDetails: () => null }));
jest.mock('../RIRProgressionPreview', () => ({ RIRProgressionPreview: () => null }));
const record: any = { id: 'w', userId: 'u', mesocycleId: 'm', plannedSessionIndex: 2, microcycleIndex: 0,
  performedAt: 1, completedAt: 1000, exercises: [{ id: 'e', exerciseId: 'ex', order: 0, isSwap: false, sets: [
    { id: 's', setType: SetType.NORMAL, targetReps: 10, targetRIR: 2, actualRIR: 2, actualWeight: 20, actualReps: 10, completionState: 'DONE' },
  ] }] };
const plan: any = { id: 'm', userId: 'u', prescriptionMode: 'MANUAL', currentMicrocycleIndex: 1, projectedMicrocycles: 4,
  plannedSessions: [{ index: 2, focus: 'LOWER', estimatedWorkMinutes: 10, exercises: [{ exerciseId: 'ex', order: 0, isEdited: false,
    sets: [{ setType: SetType.NORMAL, targetReps: 10, targetRIR: 2 }] }] }] };
const props = { workoutId: 'w', mesocycleId: 'm', cycle: 0, sessionIndex: 2, editing: true,
  onClose: jest.fn(), onSaved: jest.fn(), onDirtyChange: jest.fn(), onBusyChange: jest.fn() };
beforeEach(() => { jest.clearAllMocks(); mockUid = 'u'; mockGet.mockResolvedValue(record); mockPlan.mockResolvedValue(plan);
  mockList.mockResolvedValue([record]); mockEdit.mockImplementation(async (_original, _owner, draft) => ({ ...record, ...draft, editedAt: 2000 })); mockUpdate.mockResolvedValue(undefined); });
it('edits the exact recorded execution inline, then preserves a read-only summary without navigation', async () => {
  let tree: any; await act(async () => { tree = create(<RecordedSessionEditor {...props} />); });
  expect(mockGet).toHaveBeenCalledWith('w'); expect(tree.root.findByType(WorkoutHistoryEditor).props).toMatchObject({ inline: true, session: record });
  await act(async () => tree.root.findByType(WorkoutHistoryEditor).props.onSave({ exercises: record.exercises, sessionName: 'Corrected' }));
  expect(mockEdit).toHaveBeenCalledWith(record, 'u', expect.objectContaining({ sessionName: 'Corrected' }), expect.any(Function));
  expect(props.onSaved).toHaveBeenCalledTimes(1); expect(mockUpdate).not.toHaveBeenCalled();
  await act(async () => tree.update(<RecordedSessionEditor {...props} editing={false} />));
  expect(tree.root.findAllByType(WorkoutHistoryEditor)).toHaveLength(0); expect(tree.root.findAllByType(WorkoutHistoryDetails)).toHaveLength(1);
  await act(async () => tree.unmount());
});
it.each([null, { ...record, userId: 'other' }, { ...record, mesocycleId: 'other' }, { ...record, plannedSessionIndex: 3 },
  { ...record, microcycleIndex: 1 }, { ...record, completedAt: undefined }, { ...record, discardedAt: 2 }])('does not edit mismatched, missing or discarded records', async (value) => {
  mockGet.mockResolvedValue(value); let tree: any; await act(async () => { tree = create(<RecordedSessionEditor {...props} />); });
  expect(tree.root.findAllByType(WorkoutHistoryEditor)).toHaveLength(0); expect(JSON.stringify(tree.toJSON())).toContain('workout.historyError');
  expect(mockEdit).not.toHaveBeenCalled(); await act(async () => tree.unmount());
});
it('ignores late loads and rejects an old save callback after changing athlete', async () => {
  let tree: any; await act(async () => { tree = create(<RecordedSessionEditor {...props} />); });
  const oldSave = tree.root.findByType(WorkoutHistoryEditor).props.onSave;
  mockUid = 'other'; mockGet.mockResolvedValue({ ...record, userId: 'other' }); await act(async () => tree.update(<RecordedSessionEditor {...props} />));
  await expect(oldSave({ exercises: record.exercises })).rejects.toThrow(); expect(mockEdit).not.toHaveBeenCalled();
  mockUid = 'u'; await act(async () => tree.update(<RecordedSessionEditor {...props} />));
  await expect(oldSave({ exercises: record.exercises })).rejects.toThrow();
  await act(async () => tree.unmount());
});
it('saves actuals before an explicit future RIR review and revalidates before acceptance', async () => {
  let tree: any; await act(async () => { tree = create(<RecordedSessionEditor {...props} />); });
  const corrected = { ...record, exercises: record.exercises.map((entry: any) => ({ ...entry, sets: entry.sets.map((set: any) => ({ ...set, actualRIR: 3 })) })) };
  mockList.mockResolvedValue([corrected]);
  await act(async () => tree.root.findByType(WorkoutHistoryEditor).props.onSave(corrected, true));
  expect(mockPlan.mock.invocationCallOrder[0]).toBeGreaterThan(mockEdit.mock.invocationCallOrder[0]);
  expect(mockUpdate).not.toHaveBeenCalled(); expect(tree.root.findByType(RIRProgressionPreview).props.steps.map((s: any) => s.index)).toEqual([1, 2, 3]);
  await act(async () => tree.root.findByType(RIRProgressionPreview).props.onApply());
  expect(mockUpdate).toHaveBeenCalledWith('m', expect.objectContaining({ sessionOverrides: expect.objectContaining({ '1:2': expect.any(Object), '3:2': expect.any(Object) }) }));
  expect(mockUpdate.mock.calls[0][1].sessionOverrides['0:2']).toBeUndefined();
  await act(async () => tree.unmount());
});
it('retains a saved correction when the future plan cannot be reviewed', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {}); mockPlan.mockRejectedValue(Error('offline'));
  let tree: any; await act(async () => { tree = create(<RecordedSessionEditor {...props} />); });
  await act(async () => tree.root.findByType(WorkoutHistoryEditor).props.onSave(record, true));
  expect(props.onSaved).toHaveBeenCalled(); expect(alert).toHaveBeenCalledWith('workout.saved', 'historyProgression.failed');
  expect(mockUpdate).not.toHaveBeenCalled(); await act(async () => tree.unmount()); alert.mockRestore();
});
