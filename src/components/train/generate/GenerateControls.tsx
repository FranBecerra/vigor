/**
 * Form controls for the generation screen (PRD §8.8).
 *
 * Local to this flow on purpose: they are the first controls of their kind in the
 * app, and promoting them to a shared library before a second screen needs them
 * would be guessing at the abstraction.
 *
 * Heights are FIXED rather than derived from the text, so a long label in German or
 * a wide Japanese glyph cannot reflow the grid.
 */
import { memo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { useTheme } from '@/theme/useTheme';

/** Fixed control heights. Reserved, never measured from content. */
export const CHIP_HEIGHT = 40;
export const STEPPER_HEIGHT = 52;
const STEPPER_BUTTON = 44;

interface SectionProps {
  title: string;
  hint?: string;
  /** Right-aligned status, e.g. the slot counter. */
  trailing?: string;
  trailingTone?: 'normal' | 'warning';
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Section({
  title,
  hint,
  trailing,
  trailingTone = 'normal',
  children,
  style,
}: SectionProps) {
  const { colors, typography, spacing, semantic } = useTheme();
  return (
    <View style={[{ marginBottom: spacing.xl }, style]}>
      <View style={styles.sectionHeader}>
        <Text style={[typography.title, { color: colors.textPrimary, flex: 1 }]}>{title}</Text>
        {trailing !== undefined && (
          <Text
            style={[
              typography.caption,
              { color: trailingTone === 'warning' ? semantic.warning : colors.textSecondary },
            ]}
          >
            {trailing}
          </Text>
        )}
      </View>
      {hint !== undefined && (
        <Text
          style={[
            typography.caption,
            { color: colors.textMuted, marginBottom: spacing.md, marginTop: spacing.xs },
          ]}
        >
          {hint}
        </Text>
      )}
      {children}
    </View>
  );
}

interface ChipProps {
  label: string;
  /** Secondary line, e.g. the experience hint. Height is reserved either way. */
  sublabel?: string;
  /** Compact value anchored to the lower-right corner. */
  cornerBadge?: string;
  centerLabel?: boolean;
  raised?: boolean;
  selected: boolean;
  disabled?: boolean;
  /** Overrides the selected tint, used by the three-state emphasis control. */
  tint?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  onPress: () => void;
}

/**
 * Selectable pill.
 *
 * Memoised because the emphasis grid renders sixteen of them and a single tap
 * changes the state object they all read from. The parent passes stable callbacks
 * so the memo is not defeated.
 */
export const Chip = memo(function Chip({
  label,
  sublabel,
  cornerBadge,
  centerLabel = false,
  raised = false,
  selected,
  disabled = false,
  tint,
  style,
  accessibilityLabel,
  onPress,
}: ChipProps) {
  const { colors, typography, spacing, radius, sectionAccent } = useTheme();
  const accent = tint ?? sectionAccent.train;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      style={[
        {
          minHeight:
            cornerBadge !== undefined
              ? CHIP_HEIGHT + 22
              : sublabel !== undefined
                ? CHIP_HEIGHT + 14
                : CHIP_HEIGHT,
          justifyContent: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: selected ? accent : colors.surfaceBorder,
          backgroundColor: selected ? `${accent}22` : colors.surface,
          opacity: disabled ? 0.34 : 1,
          ...(raised
            ? {
                shadowColor: '#000000',
                shadowOpacity: selected ? 0.18 : 0.1,
                shadowRadius: selected ? 8 : 5,
                shadowOffset: { width: 0, height: 3 },
                elevation: selected ? 4 : 2,
              }
            : {}),
        },
        style,
      ]}
    >
      <Text
        numberOfLines={centerLabel ? 2 : 1}
        ellipsizeMode="tail"
        style={[
          typography.body,
          {
            color: selected ? accent : colors.textPrimary,
            fontWeight: selected ? '600' : '400',
            textAlign: centerLabel ? 'center' : 'left',
            ...(centerLabel ? { lineHeight: 18 } : {}),
            ...(cornerBadge === undefined ? {} : { paddingHorizontal: spacing.md }),
          },
        ]}
      >
        {label}
      </Text>
      {sublabel !== undefined && (
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}
        >
          {sublabel}
        </Text>
      )}
      {cornerBadge !== undefined && (
        <View
          style={[
            styles.cornerBadge,
            {
              borderColor: selected ? accent : colors.textMuted,
              backgroundColor: selected ? `${accent}1F` : colors.bgElevated,
            },
          ]}
        >
          <Text
            style={[
              styles.cornerBadgeText,
              { color: selected ? accent : colors.textSecondary },
            ]}
          >
            {cornerBadge}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Unit suffix shown after the value. */
  unit?: string;
  onChange: (value: number) => void;
}

/**
 * Numeric stepper.
 *
 * A stepper and not a free text field for these two: session count and minutes both
 * have a narrow sensible range, and a keyboard would cover the live capacity
 * readout that makes the control worth using.
 */
export function Stepper({ label, value, min, max, step = 1, unit, onChange }: StepperProps) {
  const { colors, typography, spacing, radius, sectionAccent } = useTheme();
  const decrement = useCallback(
    () => onChange(Math.max(min, value - step)),
    [onChange, min, value, step],
  );
  const increment = useCallback(
    () => onChange(Math.min(max, value + step)),
    [onChange, max, value, step],
  );
  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <View
      style={{
        height: STEPPER_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        paddingHorizontal: spacing.sm,
      }}
    >
      <Text style={[typography.body, { color: colors.textPrimary, flex: 1, paddingLeft: spacing.sm }]}>
        {label}
      </Text>
      <Pressable
        onPress={decrement}
        disabled={atMin}
        accessibilityRole="button"
        accessibilityLabel={`${label} −`}
        style={[styles.stepperButton, { opacity: atMin ? 0.3 : 1 }]}
      >
        <Text style={[typography.h2, { color: colors.textPrimary }]}>−</Text>
      </Pressable>
      {/* Fixed width so the row does not shift when the value gains a digit. */}
      <View style={styles.stepperValue}>
        <Text style={[typography.title, { color: sectionAccent.train }]}>
          {unit === undefined ? value : `${value}${unit}`}
        </Text>
      </View>
      <Pressable
        onPress={increment}
        disabled={atMax}
        accessibilityRole="button"
        accessibilityLabel={`${label} +`}
        style={[styles.stepperButton, { opacity: atMax ? 0.3 : 1 }]}
      >
        <Text style={[typography.h2, { color: colors.textPrimary }]}>+</Text>
      </Pressable>
    </View>
  );
}

/** Wrapping row of chips. */
export function ChipRow({ children }: { children: React.ReactNode }) {
  const { spacing } = useTheme();
  return <View style={[styles.chipRow, { gap: spacing.sm }]}>{children}</View>;
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  stepperButton: {
    width: STEPPER_BUTTON,
    height: STEPPER_BUTTON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { width: 62, alignItems: 'center' },
  cornerBadge: {
    position: 'absolute',
    right: 7,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerBadgeText: { fontSize: 10, lineHeight: 12, fontWeight: '700' },
});
