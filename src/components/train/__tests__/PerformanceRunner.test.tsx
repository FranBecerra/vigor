import React from 'react';
import PerformanceScreen from '@/app/(tabs)/(train)/performance';
const { create, act } = require('react-test-renderer');
let mockParams = { autorun: 'first-run', target: 'fixture-simulator' };
const mockReports: any[] = [];
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }), useLocalSearchParams: () => mockParams }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('expo-file-system', () => ({ Paths: { document: '/fixture' }, File: class {
  name: string;
  constructor(_path: unknown, name: string) { this.name = name; }
  create() {}
  write(value: string) { mockReports.push(JSON.parse(value)); }
  move(target: { name: string }) { this.name = target.name; }
} }));
jest.mock('../generate/GenerationChoice', () => ({ GenerationChoice: () => null }));
jest.mock('../generate/ExerciseSwapSheet', () => ({ ExerciseSwapSheet: (props: any) => {
  const React = require('react');
  React.useEffect(() => { if (props.open) {
    require('@/services/performance/uiPerformance').uiPerformance.end('picker.ready'); props.onPresented();
  } }, [props.open]); return null;
} }));
beforeEach(() => {
  mockReports.length = 0; mockParams = { autorun: 'first-run', target: 'fixture-simulator' }; jest.useFakeTimers();
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => setTimeout(() => callback(performance.now()), 16) as unknown as number);
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation((id) => clearTimeout(id));
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
const finish = async (expectedReports: number) => {
  // Flush React between small frame advances; large jumps artificially stall commits
  // and fill the bounded recorder with fake frame samples.
  for (let iteration = 0; iteration < 1000 && mockReports.length < expectedReports; iteration++) {
    await act(async () => { await jest.advanceTimersByTimeAsync(50); });
  }
};
it('exports complete fixture-only samples and reruns when a new link targets the mounted screen', async () => {
  let tree: any;
  await act(async () => { tree = create(<PerformanceScreen />); });
  await finish(1);
  expect(mockReports).toHaveLength(1);
  expect(mockReports[0].runId).toBe('first-run');
  expect(mockReports[0].environment.workload).toBe('illustrated-options-v1');
  for (const metric of ['button.commit', 'wizard.commit', 'picker.ready']) expect(mockReports[0].samples.filter((sample: any) => sample.metric === metric)).toHaveLength(31);
  mockParams = { ...mockParams, autorun: 'second-run' };
  await act(async () => tree.update(<PerformanceScreen />));
  await finish(2);
  expect(mockReports).toHaveLength(2); expect(mockReports[1].runId).toBe('second-run');
  await act(async () => tree.unmount());
});
it('cancels an unfinished run on exit without publishing a partial report', async () => {
  let tree: any;
  await act(async () => { tree = create(<PerformanceScreen />); });
  await act(async () => tree.unmount());
  await act(async () => { await jest.advanceTimersByTimeAsync(6000); });
  expect(mockReports).toHaveLength(0);
});
