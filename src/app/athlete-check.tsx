import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/useTheme';
import { AthleteIntakeForm } from '@/components/profile/AthleteIntakeForm';
import { AthleteIntakeContext } from '@/hooks/AthleteIntakeContext';
import { CardioPlanBuilder } from '@/components/cardio/CardioPlanBuilder';
import { strengthIntakeDefaults, type AthleteIntake } from '@/services/settings/athleteIntake';

/** Authenticated synthetic acceptance only: no settings write or Health read. */
export default function AthleteCheck() {
  const { colors, surfaces } = useTheme(), router = useRouter();
  const [intake, setIntake] = useState<AthleteIntake | undefined>(), [mode, setMode] = useState<'welcome' | 'edit' | 'summary' | 'cardio'>('welcome');
  const [fail, setFail] = useState(false);
  const action = (label: string, onPress: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ padding: 16, minHeight: 48 }}><Text style={{ color: colors.accentText }}>{label}</Text></Pressable>;
  if (mode === 'cardio') return <AthleteIntakeContext.Provider value={{ ready: true, intake }}><CardioPlanBuilder ready error={false} onRetry={() => undefined} onCancel={() => setMode('summary')} /></AthleteIntakeContext.Provider>;
  if (mode !== 'summary') return <View style={{ flex: 1 }}>
    <AthleteIntakeForm key={mode} initial={intake} welcome={mode === 'welcome'} onCancel={() => setMode('summary')}
      onSave={async value => { if (fail) { setFail(false); return false; } setIntake(value); setMode('summary'); return true; }} />
  </View>;
  return <ScrollView style={{ ...surfaces.screen, flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: 70 }}>
    <Text style={{ color: colors.textPrimary, fontSize: 25 }}>INTAKE CHECK · memory only</Text>
    <Text style={{ color: colors.textSecondary, marginVertical: 20 }}>{JSON.stringify({ intake, strengthDefaults: strengthIntakeDefaults(intake) }, null, 2)}</Text>
    {action('Edit intake (fixture)', () => setMode('edit'))}
    {action('Open cardio defaults (fixture)', () => setMode('cardio'))}
    {action('Restart welcome (fixture)', () => { setIntake(undefined); setMode('welcome'); })}
    {action(fail ? 'Fixture save failure: on' : 'Fixture save failure: off', () => setFail(value => !value))}
    {action('Leave fixture', () => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/(train)'); })}
  </ScrollView>;
}
