import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ExerciseGenerationTier, MuscleGroup, type Exercise } from '@/models';
import { EXERCISE_EQUIPMENT_FILTERS, filterExercisePicker, type ExerciseEquipmentFilter } from '@/services/training/exerciseFilters';
import { criteriaOf } from '@/services/training/exerciseCatalogue';
import { useTheme } from '@/theme/useTheme';
import { CustomExerciseSheet } from '../CustomExerciseSheet';
import { primaryMusclesOf } from '@/services/training/exerciseMuscles';
import { MusclePicture } from '../MusclePicture';
import {
  partitionSwapCandidates,
  searchExercises,
} from '@/services/training/exerciseSearch';

interface ExerciseSwapSheetProps {
  embedded?: boolean;
  open?: boolean;
  mode?: 'swap' | 'add';
  current: Exercise | null;
  candidates: readonly Exercise[];
  onSelect: (exercise: Exercise) => void;
  onSelectMany?: (exercises: Exercise[]) => void;
  onClose: () => void;
}

/** Searchable selector shared conceptually with the in-session swap flow. */
export function ExerciseSwapSheet({
  embedded = false,
  open,
  mode = 'swap',
  current,
  candidates,
  onSelect,
  onSelectMany,
  onClose,
}: ExerciseSwapSheetProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius, sectionAccent } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<ExerciseEquipmentFilter>('ALL');
  const [selected, setSelected] = useState<Exercise[]>([]);
  const multiple = mode === 'add' && !!onSelectMany;
  const select = (exercise: Exercise) => {
    if (!multiple) { onSelect(exercise); return; }
    setSelected((old) => old.some((item) => item.id === exercise.id)
      ? old.filter((item) => item.id !== exercise.id) : [...old, exercise]);
  };

  useEffect(() => {
    if (open ?? current !== null) { setQuery(''); setMuscle(null); setEquipment('ALL'); setCreating(false); setSelected([]); }
  }, [current, open]);

  const visible = useMemo(
    () => searchExercises(query, filterExercisePicker(candidates, muscle, equipment), (muscle) => t(`muscle.${muscle}`)),
    [candidates, query, t, muscle, equipment],
  );
  const groups = useMemo(
    () => current === null
      ? { related: [], other: visible }
      : partitionSwapCandidates(current, visible),
    [current, visible],
  );

  const renderRows = (title: string, exercises: readonly Exercise[]) => {
    if (exercises.length === 0) return null;
    return (
      <View>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
        {exercises.map((exercise) => (
          <Pressable
            key={exercise.id}
            onPress={() => select(exercise)}
            accessibilityRole={multiple ? 'checkbox' : 'button'}
            accessibilityState={multiple ? { checked: selected.some((item) => item.id === exercise.id) } : undefined}
            accessibilityLabel={exercise.name}
            style={[styles.row, { borderBottomColor: colors.surfaceBorder }]}
          >
            <MusclePicture muscle={exercise.primaryMuscle} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.body, { color: colors.textPrimary }]}>
                {exercise.name}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                {(primaryMusclesOf(exercise).length ? primaryMusclesOf(exercise) : [exercise.primaryMuscle]).map((muscle) => t(`muscle.${muscle}`)).join(' · ')} ·{' '}
                {t(`generate.equipment${exercise.equipment}`)}
                {exercise.generationTier === ExerciseGenerationTier.MANUAL_ONLY
                  ? ` · ${t(exercise.isCustom ? 'custom.manualOnly' : 'generate.guideUnscored')}${exercise.guidePage ? ` · p. ${exercise.guidePage}` : ''}`
                  : ''}
              </Text>
              {exercise.criteria && !exercise.isCustom && (
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                  {t('generate.systemicCost')}: {t(
                    criteriaOf(exercise).systemicFatigueCost >= 4
                      ? 'generate.costLow'
                      : criteriaOf(exercise).systemicFatigueCost <= 2
                        ? 'generate.costHigh'
                        : 'generate.costModerate',
                  )}
                </Text>
              )}
            </View>
            <Text style={[typography.title, { color: sectionAccent.train }]}>{multiple ? selected.some((item) => item.id === exercise.id) ? '✓' : '+' : '›'}</Text>
          </Pressable>
        ))}
      </View>
    );
  };

  const content = creating ? <CustomExerciseSheet open embedded initialName={query} onClose={() => setCreating(false)}
    onCreated={(exercise) => { setCreating(false); select(exercise); }} /> : <>
      {!embedded && <Pressable style={styles.backdrop} onPress={onClose} />}
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.bg,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingBottom: insets.bottom + spacing.lg,
            ...(embedded ? { flex: 1, maxHeight: '100%', paddingTop: insets.top + spacing.lg } : {}),
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: colors.surfaceBorder }]} />
        <Text style={[typography.h2, { color: colors.textPrimary }]}>
          {t(mode === 'add' ? 'generate.addExercise' : 'generate.swapTitle')}
        </Text>
        <Pressable onPress={onClose} style={{ paddingVertical: 12 }}><Text style={{ color: sectionAccent.train }}>{t('generate.cancel')}</Text></Pressable>
        <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {current !== null && (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
            {current.name}
          </Text>
        )}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('generate.swapSearch')}
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          style={[
            typography.body,
            styles.search,
            {
              color: colors.textPrimary,
              backgroundColor: colors.surface,
              borderColor: colors.surfaceBorder,
              borderRadius: radius.md,
            },
          ]}
        />
        <Text style={[typography.caption, { color: colors.textMuted }]}>{t('picker.targetMuscle')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, minHeight: 60 }} contentContainerStyle={{ gap: 6, paddingVertical: 8, alignItems: 'center' }}>
          {[null, ...Object.values(MuscleGroup)].map((value) => <Pressable key={value ?? 'ALL'} accessibilityRole="button"
            accessibilityState={{ selected: muscle === value }} onPress={() => setMuscle(value)}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, backgroundColor: muscle === value ? sectionAccent.train : colors.bgElevated }}>
            <Text style={[typography.body, { color: muscle === value ? colors.bg : colors.textPrimary }]}>{t(value === null ? 'picker.ALL' : `muscle.${value}`)}</Text>
          </Pressable>)}
        </ScrollView>
        {multiple && <Pressable disabled={!selected.length} onPress={() => onSelectMany?.(selected)} accessibilityRole="button"
          style={{ padding: 16, marginTop: 8, borderRadius: radius.pill, backgroundColor: selected.length ? sectionAccent.train : colors.surface }}>
          <Text style={{ textAlign: 'center', fontWeight: '700', color: selected.length ? colors.bg : colors.textMuted }}>{t('workout.addSelected', { count: selected.length })}</Text>
        </Pressable>}
        <Text style={[typography.caption, { color: colors.textMuted }]}>{t('picker.equipment')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, minHeight: 60 }} contentContainerStyle={{ gap: 6, paddingVertical: 8, alignItems: 'center' }}>
          {EXERCISE_EQUIPMENT_FILTERS.map((value) => <Pressable key={value} accessibilityRole="button"
            accessibilityState={{ selected: equipment === value }} onPress={() => setEquipment(value)}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, backgroundColor: equipment === value ? sectionAccent.train : colors.bgElevated }}>
            <Text style={[typography.body, { color: equipment === value ? colors.bg : colors.textPrimary }]}>{t(`picker.${value}`)}</Text>
          </Pressable>)}
        </ScrollView>
        {(muscle !== null || equipment !== 'ALL' || query !== '') && <Pressable onPress={() => { setMuscle(null); setEquipment('ALL'); setQuery(''); }}>
          <Text style={{ color: sectionAccent.train, paddingVertical: 8 }}>{t('picker.clear')}</Text>
        </Pressable>}
        <Pressable onPress={() => setCreating(true)} accessibilityRole="button" style={{ paddingVertical: 10 }}>
          <Text style={{ color: sectionAccent.train }}>{t('custom.createInline')}</Text>
        </Pressable>
          {renderRows(t('generate.swapRelated'), groups.related)}
          {renderRows(t('generate.swapOther'), groups.other)}
          {visible.length === 0 && (
            <Text style={[typography.body, { color: colors.textMuted, paddingVertical: spacing.xl }]}>
              {t('generate.swapEmpty')}
            </Text>
          )}
        </ScrollView>
      </View>
    </>;
  if (embedded) return <View style={{ flex: 1, backgroundColor: colors.bg }}>{content}</View>;
  return <Modal visible={open ?? current !== null} transparent animationType="slide" onRequestClose={() => creating ? setCreating(false) : onClose()}>{content}</Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { height: '82%', paddingHorizontal: 18, paddingTop: 10 },
  grabber: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  search: { height: 46, borderWidth: 1, paddingHorizontal: 14, marginVertical: 14 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingTop: 14,
    paddingBottom: 6,
  },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
});
