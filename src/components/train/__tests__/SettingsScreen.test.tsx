import React from 'react';
import { Text, TextInput } from 'react-native';
import { ACCENTS, ACCENT_KEYS } from '@/theme/accent';
import { CheckIcon } from '@/components/icons/ActionIcons';
import SettingsScreen from '@/app/settings';
import { NumericField } from '../NumericField';
const { create, act } = require('react-test-renderer');
const ReactNative = require('react-native');
const mockChange = jest.fn(async () => true); const mockSave = jest.fn(async () => true); const mockBack = jest.fn(); const mockReplace = jest.fn();
let mockCanGoBack = true; let mockPreferences: any;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ canGoBack: () => mockCanGoBack, back: mockBack, replace: mockReplace }) }));
jest.mock('@/hooks/useAppSettings', () => ({ useAppSettings: () => mockPreferences }));
jest.mock('../WorkoutHealthExport', () => ({ HealthExportSettings: () => null }));
jest.mock('@/components/bio/BioHealthSettings', () => ({ BioHealthSettings: () => null }));
beforeEach(() => { jest.clearAllMocks(); jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 }); mockCanGoBack = true; mockPreferences = { settings: { appearance: 'system', language: 'system' }, displayName: 'Fran', ready: true, busy: false, error: false,
  change: mockChange, saveName: mockSave, reload: jest.fn() }; });
afterEach(() => jest.restoreAllMocks());
const button = (tree: any, label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const save = (tree: any) => tree.root.findAll((node: any) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function'
  && node.findAll((child: any) => child.props.children === 'settings.saveName').length)[0];
it('centres ten colour-only swatches in an aligned grid and preserves accessible names and selection', async () => {
  let tree: any; await act(async () => { tree = create(<SettingsScreen />); });
  const lime = button(tree, 'settings.accent_lime'); expect(lime.props.accessibilityState.selected).toBe(true);
  const sky = button(tree, 'settings.accent_sky'); expect(sky.props.style.minHeight).toBeGreaterThanOrEqual(44);
  const group = tree.root.findAll((node: any) => node.props.accessibilityRole === 'radiogroup')[0];
  expect(group.props.style).toMatchObject({ width: 308, alignSelf: 'center', justifyContent: 'center', gap: 12 });
  expect(ACCENT_KEYS).toHaveLength(10);
  for (const accent of ACCENT_KEYS) {
    const swatch = button(tree, `settings.accent_${accent}`);
    expect(swatch.props.style).toMatchObject({ width: 52, height: 52, backgroundColor: ACCENTS[accent].fill });
    expect(swatch.findAllByType(Text)).toHaveLength(0);
    expect(swatch.findAllByType(CheckIcon)).toHaveLength(accent === 'lime' ? 1 : 0);
  }
  await act(async () => sky.props.onPress()); expect(mockChange).toHaveBeenCalledWith({ accent: 'sky' });
  mockPreferences = { ...mockPreferences, settings: { ...mockPreferences.settings, accent: 'sky' } };
  await act(async () => tree.update(<SettingsScreen />));
  expect(button(tree, 'settings.accent_sky').findAllByType(CheckIcon)).toHaveLength(1);
  expect(button(tree, 'settings.accent_lime').findAllByType(CheckIcon)).toHaveLength(0);
  mockPreferences = { ...mockPreferences, busy: true }; await act(async () => tree.update(<SettingsScreen />));
  expect(button(tree, 'settings.accent_violet').props.disabled).toBe(true);
  await act(async () => tree.unmount());
});
it.each([280, 320, 375, 390, 430])('fits the centred palette within a %i-point window without shrinking touch targets below 44', async width => {
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 844, scale: 3, fontScale: 1 });
  let tree: any; await act(async () => { tree = create(<SettingsScreen />); });
  const group = tree.root.findAll((node: any) => node.props.accessibilityRole === 'radiogroup')[0];
  const swatch = button(tree, 'settings.accent_slate');
  expect(group.props.style.width).toBeLessThanOrEqual(width - 72);
  expect(swatch.props.style.width).toBeGreaterThanOrEqual(44);
  expect(group.props.style.width).toBe((width >= 316 ? 5 : 3) * swatch.props.style.width + (width >= 316 ? 4 : 2) * group.props.style.gap);
  await act(async () => swatch.props.onPress()); expect(mockChange).toHaveBeenCalledWith({ accent: 'slate' });
  await act(async () => tree.unmount());
});
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
