import React from 'react';
import { Alert } from 'react-native';
import { SavedCardioPlans } from '../SavedCardioPlans';
import CardioCycleScreen from '@/app/(tabs)/(train)/cardio-cycle';
import { CardioCycleView } from '../CardioCycleView';
import { cardioStrengthSource, saveCardioProposal } from '@/services/cardio/savedCardioPlan';
const { create, act } = require('react-test-renderer');
const mockRouter = { push: jest.fn(), dismissTo: jest.fn() };
let mockUid = 'owner'; const mockStrength = { routines: [] as any[], status: 'ready', reload: jest.fn() };
const mockPlans = { entries: [] as any[], ready: true, pending: false, error: false, reload: jest.fn(), archive: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ id: 'p' }) }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('@/hooks/useCardioPlans', () => ({ useCardioPlans: () => mockPlans }));
jest.mock('../CardioActivation', () => ({ CardioActivation: () => null }));
jest.mock('@/hooks/useRoutines', () => ({ useRoutines: () => mockStrength }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const now = Date.UTC(2026, 9, 29), routine = { id: 'r', isActive: true, domain: 'STRENGTH', currentMicrocycleIndex: 0, microcycles: [{ sessions: [] }] } as any;
const input = { modalities: ['RUNNING'], profile: { schemaVersion: 1, modalities: {} }, cycleDays: 8, availableDays: [0, 3], sessions: 2,
  cardioMinutes: 60, sessionMinutes: 30, maxActiveDays: 5, allowDoubles: false, strength: [] } as any;
const saved = saveCardioProposal('p', 'owner', 'Aerobic base', input, null, now);
const press = (tree: any, label: string) => tree.root.findAll((n: any) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0].props.onPress();
const output = (tree: any) => JSON.stringify(tree.toJSON());
beforeEach(() => { jest.clearAllMocks(); mockUid = 'owner'; mockPlans.entries = [saved]; mockPlans.ready = true; mockPlans.error = false; mockPlans.pending = false;
  mockPlans.archive.mockResolvedValue({ ...saved, archivedAt: now }); mockStrength.status = 'ready'; mockStrength.routines = []; });
it('opens named saved proposals, distinguishes pending cloud sync and retries read failures', async () => {
  let tree: any; mockPlans.pending = true; mockPlans.error = true; await act(async () => { tree = create(<SavedCardioPlans />); });
  expect(output(tree)).toContain('cardioSaved.proposal'); expect(output(tree)).toContain('cardioSaved.pending');
  await act(async () => press(tree, 'cardioSaved.open')); expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/cardio-cycle', params: { id: 'p' } });
  await act(async () => press(tree, 'home.retry')); expect(mockPlans.reload).toHaveBeenCalled(); expect(mockPlans.archive).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
it('reopens exactly the saved relative cycle and session prescription, including walking guidance', async () => {
  let tree: any; await act(async () => { tree = create(<CardioCycleScreen />); });
  expect(tree.root.findByType(CardioCycleView).props.preview).toBe(saved.preview); expect(output(tree)).toContain('cardioSaved.notActive');
  await act(async () => press(tree, 'cardioPlan.openSession')); expect(output(tree)).toContain('20:00'); expect(output(tree)).toContain('cardioPlan.walking');
  await act(async () => press(tree, 'workout.done')); await act(async () => press(tree, 'generate.back'));
  expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(tabs)/(train)'); await act(async () => tree.unmount());
});
it('warns about changed or unavailable strength without rewriting or hiding the saved snapshot', async () => {
  const strength = [{ id: 'r:0', name: 'Lower', dayIndex: 1, estimatedMinutes: 50, lowerBodyDemand: 'HIGH' }];
  mockPlans.entries = [saveCardioProposal('p', 'owner', 'Combined', { ...input, strength }, cardioStrengthSource(routine), now)];
  let tree: any; await act(async () => { tree = create(<CardioCycleScreen />); }); expect(output(tree)).toContain('cardioSaved.contextChanged');
  mockStrength.routines = [routine]; await act(async () => tree.update(<CardioCycleScreen />)); expect(output(tree)).not.toContain('cardioSaved.contextChanged');
  mockStrength.status = 'error'; await act(async () => tree.update(<CardioCycleScreen />)); expect(output(tree)).toContain('cardioSaved.contextUnavailable');
  await act(async () => press(tree, 'cardioSaved.retryStrength')); expect(mockStrength.reload).toHaveBeenCalled(); expect(mockPlans.archive).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
it('handles loading/missing/corrupt reads and blocks archiving while the read is uncertain', async () => {
  let tree: any; mockPlans.ready = false; await act(async () => { tree = create(<CardioCycleScreen />); }); expect(tree.root.findAllByType(CardioCycleView)).toHaveLength(0);
  mockPlans.ready = true; mockPlans.entries = []; mockPlans.error = true; await act(async () => tree.update(<CardioCycleScreen />));
  expect(output(tree)).toContain('cardioSaved.loadFailed'); await act(async () => press(tree, 'home.retry')); expect(mockPlans.reload).toHaveBeenCalled();
  mockPlans.entries = [saved]; await act(async () => tree.update(<CardioCycleScreen />));
  expect(tree.root.findAll((n: any) => n.props.accessibilityLabel === 'cardioSaved.archive')).toHaveLength(0);
  await act(async () => tree.unmount());
});
it('requires confirmation, handles archive failures and prevents late navigation after owner changes', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined); let tree: any;
  await act(async () => { tree = create(<CardioCycleScreen />); }); await act(async () => press(tree, 'cardioSaved.archive')); expect(mockPlans.archive).not.toHaveBeenCalled();
  expect(alert.mock.calls[0][2]![0].style).toBe('cancel'); expect(alert.mock.calls[0][2]![1].style).toBe('destructive');
  mockPlans.archive.mockRejectedValueOnce(Error('native')); await act(async () => alert.mock.calls[0][2]![1].onPress!());
  expect(output(tree)).toContain('cardioSaved.saveFailed'); expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  let finish!: () => void; mockPlans.archive.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  await act(async () => press(tree, 'cardioSaved.archive')); let pending: Promise<void>;
  await act(async () => { pending = alert.mock.calls[1][2]![1].onPress!() as any; });
  await act(async () => alert.mock.calls[1][2]![1].onPress!()); expect(mockPlans.archive).toHaveBeenCalledTimes(2);
  mockUid = 'other'; mockPlans.entries = []; await act(async () => tree.update(<CardioCycleScreen />));
  await act(async () => { finish(); await pending!; }); expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  await act(async () => tree.unmount()); alert.mockRestore();
});
it('archives successfully and returns directly to training', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined); let tree: any;
  await act(async () => { tree = create(<CardioCycleScreen />); }); await act(async () => press(tree, 'cardioSaved.archive'));
  await act(async () => alert.mock.calls[0][2]![1].onPress!()); expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(tabs)/(train)');
  expect(mockPlans.archive).toHaveBeenCalledWith(saved); await act(async () => tree.unmount()); alert.mockRestore();
});
