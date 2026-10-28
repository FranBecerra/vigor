import React from 'react';
import { TextInput } from 'react-native';
import SettingsScreen from '@/app/settings';
import { NumericField } from '../NumericField';
const { create, act } = require('react-test-renderer');
const mockChange = jest.fn(async () => true); const mockSave = jest.fn(async () => true); const mockBack = jest.fn(); const mockReplace = jest.fn();
let mockCanGoBack = true; let mockPreferences: any;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ canGoBack: () => mockCanGoBack, back: mockBack, replace: mockReplace }) }));
jest.mock('@/hooks/useAppSettings', () => ({ useAppSettings: () => mockPreferences }));
jest.mock('../WorkoutHealthExport', () => ({ HealthExportSettings: () => null }));
jest.mock('@/components/bio/BioHealthSettings', () => ({ BioHealthSettings: () => null }));
beforeEach(() => { jest.clearAllMocks(); mockCanGoBack = true; mockPreferences = { settings: { appearance: 'system', language: 'system' }, displayName: 'Fran', ready: true, busy: false, error: false,
  change: mockChange, saveName: mockSave, reload: jest.fn() }; });
const button = (tree: any, label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const save = (tree: any) => tree.root.findAll((node: any) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function'
  && node.findAll((child: any) => child.props.children === 'settings.saveName').length)[0];
it('offers real appearance/language choices and validates the name without a health prompt', async () => {
  let tree: any; await act(async () => { tree = create(<SettingsScreen />); });
  expect(mockChange).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
  await act(async () => button(tree, 'settings.appearance: settings.dark').props.onPress()); expect(mockChange).toHaveBeenCalledWith({ appearance: 'dark' });
  await act(async () => button(tree, 'settings.language: settings.language_en').props.onPress()); expect(mockChange).toHaveBeenCalledWith({ language: 'en' });
  await act(async () => tree.root.findAllByType(TextInput).find((node: any) => node.props.accessibilityLabel === 'settings.displayName').props.onChangeText(''));
  await act(async () => save(tree).props.onPress()); expect(mockSave).not.toHaveBeenCalled(); expect(JSON.stringify(tree.toJSON())).toContain('settings.invalidName');
  await act(async () => tree.root.findAllByType(TextInput).find((node: any) => node.props.accessibilityLabel === 'settings.displayName').props.onChangeText('Franci'));
  await act(async () => save(tree).props.onPress()); expect(mockSave).toHaveBeenCalledWith('Franci'); expect(JSON.stringify(tree.toJSON())).toContain('settings.nameSaved');
  await act(async () => tree.unmount());
});
it('saves unit preference and the configurable quarter-load step independently', async () => {
  let tree: any; await act(async () => { tree = create(<SettingsScreen />); });
  await act(async () => button(tree, 'executionUpdates.units: executionUpdates.imperial').props.onPress());
  expect(mockChange).toHaveBeenCalledWith({ measurementSystem: 'imperial' });
  await act(async () => tree.root.findByType(NumericField).props.onChangeValue(0.5));
  expect(mockChange).toHaveBeenCalledWith({ weightIncrement: 0.5 });
  await act(async () => tree.unmount());
});
it('returns to Profile from a direct link without an unhandled back action', async () => {
  mockCanGoBack = false; let tree: any; await act(async () => { tree = create(<SettingsScreen />); });
  await act(async () => button(tree, 'generate.back').props.onPress()); expect(mockReplace).toHaveBeenCalledWith('/(tabs)/profile'); expect(mockBack).not.toHaveBeenCalled();
  mockCanGoBack = true; await act(async () => button(tree, 'generate.back').props.onPress()); expect(mockBack).toHaveBeenCalled();
  await act(async () => tree.unmount());
});
