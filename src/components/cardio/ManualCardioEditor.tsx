import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { CardioPlanningModality } from '@/models/cardio';
import { CycleChevron } from '@/components/icons/CycleReviewIcons';
import { Stepper } from '@/components/train/generate/GenerateControls';
import { useTheme } from '@/theme/useTheme';
import { CARDIO_MODALITIES, cardioPreviewIssue, type CardioPreviewInput, type CardioStrengthPlacement } from '@/services/cardio/cardioPreview';
import type { HybridAvailability } from '@/services/cardio/hybridAvailability';
import { MANUAL_PHASES, validManualTargets, type ManualCardioSession, type ManualCardioTargets, type ManualPhase } from '@/services/cardio/manualCardio';
import { manualTargetLabels } from './manualCardioLabels';

type Field = 'minutes' | 'distance' | 'fast' | 'slow' | 'zone';
type DraftTargets = Partial<Record<Field, string>>;
interface DraftSession {
  id: number;
  modality: CardioPlanningModality;
  dayIndex: number;
  phases: Partial<Record<ManualPhase, DraftTargets>>;
  estimate: string;
}

function nextManualDay(cycleDays: number, cardioDays: readonly number[], strength: readonly CardioStrengthPlacement[], availability?: HybridAvailability) {
  const strengthDays = new Set(strength.flatMap(session => session.dayIndex === undefined ? [] : [session.dayIndex]));
  const activeDays = new Set([...strengthDays, ...cardioDays]);
  const hasRoomForNewDay = activeDays.size < (availability?.trainingDays ?? cycleDays);
  const days = Array.from({ length: cycleDays }, (_, day) => day).filter(day => !cardioDays.includes(day));
  return (hasRoomForNewDay ? days.find(day => !strengthDays.has(day)) : undefined)
    ?? (availability?.allowDoubles ? days.find(day => strengthDays.has(day)) : undefined);
}

const blankSession = (id: number, dayIndex: number): DraftSession => ({ id, dayIndex, modality: 'RUNNING', phases: {}, estimate: '' });
const decimal = (value?: string) => !value?.trim() ? undefined
  : /^\d+(?:[.,]\d+)?$/.test(value.trim()) ? Number(value.replace(',', '.')) : NaN;
const parsePace = (value?: string) => {
  const match = value?.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
};
function parseTargets(fields: DraftTargets, modality: CardioPlanningModality): ManualCardioTargets | null {
  const duration = decimal(fields.minutes), distance = decimal(fields.distance), zone = decimal(fields.zone);
  const target: ManualCardioTargets = {
    ...(duration === undefined ? {} : { durationSeconds: Math.round(duration * 60) }),
    ...(distance === undefined || modality === 'MACHINE' ? {} : { distanceMetres: Math.round(distance * 1000) }),
    ...(modality === 'RUNNING' && (fields.fast?.trim() || fields.slow?.trim())
      ? { paceSecondsPerKm: { fast: parsePace(fields.fast), slow: parsePace(fields.slow) } } : {}),
    ...(zone === undefined ? {} : { heartRateZone: zone }),
  };
  return Object.keys(target).length ? target : null;
}

interface Props {
  availability?: HybridAvailability;
  strength?: CardioStrengthPlacement[];
  name?: string;
  progress?: ReactNode;
  onBack: () => void;
  onCancel: () => void;
  onReview: (input: CardioPreviewInput, name: string) => void;
}

