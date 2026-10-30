import React from 'react';
import * as RN from 'react-native';
import { AccentContext } from '@/theme/AccentContext';
import { ACCENT_KEYS, accentTokens } from '@/theme/accent';
import { BioMetricTrend, useMetricMaterial } from '../BioMetricVisual';
const { act, create } = require('react-test-renderer');
it.each(['dark', 'light'] as const)('uses all selected accents in overview and trend in %s, preserving warning colours', async scheme => {
  jest.spyOn(RN, 'useColorScheme').mockReturnValue(scheme);
  let m!: ReturnType<typeof useMetricMaterial>, tree: any;
  function Probe() { m = useMetricMaterial(); return <BioMetricTrend view={{ position: 'BELOW', days: [] }} label="Trend" />; }
  try {
    for (const accent of ACCENT_KEYS) {
      await act(async () => { if (!tree) tree = create(<AccentContext.Provider value={accent}><Probe /></AccentContext.Provider>);
        else tree.update(<AccentContext.Provider value={accent}><Probe /></AccentContext.Provider>); });
      const { colors } = accentTokens(scheme, accent);
      expect(m.range).toBe(colors.accentText); expect(m.rangeEnd).toBe(colors.accentTint);
      expect(m.end).toBe(colors.accentTint); expect(m.surface).toBe(colors.surface);
      expect(m.amber).toBe(scheme === 'dark' ? '#F2CA7F' : '#805000');
    }
    await act(async () => tree.unmount());
  } finally { jest.restoreAllMocks(); }
});
