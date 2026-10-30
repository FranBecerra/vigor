import React from 'react';
import CardioHealthScreen from '@/app/cardio-health';
import { CardioHealthReviewPanel } from '../CardioHealthReviewPanel';
import { CardioPlanFlow } from '../CardioPlanFlow';
import { reviewedRecords, reviewedStart } from '@/testing/cardioReviewFixture';
const { create, act } = require('react-test-renderer');
let mockOwner: string | null = 'owner', mockLoading = false;
const mockBack = jest.fn(), mockReplace = jest.fn();
const mockReview: any = { state: 'READY', data: undefined, observedAt: 1, read: jest.fn(), clear: jest.fn() };
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: mockOwner, isLoading: mockLoading }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ canGoBack: () => true, back: mockBack, replace: mockReplace }) }));
jest.mock('@/hooks/useCardioHealthReview', () => ({ useCardioHealthReview: () => mockReview }));
jest.mock('../CardioHealthReviewPanel', () => ({ CardioHealthReviewPanel: 'CardioHealthReviewPanel' }));
jest.mock('../CardioPlanFlow', () => ({ CardioPlanFlow: 'CardioPlanFlow' }));
beforeEach(() => {
  jest.clearAllMocks(); mockOwner = 'owner'; mockLoading = false; mockReview.state = 'READY'; mockReview.data = reviewedRecords();
  mockReview.clear.mockImplementation(() => { mockReview.data = undefined; mockReview.state = 'IDLE'; });
});
it('clears original records at explicit handoff and cancels directly back to an empty review without navigation loops', async () => {
  let tree: any; await act(async () => { tree = create(<CardioHealthScreen />); });
  await act(async () => tree.root.findByType(CardioHealthReviewPanel).props.onPlan(reviewedStart()));
  expect(mockReview.clear).toHaveBeenCalledTimes(1); expect(mockReview.data).toBeUndefined();
  expect(tree.root.findByType(CardioPlanFlow).props.initialBaseline).toEqual(reviewedStart());
  await act(async () => tree.root.findByType(CardioPlanFlow).props.onCancel());
  expect(tree.root.findByType(CardioHealthReviewPanel).props.state).toBe('IDLE'); expect(mockBack).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType(CardioHealthReviewPanel).props.onClose()); expect(mockBack).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
it('removes applied summaries during unresolved authentication and account A/B/A transitions', async () => {
  let tree: any; await act(async () => { tree = create(<CardioHealthScreen />); });
  await act(async () => tree.root.findByType(CardioHealthReviewPanel).props.onPlan(reviewedStart()));
  mockLoading = true; await act(async () => tree.update(<CardioHealthScreen />)); expect(tree.root.findAllByType(CardioPlanFlow)).toHaveLength(0);
  mockLoading = false; mockOwner = 'other'; await act(async () => tree.update(<CardioHealthScreen />));
  mockOwner = 'owner'; await act(async () => tree.update(<CardioHealthScreen />)); expect(tree.root.findAllByType(CardioPlanFlow)).toHaveLength(0);
  expect(mockReview.read).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled(); await act(async () => tree.unmount());
});
