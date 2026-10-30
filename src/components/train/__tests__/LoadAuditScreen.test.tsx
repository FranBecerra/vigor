import React from 'react';
import { Share } from 'react-native';
import LoadAuditScreen from '@/app/load-audit';
import { loadAudit } from '@/services/performance/loadAudit';
const { create, act } = require('react-test-renderer');
const mockBack = jest.fn(), mockReplace = jest.fn(); let mockCanBack = true;
jest.mock('expo-router', () => ({ useRouter: () => ({ canGoBack: () => mockCanBack, back: mockBack, replace: mockReplace }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
function button(tree: any, key: string) {
  return tree.root.findAll((n: any) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function' && n.findAll((c: any) => c.props.children === key).length)[0];
}
afterEach(() => { jest.restoreAllMocks(); loadAudit.clear(); mockCanBack = true; });
it('refreshes, exports only anonymous diagnostics, handles sharing failure, clears and safely returns', async () => {
  loadAudit.clear(); loadAudit.begin('bio.health')('error');
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction });
  let tree: any; await act(async () => { tree = create(<LoadAuditScreen />); });
  loadAudit.begin('history.read')(); await act(async () => button(tree, 'loadAudit.refresh').props.onPress());
  await act(async () => button(tree, 'loadAudit.share').props.onPress());
  const report = JSON.parse((share.mock.calls[0][0] as any).message);
  expect(report.version).toBe(1); expect(report.samples).toHaveLength(2); expect(report).not.toHaveProperty('userId');
  share.mockRejectedValueOnce(Error('cancel')); await act(async () => button(tree, 'loadAudit.share').props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('loadAudit.shareError');
  await act(async () => button(tree, 'loadAudit.clear').props.onPress()); expect(loadAudit.snapshot()).toEqual([]);
  expect(JSON.stringify(tree.toJSON())).toContain('loadAudit.empty');
  mockCanBack = false; await act(async () => button(tree, 'generate.back').props.onPress()); expect(mockReplace).toHaveBeenCalledWith('/settings');
  mockCanBack = true; await act(async () => button(tree, 'generate.back').props.onPress()); expect(mockBack).toHaveBeenCalled();
  await act(async () => tree.unmount());
});
