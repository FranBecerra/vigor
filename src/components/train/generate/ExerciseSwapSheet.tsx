import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { measureNextFrame } from '@/hooks/useMeasuredCommit';
import { uiPerformance } from '@/services/performance/uiPerformance';

interface ExerciseSwapSheetProps {
  embedded?: boolean;
  open?: boolean;
  mode?: 'swap' | 'add';
  current: Exercise | null;
  candidates: readonly Exercise[];
  onSelect: (exercise: Exercise) => void;
  onSelectMany?: (exercises: Exercise[]) => void;
  onClose: () => void;
  /** Native benchmark callback; omitted in ordinary UI. */
  onPresented?: () => void;
}

/** Searchable selector shared conceptually with the in-session swap flow. */
function ExercisePickerContent({
  embedded = false,
  open,
  mode = 'swap',
  current,
  candidates,
  onSelect,
  onSelectMany,
  onClose,
  onPresented,
}: ExerciseSwapSheetProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius, sectionAccent } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [showMuscles, setShowMuscles] = useState(false);
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
    () => searchExercises(deferredQuery, filterExercisePicker(candidates, muscle, equipment), (muscle) => t(`muscle.${muscle}`)),
    [candidates, deferredQuery, t, muscle, equipment],
  );
  const groups = useMemo(
    () => current === null
      ? { related: [], other: visible }
      : partitionSwapCandidates(current, visible),
    [current, visible],
  );
  const sections = useMemo(() => [
    { title: t('generate.swapRelated'), data: groups.related },
    { title: t('generate.swapOther'), data: groups.other },
  ].filter((group) => group.data.length), [groups, t]);

  const renderRows = (title: string, exercises: readonly Exercise[]) => {
    if (exercises.length === 0) return null;
    return (
      <View>
        {!!title && <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>}
        {exercises.map((exercise) => (
          <Pressable
            key={exercise.id}
            onPress={() => select(exercise)}
            accessibilityRole={multiple ? 'checkbox' : 'button'}
            accessibilityState={multiple ? { checked: selected.some((item) => item.id === exercise.id) } : undefined}
            accessibilityLabel={exercise.name}
            style={[styles.row, { borderBottomColor: colors.surfaceBorder }]}
          >
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
        <SectionList style={{ flex: 1 }} sections={sections} extraData={selected} keyExtractor={(exercise) => exercise.id}
          initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5} stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
          renderSectionHeader={({ section }) => <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{section.title}</Text>}
          renderItem={({ item }) => renderRows('', [item])}
          ListEmptyComponent={<Text style={[typography.body, { color: colors.textMuted, paddingVertical: spacing.xl }]}>{t('generate.swapEmpty')}</Text>}
          ListHeaderComponent={<View>
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
        <Pressable accessibilityRole="button" accessibilityLabel={t('picker.targetMuscle')} accessibilityState={{ expanded: showMuscles }}
          onPress={() => setShowMuscles((old) => !old)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
          {muscle && <MusclePicture muscle={muscle} />}
          <View style={{ flex: 1 }}><Text style={[typography.caption, { color: colors.textMuted }]}>{t('picker.targetMuscle')}</Text>
            <Text style={[typography.title, { color: colors.textPrimary }]}>{t(muscle ? `muscle.${muscle}` : 'picker.ALL')}</Text></View>
          <Text style={{ color: sectionAccent.train }}>{showMuscles ? '⌃' : '⌄'}</Text>
        </Pressable>
        {showMuscles && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 118, flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
          {[null, ...Object.values(MuscleGroup)].map((value) => <Pressable key={value ?? 'ALL'} accessibilityRole="button"
            accessibilityLabel={t(value === null ? 'picker.ALL' : `muscle.${value}`)} accessibilityState={{ selected: muscle === value }} onPress={() => { setMuscle(value); setShowMuscles(false); }}
            style={{ width: 94, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 8, borderWidth: 1,
              borderColor: muscle === value ? sectionAccent.train : colors.surfaceBorder, borderRadius: radius.md, backgroundColor: colors.bgElevated }}>
            {value ? <MusclePicture muscle={value} /> : <Text style={{ fontSize: 26, color: colors.textSecondary }}>◎</Text>}
            <Text numberOfLines={2} style={[typography.caption, { textAlign: 'center', color: muscle === value ? sectionAccent.train : colors.textPrimary }]}>{t(value === null ? 'picker.ALL' : `muscle.${value}`)}</Text>
          </Pressable>)}
        </ScrollView>}
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
        </View>} />
        {multiple && <Pressable disabled={!selected.length} onPress={() => onSelectMany?.(selected)} accessibilityRole="button"
          style={{ padding: 16, marginTop: 8, borderRadius: radius.pill, backgroundColor: selected.length ? sectionAccent.train : colors.surface }}>
          <Text style={{ textAlign: 'center', fontWeight: '700', color: selected.length ? colors.bg : colors.textMuted }}>{t('workout.addSelected', { count: selected.length })}</Text>
        </Pressable>}
      </View>
    </>;
  if (embedded) return <View style={{ flex: 1, backgroundColor: colors.bg }}>{content}</View>;
  return <Modal visible transparent animationType="none" onShow={() => {
    if (onPresented || uiPerformance.enabled) measureNextFrame('picker.ready', onPresented);
  }} onRequestClose={() => creating ? setCreating(false) : onClose()}>{content}</Modal>;
}

/** Closed selectors mount no catalogue rows or body illustrations. */
export function ExerciseSwapSheet(props: ExerciseSwapSheetProps) {
  if (!(props.open ?? props.current !== null)) return null;
  return <ExercisePickerContent key={props.current?.id ?? 'add'} {...props} />;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { height: '92%', paddingHorizontal: 18, paddingTop: 10 },
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
