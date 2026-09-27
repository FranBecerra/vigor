/**
 * Layout de las pestañas inferiores (PRD §8.1, §8.2).
 *
 * Estética copiada de Bevel:
 *  - Cápsula **flotante** con márgenes laterales (no pegada a los bordes).
 *  - Material Liquid Glass de fondo.
 *  - La pestaña activa NO se distingue por color, sino por una **pastilla de
 *    cristal más clara encima**, con su borde visible (efecto de refracción).
 *  - Etiquetas del mismo color en todas: la selección la comunica el cristal.
 *
 * Los iconos llegarán como SVG vectoriales custom (§8.5).
 */
import type { ReactNode } from 'react';
import { Pressable, View, StyleSheet, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassSurface } from '@/components/GlassSurface';
import { TrainIcon, BioIcon, NutritionIcon, ProfileIcon } from '@/components/icons';
import { useTheme } from '@/theme/useTheme';
import {
  FLOATING_TAB_BAR_HEIGHT,
  floatingTabBarBottom,
} from '@/components/navigation/tabBarMetrics';

/** Margen lateral: cuanto mayor, más estrecha queda la cápsula flotante. */
const BAR_MARGIN = 54;

interface GlassTabButtonProps {
  focused: boolean;
  children?: ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
}

/** Pestaña con pastilla de CRISTAL encima cuando está seleccionada. */
function GlassTabButton({
  focused,
  children,
  onPress,
  onLongPress,
  accessibilityLabel,
}: GlassTabButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel}
      style={styles.tabButton}>
      {focused ? (
        <GlassSurface glassEffectStyle="clear" style={styles.pill}>
          <View style={styles.pillRim} />
        </GlassSurface>
      ) : null}
      <View style={styles.tabContent}>{children}</View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  // Ancho calculado en PUNTOS: los porcentajes los estiraba el navegador y la
  // cápsula acababa ocupando todo el ancho.
  const barWidth = Math.round(screenWidth * 0.76);
  const barLeft = Math.round((screenWidth - barWidth) / 2);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Mismo color en activa e inactiva: la selección la marca el cristal.
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarStyle: {
          position: 'absolute',
          // BottomTabBar defines logical `start: 0` and `end: 0`. Using physical
          // left/right here does not override those defaults on iOS, which kept
          // the correctly sized capsule pinned to the leading edge.
          start: barLeft,
          end: undefined,
          left: undefined,
          width: barWidth,
          right: undefined,
          bottom: floatingTabBarBottom(insets.bottom),
          height: FLOATING_TAB_BAR_HEIGHT,
          borderRadius: radius.pill,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          overflow: 'hidden',
          paddingBottom: 0,
          paddingHorizontal: 6,
        },
        tabBarBackground: () => (
          <GlassSurface
            glassEffectStyle="regular"
            style={[StyleSheet.absoluteFill, { borderRadius: radius.pill, overflow: 'hidden' }]}
          />
        ),
        tabBarButton: (props) => (
          <GlassTabButton
            focused={props.accessibilityState?.selected ?? false}
            onPress={props.onPress}
            onLongPress={props.onLongPress ?? undefined}
            accessibilityLabel={props.accessibilityLabel}>
            {props.children}
          </GlassTabButton>
        ),
      }}>
      <Tabs.Screen
        name="(train)"
        options={{
          title: t('tabs.train'),
          tabBarIcon: ({ color }) => <TrainIcon size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bio"
        options={{
          title: t('tabs.bio'),
          tabBarIcon: ({ color }) => <BioIcon size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: t('tabs.nutrition'),
          tabBarIcon: ({ color }) => <NutritionIcon size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => <ProfileIcon size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: FLOATING_TAB_BAR_HEIGHT,
  },
  /** Pastilla de cristal sobre la pestaña activa. */
  pill: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 4,
    right: 4,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  /** Borde sutil que da el efecto de canto de cristal. */
  pillRim: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  tabContent: { alignItems: 'center', justifyContent: 'center' },
});
