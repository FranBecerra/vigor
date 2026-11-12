import { useState, type ComponentType } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ConvergenceIcon } from '@/components/icons/ActionIcons';
import { DumbbellIcon } from '@/components/icons';
import { CardioHeartIcon } from '@/components/icons/CycleReviewIcons';
import { useTheme } from '@/theme/useTheme';
import { backToTraining } from '@/services/training/backNavigation';

const disciplines = ['HYBRID', 'STRENGTH', 'CARDIO'] as const;
const methods = ['AUTOMATIC', 'MANUAL'] as const;
type Discipline = typeof disciplines[number];
type Method = typeof methods[number];

const automaticRoutes: Record<Discipline, Href> = {
  HYBRID: '/hybrid-plan', STRENGTH: '/generate', CARDIO: '/cardio-plan',
};

export default function CreateRoutineScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { surfaces, colors, spacing, radius } = useTheme();
  const [discipline, setDiscipline] = useState<Discipline>('HYBRID');
  const [method, setMethod] = useState<Method>('AUTOMATIC');
  const leave = () => backToTraining(router);

  const proceed = () => {
    if (method === 'AUTOMATIC') router.push(automaticRoutes[discipline]);
    else if (discipline === 'STRENGTH') router.push('/manual-routine');
    else router.push({ pathname: discipline === 'HYBRID' ? '/hybrid-plan' : '/cardio-plan', params: { mode: 'manual' } });
  };

  function row({ value, title, hint, checked, disabled = false, onPress, Icon, first }: {
    value: string;
    title: string;
    hint: string;
    checked: boolean;
    disabled?: boolean;
    onPress: () => void;
    Icon?: ComponentType<{ size?: number; color?: string }>;
    first: boolean;
  }) {
    return <Pressable key={value} accessibilityRole="radio" accessibilityLabel={title} accessibilityHint={hint}
      accessibilityState={{ checked, disabled }} disabled={disabled} onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14,
        borderTopWidth: first ? 0 : 1, borderColor: colors.surfaceBorder,
        backgroundColor: checked ? colors.accentTint : 'transparent' }}>
      {Icon && <View accessible={false} style={{ width: 38, height: 38, borderRadius: 12,
        backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={22} color={colors.accentText} />
      </View>}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: disabled ? colors.textSecondary : colors.textPrimary, fontSize: 17, fontWeight: '600' }}>{title}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{hint}</Text>
      </View>
      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5,
        borderColor: checked ? colors.accentText : colors.textSecondary, alignItems: 'center', justifyContent: 'center' }}>
        {checked && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentText }} />}
      </View>
    </Pressable>;
  }

  const group = { ...surfaces.card, borderRadius: radius.lg, overflow: 'hidden' as const };
  const icons = { HYBRID: ConvergenceIcon, STRENGTH: DumbbellIcon, CARDIO: CardioHeartIcon };
  return <View style={{ flex: 1, ...surfaces.screen, backgroundColor: colors.bg }}>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.lg, gap: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" onPress={leave} style={{ paddingVertical: 12 }}>
          <Text style={{ color: colors.accentText }}>{t('generate.back')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={leave} style={{ paddingVertical: 12 }}>
          <Text style={{ color: colors.accentText }}>{t('routineCreation.cancel')}</Text>
        </Pressable>
      </View>
      <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 28, fontWeight: '700' }}>
        {t('routineCreation.title')}
      </Text>
      <Text style={{ color: colors.textSecondary }}>{t('routineCreation.disciplinePrompt')}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('routineCreation.disciplinePrompt')} style={group}>
        {disciplines.map((value, index) => row({ value, title: t(`routineCreation.${value}`), hint: t(`routineCreation.${value}Hint`),
          checked: discipline === value, Icon: icons[value], first: index === 0, onPress: () => setDiscipline(value) }))}
      </View>
      <View style={group} accessibilityRole="radiogroup" accessibilityLabel={t('routineCreation.method')}>
        <Text accessibilityRole="header" style={{ padding: 14, color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
          {t('routineCreation.method')}
        </Text>
        {methods.map(value => row({ value, title: t(`routineCreation.${value}`), hint: t(`routineCreation.${value}ChoiceHint`),
          checked: method === value, first: false, onPress: () => setMethod(value) }))}
      </View>
    </ScrollView>
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: insets.bottom + 64, gap: 7 }}>
      <Pressable accessibilityRole="button" onPress={proceed} style={{ ...surfaces.primary,
        borderRadius: radius.md, minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }}>
        <Text style={{ color: colors.onAccent, fontSize: 17, fontWeight: '700' }}>{t('routineCreation.continue')}</Text>
      </Pressable>
    </View>
  </View>;
}
