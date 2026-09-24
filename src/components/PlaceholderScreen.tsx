/**
 * Pantalla placeholder reutilizable (Capa 3), ahora con el tema de Vigor.
 *
 * Consume los tokens de diseño (fondo oscuro/claro auto, tipografía) y admite un
 * acento de sección para el título, reflejando el color-coding del PRD §8.2.
 */
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import type { SectionKey } from '@/theme/tokens';

interface PlaceholderScreenProps {
  title: string;
  subtitle?: string;
  /** Sección a la que pertenece, para teñir el título con su acento. */
  section?: SectionKey;
}

export function PlaceholderScreen({ title, subtitle, section = 'train' }: PlaceholderScreenProps) {
  const { colors, sectionAccent, typography, spacing } = useTheme();
  const accent = sectionAccent[section];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, padding: spacing.xl }]}>
      <Text style={[typography.h1, { color: accent }]}>{title}</Text>
      {subtitle ? (
        <Text
          style={[
            typography.body,
            { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
          ]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