export function ManualCardioEditor({ availability, strength = [], name, progress, onBack, onCancel, onReview }: Props) {
  const { t } = useTranslation(), { colors, surfaces, radius, semantic } = useTheme(), insets = useSafeAreaInsets();
  const cycleDays = availability?.cycleDays ?? 7;
  const [title, setTitle] = useState('');
  const [drafts, setDrafts] = useState(() => [blankSession(1, nextManualDay(cycleDays, [], strength, availability) ?? 0)]);
  const [selected, setSelected] = useState(1);
  const [expanded, setExpanded] = useState<ManualPhase | null>('MAIN');
  const [error, setError] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const draft = drafts.find(s => s.id === selected)!;
  const days = Array.from({ length: cycleDays }, (_, day) => day);
  const edit = (patch: Partial<DraftSession>) => {
    setError(false);
    setDrafts(old => old.map(s => s.id === selected ? { ...s, ...patch } : s));
  };
  const targets = useMemo(() => Object.fromEntries(MANUAL_PHASES.map(phase => [phase, parseTargets(draft.phases[phase] ?? {}, draft.modality)])), [draft]);
  const labelStyle = { color: colors.textPrimary, fontSize: 15 };
  const caption = { color: colors.textSecondary, fontSize: 13, lineHeight: 19 };
  const card = { ...surfaces.card, borderRadius: radius.lg, paddingHorizontal: 15, paddingVertical: 11 };
  const row = { minHeight: 48, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 12 };
  const input = (label: string, value: string | undefined, onChange: (next: string) => void, placeholder: string, keyboard: 'default' | 'decimal-pad' | 'number-pad') =>
    <TextInput accessibilityLabel={label} value={value ?? ''} onChangeText={onChange} keyboardType={keyboard} placeholder={placeholder}
      placeholderTextColor={colors.textSecondary} maxLength={12} style={{ ...surfaces.field, borderRadius: radius.sm, minHeight: 44,
        minWidth: 86, paddingHorizontal: 10, textAlign: 'center', color: colors.textPrimary }} />;
  const field = (phase: ManualPhase, key: Field, placeholder: string, keyboard: 'default' | 'decimal-pad' | 'number-pad') => {
    const label = t(`manualCardio.${key}`);
    return <View style={row} key={key}><Text style={[labelStyle, { flex: 1 }]}>{label}</Text>
      {input(`${t(`cardioPlan.${phase}`)} · ${label}`, draft.phases[phase]?.[key], value =>
        edit({ phases: { ...draft.phases, [phase]: { ...draft.phases[phase], [key]: value } } }), placeholder, keyboard)}</View>;
  };
  const button = (key: string, onPress: () => void) => <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 44, justifyContent: 'center' }}>
    <Text style={{ color: colors.accentText, fontWeight: '600' }}>{t(key)}</Text>
  </Pressable>;
  const review = () => {
    const manualSessions: ManualCardioSession[] = drafts.map(s => {
      const estimate = decimal(s.estimate);
      return { modality: s.modality, dayIndex: s.dayIndex, ...(estimate === undefined ? {} : { estimatedMinutes: estimate }),
        phases: Object.fromEntries(MANUAL_PHASES.flatMap(phase => {
          const target = parseTargets(s.phases[phase] ?? {}, s.modality);
          return target ? [[phase, target]] : [];
        })) };
    });
    const modalities = [...new Set(manualSessions.map(s => s.modality))];
    const plan: CardioPreviewInput = { manualSessions, modalities, profile: { schemaVersion: 1, modalities: {} }, placementPolicy: 'BALANCED_V2',
      cycleDays, availableDays: days, sessions: manualSessions.length, maxActiveDays: availability?.trainingDays ?? cycleDays,
      allowDoubles: availability?.allowDoubles ?? false, doublePolicy: 'STRENGTH_CARDIO_ONLY_V1',
      sessionMinutes: availability?.minutesPerSession ?? 600, cardioMinutes: Math.min(1440, (availability?.minutesPerSession ?? 600) * manualSessions.length),
      strength: strength.map(s => ({ ...s })) };
    if (!(name ?? title).trim() || cardioPreviewIssue(plan)) { setError(true); return; }
    onReview(plan, (name ?? title).trim());
  };
  const allowedNewDay = nextManualDay(cycleDays, drafts.map(s => s.dayIndex), strength, availability);

  return <View style={{ flex: 1, ...surfaces.screen }}>
    <ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, gap: 12 }}>
      <View style={row}>{button('generate.back', onBack)}{button('generate.cancel', onCancel)}</View>
      {progress}
      <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 28, fontWeight: '700' }}>{t('manualCardio.title')}</Text>
      {!name && <TextInput accessibilityLabel={t('generate.name')} value={title} onChangeText={setTitle} maxLength={80} placeholder={t('generate.name')}
        placeholderTextColor={colors.textSecondary} style={{ ...surfaces.field, borderRadius: radius.md, padding: 14, color: colors.textPrimary }} />}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
        {drafts.map((session, i) => <Pressable key={session.id} accessibilityRole="tab" accessibilityState={{ selected: selected === session.id }}
          onPress={() => { setSelected(session.id); setExpanded('MAIN'); setActivityOpen(false); }} style={{ ...surfaces.field, borderRadius: radius.sm, padding: 12,
            backgroundColor: selected === session.id ? colors.accentTint : colors.surface }}>
          <Text style={{ color: selected === session.id ? colors.accentText : colors.textPrimary, fontWeight: '600' }}>{t('manualCardio.sessionNumber', { value: i + 1 })}</Text>
        </Pressable>)}
      </ScrollView>
      <View style={card}>
        <Text style={{ ...labelStyle, fontSize: 17, fontWeight: '700' }}>{t('manualCardio.session')}</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: activityOpen }} onPress={() => setActivityOpen(!activityOpen)} style={row}>
          <Text style={[labelStyle, { flex: 1 }]}>{t('manualCardio.activity')}</Text>
          <Text style={{ color: colors.accentText, fontWeight: '600' }}>{t(`cardioPlan.${draft.modality}`)}</Text>
          <CycleChevron expanded={activityOpen} color={colors.accentText} size={16} />
        </Pressable>
        {activityOpen && CARDIO_MODALITIES.map(modality => <Pressable key={modality} accessibilityRole="radio" accessibilityState={{ checked: draft.modality === modality }}
          onPress={() => { edit({ modality }); setActivityOpen(false); }} style={[row, { borderBottomWidth: 1, borderColor: colors.surfaceBorder }]}>
          <Text style={labelStyle}>{t(`cardioPlan.${modality}`)}</Text>
          {draft.modality === modality && <Text style={{ color: colors.accentText }}>✓</Text>}
        </Pressable>)}
        <Stepper plain label={t('manualCardio.day')} value={draft.dayIndex + 1} min={1} max={cycleDays}
          onChange={value => edit({ dayIndex: value - 1 })} />
        {availability && <View style={row}><Text style={[labelStyle, { flex: 1 }]}>{t('manualCardio.estimate')}</Text>
          {input(t('manualCardio.estimate'), draft.estimate, estimate => edit({ estimate }), t('manualCardio.optional'), 'number-pad')}</View>}
      </View>
      <View style={card}>
        <Text style={{ ...labelStyle, fontSize: 17, fontWeight: '700' }}>{t('manualCardio.phases')}</Text>
        {MANUAL_PHASES.map(phase => {
          const target = targets[phase], summary = target && validManualTargets(target, draft.modality) ? manualTargetLabels(target, t).join(' · ') : t('manualCardio.noTarget');
          return <View key={phase} style={{ borderTopWidth: 1, borderColor: colors.surfaceBorder }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t(`cardioPlan.${phase}`)} accessibilityState={{ expanded: expanded === phase }}
              onPress={() => setExpanded(expanded === phase ? null : phase)} style={row}>
              <Text style={[labelStyle, { fontWeight: expanded === phase ? '700' : '500' }]}>{t(`cardioPlan.${phase}`)}</Text>
              <Text numberOfLines={1} style={[caption, { flex: 1, textAlign: 'right' }]}>{summary}</Text>
              <CycleChevron expanded={expanded === phase} color={colors.accentText} size={16} />
            </Pressable>
            {expanded === phase && <View style={{ paddingLeft: 12, borderLeftWidth: 2, borderColor: colors.accentTint }}>
              {field(phase, 'minutes', t('manualCardio.optional'), 'decimal-pad')}
              {draft.modality !== 'MACHINE' && field(phase, 'distance', t('manualCardio.optional'), 'decimal-pad')}
              {draft.modality === 'RUNNING' && <>{field(phase, 'fast', '5:45', 'default')}{field(phase, 'slow', '6:15', 'default')}</>}
              {field(phase, 'zone', '1–5', 'number-pad')}
            </View>}
          </View>;
        })}
      </View>
      <View style={row}>
        {allowedNewDay !== undefined && drafts.length < 14 && button('manualCardio.add', () => {
          const id = Math.max(...drafts.map(s => s.id)) + 1;
          setDrafts([...drafts, blankSession(id, allowedNewDay)]); setSelected(id); setExpanded('MAIN'); setError(false);
        })}
        {drafts.length > 1 && button('manualCardio.remove', () => {
          const next = drafts.filter(s => s.id !== selected);
          setDrafts(next); setSelected(next[0].id); setError(false);
        })}
      </View>
      {error && <Text accessibilityRole="alert" style={{ color: semantic.danger }}>{t('manualCardio.invalid')}</Text>}
    </ScrollView>
    <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 64 }}>
      <Pressable accessibilityRole="button" onPress={review} style={{ ...surfaces.primary, borderRadius: radius.md, minHeight: 48, justifyContent: 'center' }}>
        <Text style={{ textAlign: 'center', color: colors.onAccent, fontWeight: '700' }}>{t('cardioPlan.review')}</Text>
      </Pressable>
    </View>
  </View>;
}
