/**
 * Piezas superiores de la pantalla Inicio/Hoy (PRD §8.5).
 *
 * `DomainPills` — alterna Fuerza / Cardio.
 * `MesoRail`    — raíl de progreso del mesociclo, pulsable para abrir su vista.
 */
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import type { TrainingDomain, MockMicrocycle } from '@/mocks/home';

/** Opacidad de los microciclos PROYECTADOS (aún no ocurridos). */
const PROJECTED_OPACITY = 0.3;
/** Opacidad de los microciclos ya completados. */
const COMPLETED_OPACITY = 0.55;

interface DomainPillsProps {
  value: TrainingDomain;
  onChange: (domain: TrainingDomain) => void;
  labels: { strength: string; cardio: string };
}

export function DomainPills({ value, onChange, labels }: DomainPillsProps) {
  const { colors, sectionAccent, radius } = useTheme();
  const options: { key: TrainingDomain; label: string }[] = [
    { key: 'STRENGTH', label: labels.strength },
    { key: 'CARDIO', label: labels.cardio },
  ];

  return (
    <View style={styles.pillRow}>
      {options.map((option) => {
        const isActive = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            style={[
              styles.pill,
              {
                borderRadius: radius.pill,
                backgroundColor: isActive ? sectionAccent.train : colors.surface,
              },
            ]}>
            <Text
              style={[
                styles.pillLabel,
                { color: isActive ? '#16191C' : colors.textSecondary },
              ]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface MesoRailProps {
  microcycles: readonly MockMicrocycle[];
  currentIndex: number;
  /** Texto de contexto bajo el raíl, p. ej. "Microciclo 3 de 6". */
  caption: string;
  /** Etiqueta de la acción, p. ej. "Ver mesociclo". */
  actionLabel: string;
  onPress: () => void;
}

/**
 * Raíl del mesociclo. Todos los segmentos miden IGUAL, porque todos los
 * microciclos tienen el mismo número de sesiones (§3.1): no hay duración
 * variable que representar.
 *
 * La proyección se distingue por OPACIDAD, no por líneas punteadas: completados
 * atenuados, el actual a plena intensidad, y los futuros translúcidos.
 */
export function MesoRail({
  microcycles,
  currentIndex,
  caption,
  actionLabel,
  onPress,
}: MesoRailProps) {
  const { colors, sectionAccent, semantic, radius } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={actionLabel}
      style={[styles.rail, { backgroundColor: colors.surface, borderRadius: radius.md }]}>
      <View style={styles.railSegments}>
        {microcycles.map((micro, index) => {
          const isCurrent = index === currentIndex;
          const color = micro.isDeload ? semantic.deload : sectionAccent.train;
          const opacity = micro.isProjected
            ? PROJECTED_OPACITY
            : isCurrent
              ? 1
              : COMPLETED_OPACITY;
          return (
            <View
              key={micro.id}
              style={[styles.railSegment, { backgroundColor: color, opacity }]}
            />
          );
        })}
      </View>

      <View style={styles.railFooter}>
        <Text style={[styles.railCaption, { color: colors.textSecondary }]}>{caption}</Text>
        <Text style={[styles.railAction, { color: sectionAccent.train }]}>{actionLabel} ›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: { flex: 1, paddingVertical: 9, alignItems: 'center' },
  pillLabel: { fontSize: 13, fontWeight: '700' },

  rail: { padding: 11 },
  railSegments: { flexDirection: 'row', gap: 4, marginBottom: 9 },
  railSegment: { flex: 1, height: 6, borderRadius: 3 },
  railFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  railCaption: { fontSize: 10, letterSpacing: 0.4 },
  railAction: { fontSize: 10, fontWeight: '700' },
});
