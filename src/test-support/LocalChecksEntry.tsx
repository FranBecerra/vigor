import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/useTheme';

/** Build-time opt-in only. Does not replace authentication or connect any data source. */
export function LocalChecksEntry() {
  if (process.env.EXPO_PUBLIC_VIGOR_LOCAL_CHECKS !== '1') return null;
  return <EnabledLocalChecksEntry />;
}
function EnabledLocalChecksEntry() {
  const router = useRouter(), { colors, surfaces, radius } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel="Local checks · synthetic data" onPress={() => router.push('/cardio-check')}
    style={{ ...surfaces.field, padding: 14, minHeight: 48, borderRadius: radius.md, marginTop: 12 }}>
    <Text style={{ color: colors.accentText, fontSize: 16, fontWeight: '600' }}>Local checks · synthetic data</Text>
  </Pressable>;
}
