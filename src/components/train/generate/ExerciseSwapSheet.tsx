import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Alert, Modal, Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { useExerciseName } from '@/hooks/useExerciseName';
import { useOptionalExerciseCatalogue } from '@/hooks/useExerciseCatalogue';

interface ExerciseSwapSheetProps {
  embedded?: boolean;
  open?: boolean;
  mode?: 'swap' | 'add' | 'browse';
  current: Exercise | null;
  candidates: readonly Exercise[];
  onSelect: (exercise: Exercise) => void;
  onSelectMany?: (exercises: Exercise[]) => void;
  onClose: () => void;
  /** Native benchmark callback; omitted in ordinary UI. */
  onPresented?: () => void;
  catalogueStatus?: 'loading' | 'error';
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
  catalogueStatus,
}: ExerciseSwapSheetProps) {
  const { t } = useTranslation();
  const name = useExerciseName();
  const exercisePreferences = useOptionalExerciseCatalogue();
  const notRecommendedExerciseIds = exercisePreferences?.notRecommendedExerciseIds ?? new Set<string>();
  const setExerciseNotRecommended = exercisePreferences?.setExerciseNotRecommended;
  const preferencesReady = exercisePreferences?.preferencesReady ?? true;
  const { colors, typography, spacing, radius, sectionAccent } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [showMuscles, setShowMuscles] = useState(false);
  const [creating, setCreating] = useState(false);
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<ExerciseEquipmentFilter>('ALL');
  const [selected, setSelected] = useState<Exercise[]>([]);
  const [mineOnly, setMineOnly] = useState(false);
  const y = useSharedValue(embedded ? 0 : 900);
  const closing = useRef(false);
  const latest = useRef({ onClose, onPresented }); latest.current = { onClose, onPresented };
  const finishClose = () => latest.current.onClose();
  const reportReady = () => {
    if (latest.current.onPresented || uiPerformance.enabled) measureNextFrame('picker.ready', latest.current.onPresented);
  };
  const present = () => {
    if (embedded || closing.current) return;
    y.value = withTiming(0, { duration: 180 }, (done) => { if (done) runOnJS(reportReady)(); });
  };
  const close = () => {
    if (embedded) { onClose(); return; }
    if (closing.current) return;
    closing.current = true;
    y.value = withTiming(900, { duration: 160 }, (done) => { if (done) runOnJS(finishClose)(); });
  };
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const dismiss = Gesture.Pan().activeOffsetY(8).failOffsetX([-25, 25])
    .onUpdate((event) => { y.value = Math.max(0, event.translationY); })
    .onEnd((event) => { if (event.translationY > 72 || event.velocityY > 750) runOnJS(close)();
      else y.value = withTiming(0, { duration: 160 }); })
    .onFinalize((_event, success) => { if (!success) y.value = withTiming(0, { duration: 160 }); });
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
    () => searchExercises(deferredQuery, filterExercisePicker(mineOnly ? candidates.filter((exercise) => exercise.isCustom || exercise.isPersonalized) : candidates, muscle, equipment), (muscle) => t(`muscle.${muscle}`)),
    [candidates, deferredQuery, t, muscle, equipment, mineOnly],
  );
  const groups = useMemo(
    () => current === null
      ? { related: [], other: visible }
      : partitionSwapCandidates(current, visible),
    [current, visible],
  );
  const sections = useMemo(() => [
    { title: t('generate.swapRelated'), data: groups.related },
    { title: mode === 'browse' ? '' : t('generate.swapOther'), data: groups.other },
  ].filter((group) => group.data.length), [groups, t, mode]);

  const renderRows = (title: string, exercises: readonly Exercise[]) => {
    if (exercises.length === 0) return null;
    return (
      <View>
        {!!title && <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>}
        {exercises.map((exercise) => {
          const vetoed = notRecommendedExerciseIds.has(exercise.id);
          return <View key={exercise.id} style={[styles.row, { borderBottomColor: colors.surfaceBorder }]}>
            <Pressable onPress={() => select(exercise)} accessibilityRole={multiple ? 'checkbox' : 'button'}
              accessibilityState={multiple ? { checked: selected.some((item) => item.id === exercise.id) } : undefined}
              accessibilityLabel={name(exercise)} style={{ flex: 1, minHeight: 62, justifyContent: 'center', paddingVertical: 8 }}>
              <Text style={[typography.body, { color: colors.textPrimary }]}>{name(exercise)}</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                {(primaryMusclesOf(exercise).length ? primaryMusclesOf(exercise) : [exercise.primaryMuscle]).map((muscle) => t(`muscle.${muscle}`)).join(' · ')} ·{' '}
                {t(`generate.equipment${exercise.equipment}`)}
                {mode !== 'browse' && exercise.generationTier === ExerciseGenerationTier.MANUAL_ONLY
                  ? ` · ${t(exercise.isCustom ? 'custom.manualOnly' : 'generate.guideUnscored')}${exercise.guidePage ? ` · p. ${exercise.guidePage}` : ''}` : ''}
              </Text>
              {mode !== 'browse' && exercise.criteria && !exercise.isCustom && (
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                  {t('generate.systemicCost')}: {t(criteriaOf(exercise).systemicFatigueCost >= 4
                    ? 'generate.costLow' : criteriaOf(exercise).systemicFatigueCost <= 2 ? 'generate.costHigh' : 'generate.costModerate')}
                </Text>
              )}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t(vetoed ? 'exercisePreference.recommend' : 'exercisePreference.notRecommend')}
              accessibilityState={{ disabled: !preferencesReady }} disabled={!preferencesReady || !setExerciseNotRecommended}
              onPress={() => { void setExerciseNotRecommended?.(exercise.id, !vetoed).catch(() => Alert.alert(t('exercisePreference.saveFailed'))); }}
              style={[styles.preferenceAction, { borderColor: vetoed ? sectionAccent.train : colors.surfaceBorder }]}>
              <Text numberOfLines={1} style={[typography.caption, { color: vetoed ? colors.accentText : colors.textSecondary }]}>
                {vetoed ? `✓ ${t('exercisePreference.notRecommendedShort')}` : t('exercisePreference.notRecommendShort')}
              </Text>
            </Pressable>
            <Text style={[typography.title, { color: colors.accentText, paddingLeft: 8 }]}>{multiple ? selected.some((item) => item.id === exercise.id) ? '✓' : '+' : '›'}</Text>
          </View>;
        })}
      </View>
    );
  };

  const content = creating ? <CustomExerciseSheet open embedded initialName={query} onClose={() => setCreating(false)}
    onCreated={(exercise) => { setCreating(false); select(exercise); }} /> : <>
      {!embedded && <Pressable style={styles.backdrop} onPress={close} />}
      <Animated.View
        style={[
          styles.sheet,
          sheetStyle,
          {
            backgroundColor: colors.bg,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingBottom: insets.bottom + spacing.lg,
            ...(embedded ? { flex: 1, maxHeight: '100%', paddingTop: insets.top + spacing.lg } : {}),
          },
        ]}
      >
        <GestureDetector gesture={dismiss}><View accessible accessibilityRole="button" accessibilityLabel={t('generate.closePicker')}
          onAccessibilityTap={close} style={{ minHeight: 44, justifyContent: 'center' }}>
          <View style={[styles.grabber, { backgroundColor: colors.surfaceBorder }]} />
        </View></GestureDetector>
        <Text style={[typography.h2, { color: colors.textPrimary }]}>
          {t(mode === 'browse' ? 'library.title' : mode === 'add' ? 'generate.addExercise' : 'generate.swapTitle')}
        </Text>
        <Pressable accessibilityRole="button" onPress={close} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[typography.body, { color: colors.accentText }]}>{t(mode === 'browse' ? 'generate.back' : 'generate.cancel')}</Text></Pressable>
        <SectionList style={{ flex: 1 }} sections={sections} extraData={selected} keyExtractor={(exercise) => exercise.id}
          initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5} stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
          renderSectionHeader={({ section }) => section.title ? <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{section.title}</Text> : null}
          renderItem={({ item }) => renderRows('', [item])}
          ListEmptyComponent={<Text style={[typography.body, { color: colors.textMuted, paddingVertical: spacing.xl }]}>{t('generate.swapEmpty')}</Text>}
          ListHeaderComponent={<View>
        {catalogueStatus && <Text accessibilityRole={catalogueStatus === 'error' ? 'alert' : undefined} style={[typography.body, { color: colors.textSecondary }]}>{t(catalogueStatus === 'error' ? 'custom.saveFailed' : 'custom.loading')}</Text>}
        {current !== null && (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
            {name(current)}
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
        <Pressable accessibilityRole="checkbox" accessibilityLabel={t('custom.library')} accessibilityState={{ checked: mineOnly }} onPress={() => setMineOnly(!mineOnly)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8 }}>
          <View style={{ width: 26, height: 26, borderRadius: 7, borderWidth: 1.5, borderColor: colors.textSecondary,
            backgroundColor: mineOnly ? sectionAccent.train : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {mineOnly && <Text style={{ color: '#16191C', fontWeight: '800', fontSize: 18 }}>✓</Text>}
          </View>
          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '600' }}>{t('custom.library')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('picker.targetMuscle')} accessibilityState={{ expanded: showMuscles }}
          onPress={() => setShowMuscles((old) => !old)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
          {muscle && <MusclePicture muscle={muscle} />}
          <View style={{ flex: 1 }}><Text style={[typography.caption, { color: colors.textMuted }]}>{t('picker.targetMuscle')}</Text>
            <Text style={[typography.title, { color: colors.textPrimary }]}>{t(muscle ? `muscle.${muscle}` : 'picker.ALL')}</Text></View>
          <Text style={{ color: colors.accentText }}>{showMuscles ? '⌃' : '⌄'}</Text>
        </Pressable>
        {showMuscles && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 118, flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
          {[null, ...Object.values(MuscleGroup)].map((value) => <Pressable key={value ?? 'ALL'} accessibilityRole="button"
            accessibilityLabel={t(value === null ? 'picker.ALL' : `muscle.${value}`)} accessibilityState={{ selected: muscle === value }} onPress={() => { setMuscle(value); setShowMuscles(false); }}
            style={{ width: 94, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 8, borderWidth: 1,
              borderColor: muscle === value ? sectionAccent.train : colors.surfaceBorder, borderRadius: radius.md, backgroundColor: colors.bgElevated }}>
            {value ? <MusclePicture muscle={value} /> : <Text style={{ fontSize: 26, color: colors.textSecondary }}>◎</Text>}
            <Text numberOfLines={2} style={[typography.caption, { textAlign: 'center', color: muscle === value ? colors.accentText : colors.textPrimary }]}>{t(value === null ? 'picker.ALL' : `muscle.${value}`)}</Text>
          </Pressable>)}
        </ScrollView>}
        <Text style={[typography.caption, { color: colors.textMuted }]}>{t('picker.equipment')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, minHeight: 60 }} contentContainerStyle={{ gap: 6, paddingVertical: 8, alignItems: 'center' }}>
          {EXERCISE_EQUIPMENT_FILTERS.map((value) => <Pressable key={value} accessibilityRole="button"
            accessibilityState={{ selected: equipment === value }} onPress={() => setEquipment(value)}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, backgroundColor: equipment === value ? sectionAccent.train : colors.bgElevated }}>
            <Text style={[typography.body, { color: equipment === value ? colors.onAccent : colors.textPrimary }]}>{t(`picker.${value}`)}</Text>
          </Pressable>)}
        </ScrollView>
        {(muscle !== null || equipment !== 'ALL' || query !== '' || mineOnly) && <Pressable onPress={() => { setMuscle(null); setEquipment('ALL'); setQuery(''); setMineOnly(false); }}>
          <Text style={{ color: colors.accentText, paddingVertical: 8 }}>{t('picker.clear')}</Text>
        </Pressable>}
        <Pressable onPress={() => setCreating(true)} accessibilityRole="button" style={{ paddingVertical: 10 }}>
          <Text style={{ color: colors.accentText }}>{t('custom.createInline')}</Text>
        </Pressable>
        </View>} />
        {multiple && <Pressable disabled={!selected.length} onPress={() => onSelectMany?.(selected)} accessibilityRole="button"
          style={{ padding: 16, marginTop: 8, borderRadius: radius.pill, backgroundColor: selected.length ? sectionAccent.train : colors.surface }}>
          <Text style={{ textAlign: 'center', fontWeight: '700', color: selected.length ? colors.onAccent : colors.textMuted }}>{t('workout.addSelected', { count: selected.length })}</Text>
        </Pressable>}
      </Animated.View>
    </>;
  if (embedded) return <View style={{ flex: 1, backgroundColor: colors.bg }}>{content}</View>;
  return <Modal visible transparent animationType="none" onShow={present} onRequestClose={() => creating ? setCreating(false) : close()}>{content}</Modal>;
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
  preferenceAction: { maxWidth: 122, minHeight: 38, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderRadius: 14 },
});
