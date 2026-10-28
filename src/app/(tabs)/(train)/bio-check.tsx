/** Authenticated, in-memory interaction fixture. Never imports athlete repositories. */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { MicrocycleReviewSheet } from '@/components/bio/MicrocycleReviewSheet';
import { DailyCheckInSheet } from '@/components/bio/DailyCheckInSheet';
import type { MicrocycleReviewAnswers } from '@/models/microcycleReview';
import type { DailyCheckInAnswers } from '@/models/dailyCheckIn';
import { useTheme } from '@/theme/useTheme';
import { BioHealthCard } from '@/components/bio/BioHealthCard';
import { BioVolumeReview } from '@/components/bio/BioVolumeReview';
import type { BioHealthTrend } from '@/models/bioHealth';
import { MuscleGroup } from '@/models';
import { ReadinessEvidencePreview } from '@/components/bio/ReadinessEvidencePreview';
import { previewReadinessEvidence } from '@/services/bio/readinessEvidence';
import { BioNightDetailsSheet } from '@/components/bio/BioNightDetailsSheet';
import { buildNightObservations } from '@/services/bio/nightObservations';
import { BIO_NIGHT_METRICS, type BioNightRead } from '@/models/bioNight';
import { BioReadinessCard } from '@/components/bio/BioReadinessCard';
import { buildReadinessIndex } from '@/services/bio/readinessIndex';
import { BioSessionContextCard } from '@/components/bio/BioSessionContextCard';
import { buildBioSessionContext } from '@/services/bio/sessionContext';
import { sessionContextFixture, contextWorkout } from '@/test-support/sessionContextFixture';
import { metricMonitorFixture } from '@/test-support/metricMonitorFixture';

