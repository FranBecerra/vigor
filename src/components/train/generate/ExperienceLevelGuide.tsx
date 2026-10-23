import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { ExperienceLevel } from '@/models/athlete';
import { useTheme } from '@/theme/useTheme';
import { EXPERIENCE_QUESTIONS, recommendExperience, type ExperienceAnswers } from '@/services/training/experienceGuidance';
import { GenerationChoice } from './GenerationChoice';

/** Disposable answers: only an explicit acceptance updates the generator's level. */
export function ExperienceLevelGuide({ onSelect, onClose }: {
  onSelect: (level: ExperienceLevel) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius, sectionAccent } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<ExperienceAnswers>({});
  const scroll = useRef<ScrollView>(null);
  const question = EXPERIENCE_QUESTIONS[step];
  const result = step === EXPERIENCE_QUESTIONS.length ? recommendExperience(answers) : null;
  const canContinue = question ? answers[question.id] !== undefined : result !== null;
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step]);

  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: spacing.lg, alignItems: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('experienceGuide.close')} onPress={onClose}
          style={{ minHeight: 44, paddingHorizontal: spacing.sm, justifyContent: 'center' }}>
          <Text style={[typography.body, { color: colors.textSecondary }]}>{t('generate.cancel')}</Text>
        </Pressable>
      </View>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
        {question ? <>
          <Text style={[typography.caption, { color: colors.accentText, marginBottom: spacing.sm }]}>
            {t('experienceGuide.step', { current: step + 1, total: EXPERIENCE_QUESTIONS.length })}
          </Text>
          <Text accessibilityRole="header" style={[typography.h1, { color: colors.textPrimary }]}>
            {t(`experienceGuide.questions.${question.id}.title`)}
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.lg }]}>
            {t(`experienceGuide.questions.${question.id}.hint`)}
          </Text>
          <View accessibilityRole="radiogroup">
            {question.options.map((option) => <GenerationChoice key={option} compact
              title={t(`experienceGuide.options.${option}.title`)}
              description={t(`experienceGuide.options.${option}.description`)}
              selected={answers[question.id] === option}
              onPress={() => setAnswers((old) => ({ ...old, [question.id]: option }))} />)}
          </View>
        </> : result && <>
          <Text style={[typography.caption, { color: colors.accentText, marginBottom: spacing.sm }]}>{t('experienceGuide.result')}</Text>
          <Text accessibilityRole="header" style={[typography.emphasis, { color: colors.textPrimary }]}>{t(`generate.level${result.level}`)}</Text>
          <View style={{ backgroundColor: colors.bgElevated, borderRadius: radius.lg, padding: spacing.lg, marginVertical: spacing.lg }}>
            <Text style={[typography.body, { color: colors.textPrimary }]}>{t(`experienceGuide.reasons.${result.reason}`)}</Text>
          </View>
          <Text style={[typography.body, { color: colors.textSecondary }]}>{t('experienceGuide.resultHint')}</Text>
        </>}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.lg,
        paddingBottom: insets.bottom + spacing.lg, borderTopWidth: 1, borderTopColor: colors.surfaceBorder }}>
        {step > 0 && <Pressable accessibilityRole="button" onPress={() => setStep((value) => value - 1)}
          style={{ minHeight: 52, justifyContent: 'center', paddingHorizontal: spacing.sm }}>
          <Text style={[typography.body, { color: colors.textSecondary }]}>{t('generate.back')}</Text>
        </Pressable>}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canContinue }} disabled={!canContinue}
          onPress={() => {
            if (!canContinue) return;
            if (result) { onSelect(result.level); onClose(); }
            else setStep((value) => value + 1);
          }}
          style={{ flex: 1, minHeight: 52, padding: spacing.sm, borderRadius: radius.pill,
            alignItems: 'center', justifyContent: 'center', backgroundColor: sectionAccent.train, opacity: canContinue ? 1 : 0.4 }}>
          <Text style={[typography.title, { color: colors.onAccent }]}>{t(result ? 'experienceGuide.apply' : 'exerciseWizard.next')}</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}
