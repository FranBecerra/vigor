import { Platform, type ViewStyle } from 'react-native';
import { BRAND_LIME, palette, type ColorScheme } from './tokens';

/** Static native gradients: no additional views, timers, images or blur per row. */
function gradient(image: string, platform: string): ViewStyle {
  return platform === 'web'
    ? { backgroundImage: image } as ViewStyle
    : { experimental_backgroundImage: image };
}

export function createSurfaceStyles(scheme: ColorScheme, platform = Platform.OS) {
  const c = palette[scheme];
  const outline = `inset 0 0 0 1px ${c.surfaceBorder}`;
  return {
    screen: {
      backgroundColor: c.bg,
      ...gradient(`radial-gradient(ellipse at 90% 0%, ${c.ambient} 0%, ${c.ambientClear} 65%)`, platform),
    },
    card: {
      backgroundColor: c.bgElevated,
      borderCurve: 'continuous',
      boxShadow: `0 6px 18px ${c.shadow}, ${outline}, inset 0 1px 0 ${c.highlight}`,
      ...gradient(`linear-gradient(145deg, ${c.ambient}, ${c.ambientClear} 65%)`, platform),
    },
    hero: {
      backgroundColor: c.bgElevated,
      borderCurve: 'continuous',
      boxShadow: `0 8px 22px ${c.shadow}, ${outline}, inset 0 1px 0 ${c.highlight}`,
      ...gradient(`radial-gradient(ellipse at 95% 0%, ${c.ambient} 0%, ${c.ambientClear} 85%)`, platform),
    },
    bio: {
      backgroundColor: c.bgElevated,
      borderCurve: 'continuous',
      boxShadow: `0 6px 18px ${c.shadow}, ${outline}`,
      ...gradient(`linear-gradient(145deg, ${c.bioTint}, ${c.bgElevated} 75%)`, platform),
    },
    sheet: {
      backgroundColor: c.bgElevated,
      borderCurve: 'continuous',
      boxShadow: `0 -6px 24px ${c.shadow}, inset 0 1px 0 ${c.highlight}`,
    },
    field: {
      backgroundColor: c.surface,
      borderCurve: 'continuous',
      boxShadow: `inset 0 1px 0 ${c.highlight}`,
    },
    selected: { backgroundColor: c.accentTint },
    primary: {
      backgroundColor: BRAND_LIME,
      borderCurve: 'continuous',
      boxShadow: `0 4px 12px ${c.shadow}, inset 0 1px 0 ${c.highlight}`,
    },
  } satisfies Record<string, ViewStyle>;
}

/** Reused by every consumer; changing a set must not allocate theme gradients. */
export const surfaces = { dark: createSurfaceStyles('dark'), light: createSurfaceStyles('light') };
