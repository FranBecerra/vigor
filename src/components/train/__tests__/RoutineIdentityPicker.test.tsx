import React from 'react';
import * as RN from 'react-native';
import { RoutineIdentityPicker } from '../RoutineIdentityPicker';
import { ROUTINE_ICON_ORDER } from '@/models/routine';
import { ACCENT_KEYS, ACCENTS } from '@/theme/accent';
import { accentTokens } from '@/theme/accent';
import { AccentContext } from '@/theme/AccentContext';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
it('selects every emoji while leaving legacy colour untouched and never exposing colour controls', async () => {
  const change = jest.fn(); let tree: any;
  const render = (icon: any = 'barbell', color: string = ACCENTS.slate.fill, disabled = false) => <RoutineIdentityPicker value={{ icon, color }} onChange={change} disabled={disabled} />;
  const button = (label: string) => tree.root.findAll((n: any) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
  await act(async () => { tree = create(render()); });
  expect(new Set(ROUTINE_ICON_ORDER).size).toBe(24);
  expect(button('settings.accent_olive')).toBeUndefined();
  expect(ROUTINE_ICON_ORDER.slice(0, 5)).toEqual(['planet', 'comet', 'moon', 'sun', 'star']);
  expect(tree.root.findByProps({ testID: 'routine-identity-preview' }).props.style.backgroundColor).not.toBe(ACCENTS.slate.fill);
  for (const icon of ROUTINE_ICON_ORDER) {
    await act(async () => button(`routineIdentity.icons.${icon}`).props.onPress());
    expect(change).toHaveBeenLastCalledWith({ icon, color: ACCENTS.slate.fill });
  }
  for (const accent of ACCENT_KEYS) expect(button(`settings.accent_${accent}`)).toBeUndefined();
  expect(tree.root.findAll((n: any) => n.props.accessibilityLabel === 'routineIdentity.color')).toHaveLength(0);
  await act(async () => tree.update(render('mountain', ACCENTS.olive.fill, true)));
  expect(button('routineIdentity.icons.mountain').props.accessibilityState).toEqual({ selected: true, disabled: true });
  expect(button('routineIdentity.icons.mountain').props.disabled).toBe(true);
  await act(async () => tree.unmount());
});

it.each(['dark', 'light'] as const)('follows every app accent live in %s without changing the selected identity', async scheme => {
  const appearance = jest.spyOn(RN, 'useColorScheme').mockReturnValue(scheme);
  const change = jest.fn(); let tree: any;
  for (const accent of ACCENT_KEYS) {
    const view = <AccentContext.Provider value={accent}><RoutineIdentityPicker value={{ icon: 'moon', color: '#FF0000' }} onChange={change} /></AccentContext.Provider>;
    await act(async () => { if (tree) tree.update(view); else tree = create(view); });
    expect(tree.root.findByProps({ testID: 'routine-identity-preview' }).props.style.backgroundColor).toBe(accentTokens(scheme, accent).colors.accentTint);
    const selected = tree.root.findAll((n: any) => n.props.accessibilityRole === 'radio' && n.props.accessibilityLabel === 'routineIdentity.icons.moon')[0];
    expect(selected.props.accessibilityState.selected).toBe(true);
    expect(selected.props.style).toMatchObject({ backgroundColor: accentTokens(scheme, accent).colors.accentTint,
      borderColor: accentTokens(scheme, accent).colors.accentText });
  }
  expect(change).not.toHaveBeenCalled();
  await act(async () => tree.unmount()); appearance.mockRestore();
});

it.each([320, 375, 376, 430, 1024])('keeps complete equal rows at width %i and previews retired keys without offering them', async width => {
  const previous = RN.Dimensions.get('window');
  RN.Dimensions.set({ window: { ...previous, width } });
  let tree: any;
  await act(async () => { tree = create(<RoutineIdentityPicker value={{ icon: 'bodyweight', color: ACCENTS.slate.fill }} onChange={jest.fn()} />); });
  const grid = tree.root.findAll((n: any) => n.props.accessibilityLabel === 'routineIdentity.icon' && n.props.accessibilityRole === 'radiogroup')[0];
  const columns = (grid.props.style.width + 8) / 56;
  expect([4, 6]).toContain(columns);
  expect(ROUTINE_ICON_ORDER.length % columns).toBe(0);
  expect(columns).toBe(width >= 376 ? 6 : 4);
  expect(tree.root.findAll((n: any) => n.props.accessibilityLabel === 'routineIdentity.icons.bodyweight')).toHaveLength(0);
  await act(async () => tree.unmount()); RN.Dimensions.set({ window: previous });
});
