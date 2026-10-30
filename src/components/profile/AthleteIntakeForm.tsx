import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';
import { ExperienceLevel } from '@/models/athlete';
import type { CardioModalityProfile, CardioPlanningModality } from '@/models/cardio';
import { INTAKE_GOALS, validateAthleteIntake, type AthleteIntake } from '@/services/settings/athleteIntake';
import { GenerationChoice } from '@/components/train/generate/GenerationChoice';
import { ExperienceLevelGuide } from '@/components/train/generate/ExperienceLevelGuide';
import { NumericField } from '@/components/train/NumericField';

export function AthleteIntakeForm({ initial, welcome = false, onSave, onCancel }: {
  initial?: AthleteIntake; welcome?: boolean;
  onSave: (value: AthleteIntake) => Promise<boolean>; onCancel: () => void;
}) {
  const { t } = useTranslation(), { colors, surfaces, radius, semantic } = useTheme(), insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<AthleteIntake>(() => initial?.status === 'COMPLETED'
    ? validateAthleteIntake(initial) : { version: 1, status: 'COMPLETED', updatedAt: Date.now() });
  const [step, setStep] = useState(0), [guide, setGuide] = useState(false), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  const saving = useRef(false), live = useRef(true), scroll = useRef<ScrollView>(null);
  const cancel = useRef(onCancel); cancel.current = onCancel;
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!saving.current) { if (step > 0) setStep(value => value - 1); else cancel.current(); }
      return true;
    });
    return () => listener.remove();
  }, [step]);
  const patch = (value: Partial<AthleteIntake>) => { if (!saving.current) setDraft(old => ({ ...old, ...value })); };
  const profile = draft.cardio ?? { schemaVersion: 1 as const, modalities: {} };
  const updateCardio = (modality: CardioPlanningModality, value: Partial<CardioModalityProfile>) => patch({ cardio: { schemaVersion: 1,
    modalities: { ...profile.modalities, [modality]: { status: 'UNSURE', qualityExposure: 'UNKNOWN', ...profile.modalities[modality], ...value } } } });
  const text = { fontSize: 17, color: colors.textPrimary };
  const caption = { fontSize: 14, lineHeight: 21, color: colors.textSecondary };
  const action = (label: string, press: () => void, primary = false) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label}
    disabled={busy} accessibilityState={{ disabled: busy, busy }} onPress={press}
    style={{ minHeight: 48, padding: 14, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', ...(primary ? surfaces.primary : {}) }}>
    <Text style={{ ...text, color: primary ? colors.onAccent : colors.accentText, fontWeight: '600' }}>{label}</Text>
  </Pressable>;
  const save = async (defer = false) => {
    if (saving.current) return;
    saving.current = true; setBusy(true); setFailed(false);
    try {
      const value = validateAthleteIntake(defer ? { version: 1, status: 'DEFERRED', updatedAt: Date.now() } : { ...draft, updatedAt: Date.now() });
      if (!await onSave(value) && live.current) setFailed(true);
    } catch { if (live.current) setFailed(true); }
    finally { saving.current = false; if (live.current) setBusy(false); }
  };
  return <View style={{ flex: 1, ...surfaces.screen, paddingTop: insets.top }}>
    <View style={{ paddingHorizontal: 12, alignItems: 'flex-end' }}>
      {action(t(welcome ? 'athleteIntake.later' : 'generate.cancel'), () => welcome ? void save(true) : onCancel())}
    </View>
    <ScrollView ref={scroll} pointerEvents={busy ? 'none' : 'auto'} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22, paddingBottom: 30 }}>
      <Text style={{ ...caption, color: colors.accentText, marginBottom: 10 }}>{t('athleteIntake.step', { current: step + 1, total: 4 })}</Text>
      <Text accessibilityRole="header" style={{ ...text, fontSize: 30, fontWeight: '700', marginBottom: 16 }}>{t(`athleteIntake.title${step}`)}</Text>
      {step === 0 && <>
        <Text style={{ ...caption, marginBottom: 20 }}>{t('athleteIntake.intro')}</Text>
        {INTAKE_GOALS.map(goal => <GenerationChoice key={goal} compact title={t(`athleteIntake.goal_${goal}`)}
          selected={draft.goal === goal} onPress={() => patch({ goal: draft.goal === goal ? undefined : goal })} />)}
      </>}
      {step === 1 && <>
        {Object.values(ExperienceLevel).map(level => <GenerationChoice key={level} compact title={t(`generate.level${level}`)}
          selected={draft.strengthExperience === level}
          onPress={() => patch({ strengthExperience: draft.strengthExperience === level ? undefined : level })} />)}
        {action(t('experienceGuide.open'), () => setGuide(true))}
        <Text style={caption}>{t('athleteIntake.unknown')}</Text>
      </>}
      {step === 2 && <>
        <Text style={{ ...caption, marginBottom: 18 }}>{t('athleteIntake.cardioHint')}</Text>
        {(['RUNNING', 'CYCLING', 'MACHINE'] as const).map(modality => {
          const current = profile.modalities[modality];
          return <View key={modality} style={{ ...surfaces.card, borderRadius: radius.lg, padding: 16, marginBottom: 14 }}>
            <Text style={{ ...text, fontWeight: '600', marginBottom: 12 }}>{t(`cardioPlan.${modality}`)}</Text>
            {(['NEW', 'RETURNING', 'REGULAR', 'UNSURE'] as const).map(status => <Pressable key={status} accessibilityRole="radio"
              accessibilityLabel={`${t(`cardioPlan.${modality}`)}: ${t(`cardioPlan.${status}`)}`} disabled={busy} accessibilityState={{ selected: current?.status === status, disabled: busy }}
              onPress={() => {
                if (current?.status === status) {
                  const modalities = { ...profile.modalities }; delete modalities[modality]; patch({ cardio: { schemaVersion: 1, modalities } });
                } else updateCardio(modality, { status });
              }} style={{ minHeight: 46, padding: 12, borderRadius: radius.md,
                backgroundColor: current?.status === status ? colors.accentTint : 'transparent' }}>
              <Text style={{ ...text, color: current?.status === status ? colors.accentText : colors.textPrimary }}>{t(`cardioPlan.${status}`)}</Text>
            </Pressable>)}
            {current && <>
              <Text style={{ ...caption, marginTop: 12 }}>{t('cardioGuidance.currentFrequency')}</Text>
              <NumericField compact editable={!busy} accessibilityLabel={t('athleteIntake.frequencyFor', { modality: t(`cardioPlan.${modality}`) })}
                value={current.sessionsPerWeek} onChangeValue={sessionsPerWeek => updateCardio(modality, { sessionsPerWeek })} />
              <Text style={{ ...caption, marginTop: 12 }}>{t('cardioPlan.currentDuration')}</Text>
              <NumericField compact editable={!busy} accessibilityLabel={t('cardioPlan.durationFor', { modality: t(`cardioPlan.${modality}`) })}
                value={current.typicalSessionMinutes} onChangeValue={typicalSessionMinutes => updateCardio(modality, { typicalSessionMinutes })} />
            </>}
          </View>;
        })}
      </>}
      {step === 3 && <>
        <Text style={{ ...caption, marginBottom: 20 }}>{t('athleteIntake.capacityHint')}</Text>
        <Text style={text}>{t('athleteIntake.strengthFrequency')}</Text>
        <NumericField compact editable={!busy} accessibilityLabel={t('athleteIntake.strengthFrequency')} value={draft.strengthSessionsPerWeek}
          onChangeValue={strengthSessionsPerWeek => patch({ strengthSessionsPerWeek })} />
        <Text style={{ ...text, marginTop: 24 }}>{t('athleteIntake.strengthDuration')}</Text>
        <NumericField compact editable={!busy} accessibilityLabel={t('athleteIntake.strengthDuration')} value={draft.strengthMinutesPerSession}
          onChangeValue={strengthMinutesPerSession => patch({ strengthMinutesPerSession })} />
        <Text style={{ ...caption, marginTop: 30 }}>{t('athleteIntake.privacy')}</Text>
      </>}
      {failed && <Text accessibilityRole="alert" style={{ ...caption, color: semantic.warning, marginTop: 18 }}>{t('athleteIntake.failed')}</Text>}
    </ScrollView>
    <View style={{ padding: 18, paddingBottom: insets.bottom + 16, borderTopWidth: 1, borderColor: colors.surfaceBorder }}>
      {step > 0 && action(t('generate.back'), () => setStep(value => value - 1))}
      {action(t(step === 3 ? busy ? 'athleteIntake.saving' : 'athleteIntake.save' : 'exerciseWizard.next'), () => step === 3 ? void save() : setStep(value => value + 1), true)}
    </View>
    {guide && <ExperienceLevelGuide onSelect={strengthExperience => patch({ strengthExperience })} onClose={() => setGuide(false)} />}
  </View>;
}
