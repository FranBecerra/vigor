/** Internal, fixture-only Release benchmark. Never writes training or health data. */
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';
import { GenerationChoice } from '@/components/train/generate/GenerationChoice';
import { SplitDiagram, SplitLegend } from '@/components/train/generate/SplitDiagram';
import { EquipmentIllustration } from '@/components/train/generate/EquipmentIllustration';
import { DEFAULT_GENERATOR_EQUIPMENT } from '@/services/training/generatorDefaults';
import { SplitStructure } from '@/models';
import { ExerciseSwapSheet } from '@/components/train/generate/ExerciseSwapSheet';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { uiPerformance, assessUiPerformance, type UiMetric, type UiPerformanceReport } from '@/services/performance/uiPerformance';
import { measureNextFrame } from '@/hooks/useMeasuredCommit';

const ITERATIONS = 31; // First exposure is cold, followed by thirty warm samples.
const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export default function PerformanceScreen() {
  const { colors, sectionAccent, spacing, typography } = useTheme(); const insets = useSafeAreaInsets();
  const router = useRouter(); const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ autorun?: string; target?: string }>();
  const [scene, setScene] = useState<'idle' | 'button.commit' | 'wizard.commit' | 'picker.ready'>('idle');
  const [iteration, setIteration] = useState(0); const [running, setRunning] = useState(false);
  const [result, setResult] = useState(''); const [pickerOpen, setPickerOpen] = useState(false);
  const ready = useRef<(() => void) | null>(null); const mounted = useRef(true); const runningRef = useRef(false);
  const runId = String(params.autorun ?? Date.now()).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 80);
  useEffect(() => () => { mounted.current = false; uiPerformance.stop(); ready.current?.(); }, []);
  useEffect(() => {
    if (scene === 'button.commit' || scene === 'wizard.commit') measureNextFrame(scene, () => ready.current?.());
  }, [scene, iteration]);

  const run = async (exportedRunId = runId) => {
    if (runningRef.current) return;
    runningRef.current = true; setRunning(true); setResult(''); uiPerformance.start();
    let frame = 0; let previous = performance.now();
    const tick = () => {
      const now = performance.now(); uiPerformance.record('js.frameGap', now - previous); previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    let error = '';
    try {
      for (const metric of ['button.commit', 'wizard.commit', 'picker.ready'] as UiMetric[]) {
        for (let index = 0; index < ITERATIONS; index++) {
          if (!mounted.current) return;
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => { ready.current = null; reject(new Error(`${metric}: readiness timed out`)); }, 5000);
            ready.current = () => { clearTimeout(timeout); ready.current = null; resolve(); };
            uiPerformance.begin(metric); setScene(metric as typeof scene); setIteration((value) => value + 1);
            if (metric === 'picker.ready') setPickerOpen(true);
          });
          if (metric === 'picker.ready') { setPickerOpen(false); await wait(450); }
        }
      }
    } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
    finally {
      cancelAnimationFrame(frame);
      const samples = uiPerformance.stop();
      if (mounted.current) {
        const report: UiPerformanceReport & { runId: string; error?: string } = { version: 1, runId: exportedRunId,
          environment: { platform: Platform.OS, os: String(Platform.Version), mode: __DEV__ ? 'development' : 'release', viewport: `${width}x${height}`, target: params.target ?? 'manual-unlabelled', workload: 'illustrated-options-v1' },
          samples, ...(error ? { error } : {}) };
        try {
          const file = new File(Paths.document, `vigor-ui-performance-${exportedRunId}.json`);
          const staging = new File(Paths.document, `vigor-ui-performance-${exportedRunId}.pending.json`);
          staging.create({ overwrite: true });
          staging.write(JSON.stringify(report, null, 2));
          staging.move(file);
          const assessment = assessUiPerformance(report);
          setResult(`${error || (assessment.passed ? 'PASS' : 'FAIL')}\n${assessment.metrics.map((metric) => `${metric.metric}: p95 ${metric.p95.toFixed(1)} ms`).join('\n')}\n${file.name}`);
        } catch (cause) { setResult(`Report export failed: ${String(cause)}`); }
        runningRef.current = false; setRunning(false); setScene('idle'); setPickerOpen(false);
      }
    }
  };
  useEffect(() => { if (params.autorun) void run(runId); }, [params.autorun]);
  return <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: insets.top + spacing.lg }}>
    <Text style={[typography.emphasis, { color: colors.textPrimary }]}>UI PERFORMANCE</Text>
    <Text style={{ color: colors.textSecondary, marginVertical: 16 }}>Fixture-only · Release · 30 warm samples per action</Text>
    {running && <Text style={{ color: sectionAccent.train, marginBottom: 12 }}>{scene} · {iteration}</Text>}
    {scene === 'button.commit' && <GenerationChoice title="Selection feedback" selected={iteration % 2 === 0} onPress={() => {}} compact />}
    {scene === 'wizard.commit' && <ScrollView key={iteration}>
      {iteration % 3 === 0 ? ['Hypertrophy', 'Strength'].map((title, index) => <GenerationChoice key={title}
        title={title} description="Shared production option card" selected={index === 0} onPress={() => {}} />)
        : iteration % 3 === 1 ? DEFAULT_GENERATOR_EQUIPMENT.map((entry) => <GenerationChoice key={entry}
          title={entry} description="Shared illustrated equipment option" selected multiple compact onPress={() => {}}
          artwork={<EquipmentIllustration equipment={entry} />} />)
          : [SplitStructure.AUTO, SplitStructure.FULL_BODY, SplitStructure.UPPER_LOWER, SplitStructure.PUSH_PULL_LEGS].map((entry) => <GenerationChoice key={entry}
            title={entry} description="Shared illustrative training distribution" selected={entry === SplitStructure.AUTO} onPress={() => {}}
            artwork={<SplitDiagram split={entry} sessions={4} />} footer={<SplitLegend split={entry} sessions={4} />} />)}
    </ScrollView>}
    {!running && <><Text selectable style={{ color: colors.textPrimary, marginVertical: 20 }}>{result}</Text>
      <Pressable onPress={() => { void run(`${Date.now()}-manual`); }} style={{ padding: 18, backgroundColor: colors.surface, borderRadius: 16 }}>
        <Text style={{ color: sectionAccent.train }}>Run benchmark</Text></Pressable>
      <Pressable onPress={() => router.replace('/(tabs)/(train)')} style={{ padding: 18 }}><Text style={{ color: colors.textSecondary }}>Back</Text></Pressable>
    </>}
    <ExerciseSwapSheet open={pickerOpen} current={EXERCISE_CATALOGUE[0]} candidates={EXERCISE_CATALOGUE.slice(1)} onSelect={() => {}}
      onPresented={() => ready.current?.()} onClose={() => setPickerOpen(false)} />
  </View>;
}
