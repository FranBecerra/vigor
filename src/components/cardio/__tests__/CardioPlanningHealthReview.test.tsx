import React from 'react';
import { CardioPlanningHealthReview } from '../CardioPlanningHealthReview';
import { CardioHealthReviewPanel } from '../CardioHealthReviewPanel';
import { CardioPlanningHistoryProvider } from '../CardioPlanningHistoryProvider';
import { useCardioPlanningHistory } from '../CardioPlanningHistoryContext';
import { reviewedInput, reviewedNow, reviewedStart } from '@/testing/cardioReviewFixture';
const { create, act } = require('react-test-renderer');
const mockRead = jest.fn(), mockClear = jest.fn(), mockHealthHook = jest.fn();
const mockHistory = { owner: 'owner', entries: [], ready: true, error: false, reload: jest.fn() };
let mockReview: any;
jest.mock('@/hooks/useCardioHealthReview', () => ({ useCardioHealthReview: (...args: unknown[]) => { mockHealthHook(...args); return mockReview; } }));
jest.mock('@/hooks/useCardioTraining', () => ({ useCardioWorkouts: () => mockHistory }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
beforeEach(() => { jest.clearAllMocks(); mockReview = { state: 'IDLE', owner: 'owner', read: mockRead, clear: mockClear, epoch: 1 }; });
it('mounts Health without reading, uses explicit actions, and drops stale hook callbacks', async () => {
  const onApply = jest.fn(), onClose = jest.fn(), input = reviewedInput(); let tree: any;
  const bridge = { available: jest.fn(), authorize: jest.fn(), read: jest.fn() };
  await act(async () => { tree = create(<CardioPlanningHealthReview input={input} onClose={onClose} onApply={onApply} bridge={bridge} />); });
  expect(mockHealthHook).toHaveBeenCalledWith(bridge); expect(mockRead).not.toHaveBeenCalled();
  const panel = () => tree.root.findByType(CardioHealthReviewPanel).props;
  await act(async () => panel().onRead()); expect(mockRead).toHaveBeenCalledTimes(1);
  await act(async () => panel().onClear()); expect(mockClear).toHaveBeenCalledTimes(1);
  await act(async () => panel().onClose()); expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => panel().onPlan(reviewedStart())); expect(onApply).not.toHaveBeenCalled();
  mockReview = { ...mockReview, state: 'READY', observedAt: reviewedNow };
  await act(async () => tree.update(<CardioPlanningHealthReview input={input} onClose={onClose} onApply={onApply} bridge={bridge} />));
  const old = panel().onPlan;
  await act(async () => old({ ...reviewedStart(), observedAt: reviewedNow - 1 })); expect(onApply).not.toHaveBeenCalled();
  await act(async () => old(reviewedStart())); expect(onApply).toHaveBeenCalledTimes(1);
  mockReview = { ...mockReview, state: 'IDLE', observedAt: undefined, epoch: 2 };
  await act(async () => tree.update(<CardioPlanningHealthReview input={input} onClose={onClose} onApply={onApply} bridge={bridge} />));
  await act(async () => old(reviewedStart())); expect(onApply).toHaveBeenCalledTimes(1); await act(async () => tree.unmount());
});
it('wires available Vigor records into ordinary creation without mounting native Health access', async () => {
  let value: ReturnType<typeof useCardioPlanningHistory>, tree: any;
  function Probe() { value = useCardioPlanningHistory(); return null; }
  await act(async () => { tree = create(<CardioPlanningHistoryProvider><Probe /></CardioPlanningHistoryProvider>); });
  expect(value!).toMatchObject(mockHistory); expect(mockHealthHook).toHaveBeenCalledTimes(1); expect(mockRead).not.toHaveBeenCalled();
  const element = value!.renderHealth!({ input: reviewedInput(), onClose: jest.fn(), onApply: jest.fn() }) as React.ReactElement;
  expect(element.type).toBe(CardioPlanningHealthReview); expect(mockRead).not.toHaveBeenCalled(); await act(async () => tree.unmount());
});

it('keeps the same Health review after closing and remounting its sheet within the creation route', async () => {
  let context!: ReturnType<typeof useCardioPlanningHistory>, show!: (value:boolean)=>void; let tree:any;
  mockReview = { ...mockReview,state:'READY',observedAt:reviewedNow };
  function Probe() {
    context = useCardioPlanningHistory(); const [open,setOpen] = React.useState(true); show=setOpen;
    return open ? context!.renderHealth!({input:reviewedInput(),onClose:()=>setOpen(false),onApply:jest.fn()}) : null;
  }
  await act(async () => { tree=create(<CardioPlanningHistoryProvider><Probe /></CardioPlanningHistoryProvider>); });
  const panel=()=>tree.root.findByType(CardioHealthReviewPanel).props;
  expect(panel().state).toBe('READY'); await act(async()=>panel().onClose());
  await act(async()=>show(true)); expect(panel().state).toBe('READY');
  expect(mockRead).not.toHaveBeenCalled(); expect(mockClear).not.toHaveBeenCalled();
  await act(async()=>tree.unmount());
});