export default function BioInteractionCheck() {
  const { t } = useTranslation(), { surfaces, colors, typography, radius } = useTheme(), insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false), [answers, setAnswers] = useState<MicrocycleReviewAnswers>({});
  const [status, setStatus] = useState('Synthetic data · no account writes');
  const [dailyOpen, setDailyOpen] = useState(false), [dailyAnswers, setDailyAnswers] = useState<DailyCheckInAnswers>({});
  const [previewHealth, setPreviewHealth] = useState(false);
  const [previewNight, setPreviewNight] = useState(false);
  const [previewNightDetails, setPreviewNightDetails] = useState(false);
  useEffect(() => { setPreviewNightDetails(false); }, [previewNight]);
  const [previewSession, setPreviewSession] = useState(false), [previewSessionIndex, setPreviewSessionIndex] = useState(0);
  const [readinessCase, setReadinessCase] = useState<'USUAL' | 'SLEEP' | 'MULTIPLE' | 'MISSING'>('USUAL');
  const syntheticReadiness = (['SLEEP', 'RESTING_HR', 'HRV_SDNN'] as const).map((metric): BioHealthTrend => {
    const value = metric === 'SLEEP' ? 480 : metric === 'RESTING_HR' ? 55 : 45;
    const days = Array.from({ length: 36 }, (_, index) => {
      const date = new Date(); date.setDate(date.getDate() - (35 - index));
      const recent = index >= 29;
      const changed = recent && (readinessCase === 'MULTIPLE' || readinessCase === 'SLEEP' && metric === 'SLEEP');
      return { date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        value: changed ? value * (metric === 'RESTING_HR' ? 1.15 : 0.8) : value + index % 3,
        at: date.getTime(), samples: 1 };
    });
    return { metric, status: readinessCase === 'MISSING' && metric === 'HRV_SDNN' ? 'EMPTY' : 'AVAILABLE',
      sourceId: 'synthetic', sourceName: 'Synthetic Watch', days, latest: days.at(-1), fresh: true };
  });
  const nightNow = Date.now(), nightEnd = new Date(nightNow);
  nightEnd.setHours(7, 0, 0, 0); if (nightEnd.getTime() > nightNow) nightEnd.setDate(nightEnd.getDate() - 1);
  const syntheticNight: BioNightRead = { version: 1, metrics: Object.fromEntries(BIO_NIGHT_METRICS.map((metric) => [metric,
    { error: false, truncated: false, samples: Array.from({ length: 42 }, (_, day) => {
      const end = new Date(nightEnd); end.setDate(end.getDate() - day);
      const start = new Date(end); start.setDate(start.getDate() - 1); start.setHours(23, 0, 0, 0);
      return Array.from({ length: metric === 'SLEEP' ? 1 : 5 }, (_, index) => ({ metric, id: `${metric}:${day}:${index}`,
        sourceId: 'synthetic-overnight-watch', sourceName: 'Synthetic Watch · no Health reads', manuallyEntered: false,
        start: metric === 'SLEEP' ? start.getTime() : start.getTime() + (index + 1) * 75 * 60000,
        end: metric === 'SLEEP' ? end.getTime() : start.getTime() + (index + 1) * 75 * 60000,
        value: metric === 'SLEEP' ? 480 : metric === 'HEART_RATE' ? 55 + index % 3 : metric === 'HRV_SDNN' ? 45 + index : 52 + index,
        ...(metric === 'SLEEP' ? { sleepState: 'ASLEEP' } : {}),
      }));
    }).flat() }])) as BioNightRead['metrics'] };
  const syntheticSession = sessionContextFixture();
  const sessionContext = previewSession ? buildBioSessionContext({ ...syntheticSession, selectedSessionIndex: previewSessionIndex, history: [contextWorkout()] }) : undefined;
  return <><ScrollView style={{ ...surfaces.screen, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 110 }}>
    <Text style={[typography.emphasis, { color: colors.textPrimary }]}>Bio · interaction check</Text>
    <Text style={[typography.body, { color: colors.textSecondary, marginVertical: 20 }]}>{status}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Preview synthetic session context" onPress={() => setPreviewSession(!previewSession)}
      style={{ minHeight: 52, justifyContent: 'center', padding: 16, borderRadius: radius.lg, backgroundColor: colors.bgElevated, marginBottom: 12 }}>
      <Text style={[typography.title, { color: colors.bioText }]}>Preview synthetic session context</Text>
    </Pressable>
    {previewSession && <BioSessionContextCard view={{ state: 'READY', context: sessionContext, select: setPreviewSessionIndex }} />}
    <Pressable accessibilityRole="button" accessibilityLabel="Preview synthetic overnight observations" onPress={() => setPreviewNight(!previewNight)}
      style={{ minHeight: 52, justifyContent: 'center', padding: 16, borderRadius: radius.lg, backgroundColor: colors.bgElevated, marginBottom: 12 }}>
      <Text style={[typography.title, { color: colors.bioText }]}>Preview synthetic overnight observations</Text>
    </Pressable>
    {previewNight && <>
      <Pressable accessibilityRole="button" accessibilityLabel={t('bioSummary.nightDetails')} onPress={() => setPreviewNightDetails(true)}
        style={{ minHeight: 48, padding: 16, marginBottom: 16, borderRadius: radius.md, backgroundColor: colors.bgElevated }}>
        <Text style={[typography.title, { color: colors.bioText }]}>{t('bioSummary.nightDetails')}</Text>
      </Pressable>
      <BioReadinessCard view={{ state: 'READY', index: buildReadinessIndex(buildNightObservations(syntheticNight, nightNow), 480, nightNow) }} />
    </>}
    <Pressable accessibilityRole="button" accessibilityLabel="Preview synthetic Health and dose review" onPress={() => setPreviewHealth(!previewHealth)}
      style={{ minHeight: 52, justifyContent: 'center', padding: 16, borderRadius: radius.lg, backgroundColor: colors.bgElevated }}>
      <Text style={[typography.title, { color: colors.bioText }]}>Preview synthetic Health and dose review</Text>
    </Pressable>
    {previewHealth && <>
      {(['USUAL', 'SLEEP', 'MULTIPLE', 'MISSING'] as const).map((scenario) => <Pressable key={scenario} accessibilityRole="button"
        accessibilityLabel={`Synthetic readiness: ${scenario}`} onPress={() => setReadinessCase(scenario)} style={{ minHeight: 48, justifyContent: 'center' }}>
        <Text style={[typography.title, { color: colors.bioText }]}>{scenario}</Text>
      </Pressable>)}
      <ReadinessEvidencePreview evidence={previewReadinessEvidence(syntheticReadiness, Date.now())} />
      <BioHealthCard health={{ owner: 'synthetic', state: 'READY', trends: metricMonitorFixture(), reload: () => undefined }} sleepGoalMinutes={495} />
      <BioVolumeReview items={[{ muscle: MuscleGroup.CHEST, reason: 'RECORDED_PROGRESS', action: 'MAINTAIN', observations: 6, cycleIndexes: [1, 0], exerciseIds: [] },
        { muscle: MuscleGroup.TRICEPS, reason: 'INSUFFICIENT', action: 'KEEP_COLLECTING', observations: 0, cycleIndexes: [1, 0], exerciseIds: [] }]} />
    </>}
    <Pressable accessibilityRole="button" accessibilityLabel={t('bio.review')} onPress={() => setOpen(true)}
      style={{ minHeight: 52, justifyContent: 'center', padding: 16, borderRadius: radius.lg, backgroundColor: colors.bgElevated }}>
      <Text style={[typography.title, { color: colors.accentText }]}>{t('bio.review')}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={t('dailyCheckIn.start')} onPress={() => setDailyOpen(true)}
      style={{ minHeight: 52, justifyContent: 'center', padding: 16, marginTop: 12, borderRadius: radius.lg, backgroundColor: colors.bgElevated }}>
      <Text style={[typography.title, { color: colors.bioText }]}>{t('dailyCheckIn.start')}</Text>
    </Pressable>
    {Object.entries(dailyAnswers).map(([key, value]) => <Text key={`daily:${key}`} style={[typography.body, { color: colors.textPrimary, marginTop: 10 }]}>Today {key}: {value}</Text>)}
    {dailyOpen && <DailyCheckInSheet initial={dailyAnswers} onClose={() => setDailyOpen(false)}
      onSave={async (value) => { setDailyAnswers(value); setStatus('Synthetic daily check-in saved in memory only'); }} />}
    {Object.entries(answers).map(([key, value]) => <Text key={key} style={[typography.body, { color: colors.textPrimary, marginTop: 10 }]}>{key}: {Array.isArray(value) ? value.join(', ') : value}</Text>)}
    {open && <MicrocycleReviewSheet cycleNumber={1} initial={answers} onClose={() => setOpen(false)}
      onSave={async (value) => { setAnswers(value); setStatus('Synthetic review saved in memory only'); }}
      onSkip={async () => setStatus('Synthetic review dismissed in memory only')} />}
  </ScrollView>
    {previewNight && previewNightDetails && <BioNightDetailsSheet night={{ owner: 'synthetic', state: 'READY', analysis: buildNightObservations(syntheticNight, nightNow), reload: () => undefined }} onClose={() => setPreviewNightDetails(false)} />}
  </>;
}
