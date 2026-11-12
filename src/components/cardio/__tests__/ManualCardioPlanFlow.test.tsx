import React from 'react';
import { TextInput } from 'react-native';
import { ManualCardioPlanFlow } from '../ManualCardioPlanFlow';
import { CardioCycleView } from '../CardioCycleView';
import { validSavedCardioPlan } from '@/services/cardio/savedCardioPlan';
const { create, act } = require('react-test-renderer');

const mockRouter = { replace: jest.fn(), back: jest.fn(), canGoBack: () => true };
const mockPlans = { ready: true, error: false, newId: () => 'manual', save: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useFocusEffect: () => undefined }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: 'owner' }) }));
jest.mock('@/hooks/useCardioPlans', () => ({ useCardioPlans: () => mockPlans }));
jest.mock('@/hooks/useTrainingDraftGuard', () => ({ useProtectTrainingDraft: () => undefined }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it('returns to the authored draft, then retries the same validated saved proposal', async () => {
  mockPlans.save.mockRejectedValueOnce(Error('offline')).mockImplementation(async plan => plan);
  let tree: any;
  await act(async () => { tree = create(<ManualCardioPlanFlow />); });
  const edit = (label: string) => tree.root.findAllByType(TextInput).find((node: any) => node.props.accessibilityLabel === label);
  const press = (label: string, last = false) => act(async () => {
    const matches = tree.root.findAll((node: any) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function'
      && node.findAll((child: any) => child.props.children === label).length > 0);
    (last ? matches.at(-1) : matches[0]).props.onPress();
  });
  await act(async () => edit('generate.name').props.onChangeText('Manual run'));
  await act(async () => edit('cardioPlan.MAIN · manualCardio.zone').props.onChangeText('2'));
  await press('cardioPlan.review');
  expect(tree.root.findByType(CardioCycleView).props.preview.prescriptions[0]).toMatchObject({
    policy: 'MANUAL_PHASES_V1', segments: [{ phase: 'MAIN', targets: { heartRateZone: 2 } }],
  });
  expect(mockPlans.save).not.toHaveBeenCalled();
  await press('generate.back', true);
  expect(edit('cardioPlan.MAIN · manualCardio.zone').props.value).toBe('2');
  await press('cardioPlan.review');
  await press('generate.save');
  const plan = mockPlans.save.mock.calls[0][0];
  expect(validSavedCardioPlan(plan, 'owner')).toBe(true);
  expect(mockRouter.replace).not.toHaveBeenCalled();
  await press('generate.save');
  expect(mockPlans.save.mock.calls[1][0]).toBe(plan);
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/cardio-cycle', params: { id: 'manual' } });
  await act(async () => tree.unmount());
});
