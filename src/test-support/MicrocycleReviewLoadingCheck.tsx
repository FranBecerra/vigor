import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MicrocycleReviewDialogContent } from '@/components/bio/MicrocycleReviewDialogContent';
import { microcycleReviewId } from '@/services/bio/microcycleReview';
import { continuityFixture } from './continuityFixture';
import { useTheme } from '@/theme/useTheme';

/** Exercise the production Modal host with delayed, memory-only observations. */
export function MicrocycleReviewLoadingCheck() {
  const { colors } = useTheme();
  const [fixture] = useState(continuityFixture);
  const [open, setOpen] = useState(false), [ready, setReady] = useState(false), [fail, setFail] = useState(true), [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setReady(true), 500);
    return () => clearTimeout(timer);
  }, [open]);
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel="Review microcycle with delayed loading (memory only)" style={{ minHeight: 48 }}
      onPress={() => { setReady(false); setOpen(true); setFail(true); setSaved(false); }}>
      <Text style={{ color: colors.accentText }}>Review microcycle with delayed loading (memory only)</Text>
    </Pressable>
    {saved && <Text style={{ color: colors.textPrimary }}>Microcycle review saved in memory</Text>}
    {open && <MicrocycleReviewDialogContent id={microcycleReviewId(fixture.data.source.id, 0)} uid="owner" onClose={() => setOpen(false)}
      data={{ owner: 'owner', ready, error: false, plans: ready ? [fixture.data.source] : [], routines: [], history: ready ? fixture.data.history : [], reload: () => setReady(true) }}
      reviews={{ ready: true, error: false, entries: [], save: async () => {
        if (fail) { setFail(false); throw Error('syntheticReviewSave'); }
        setSaved(true);
      } }} />}
  </View>;
}
