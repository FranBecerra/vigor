/**
 * Layout raíz de la app (Expo Router).
 *
 * Envuelve TODAS las pantallas:
 *  - `GestureHandlerRootView`: requerido por react-native-gesture-handler, que
 *    usamos para el gesto de mantener-pulsado-y-soltar del selector de intensidad.
 *  - `SafeAreaProvider`: evita que el contenido quede bajo el notch/bordes.
 *  - `AuthProvider` + `AuthGate`: ninguna pantalla se monta sin sesión.
 *  - Inicialización de i18n (idioma del sistema) antes de renderizar.
 *
 * La puerta va en el layout raíz y no dentro de cada pantalla a propósito: así no
 * existe forma de añadir una pantalla nueva y olvidarse de protegerla.
 */
import { useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Stack, ThemeProvider } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { SignInScreen } from '@/components/auth/SignInScreen';
import { useTheme } from '@/theme/useTheme';
import { navigationThemeFor } from '@/theme/navigationTheme';

import '@/i18n';
import { ExerciseCatalogueProvider } from '@/hooks/useExerciseCatalogue';
import { RehabilitationProvider } from '@/hooks/useRehabilitation';
import { useWorkoutActivityOwner } from '@/hooks/useWorkoutActivity';
import { HealthExportProvider } from '@/hooks/useHealthExport';
import { AppSettingsProvider, useAppSettings } from '@/hooks/useAppSettings';
import { shouldOfferFirstAccountIntake } from '@/services/settings/athleteIntake';
import { AthleteIntakeForm } from '@/components/profile/AthleteIntakeForm';
import { TrainingNotesProvider } from '@/hooks/useTrainingNotes';
import { MicrocycleReviewsProvider } from '@/hooks/useMicrocycleReviews';
import { WheelOverlayProvider } from '@/components/train/WheelOverlay';

/**
 * Decide qué mostrar según el estado de sesión.
 *
 * Tres estados, no dos: mientras Firebase restaura la sesión del disco no se
 * sabe aún si hay usuario. Pintar el login en ese hueco provocaría un parpadeo
 * en cada arranque para un usuario que sí tiene sesión.
 */
function AuthGate() {
  const { user, isLoading } = useAuth();
  const preferences = useAppSettings();
  const { t } = useTranslation();
  const eligibility = useRef<{ owner: string | null; offer: boolean }>({ owner: null, offer: false });
  if (eligibility.current.owner !== (user?.uid ?? null)) eligibility.current = { owner: user?.uid ?? null,
    offer: shouldOfferFirstAccountIntake(user?.metadata?.creationTime, Date.now()) };
  useWorkoutActivityOwner(user?.uid ?? null, isLoading);
  const { colors, sectionAccent } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={sectionAccent.train} />
      </View>
    );
  }

  if (user === null) return <SignInScreen />;

  if (eligibility.current.offer && !preferences.settings.athleteIntake) {
    if (!preferences.ready) return <View style={[styles.loading, { backgroundColor: colors.bg }]}><ActivityIndicator color={sectionAccent.train} />
      {preferences.error && <Pressable accessibilityRole="button" onPress={preferences.reload}><Text accessibilityRole="alert" style={{ color: colors.accentText }}>{t('settings.retry')}</Text></Pressable>}</View>;
    return <AthleteIntakeForm key={user.uid} welcome onSave={athleteIntake => preferences.change({ athleteIntake })} onCancel={() => undefined} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

function ThemedApp() {
  const { colors, scheme } = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
          <HealthExportProvider>
          <ExerciseCatalogueProvider>
          <TrainingNotesProvider>
          <MicrocycleReviewsProvider>
          <RehabilitationProvider>
          <ThemeProvider value={navigationThemeFor(scheme, colors)}>
          <WheelOverlayProvider>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            <AuthGate />
          </WheelOverlayProvider>
          </ThemeProvider>
          </RehabilitationProvider>
          </MicrocycleReviewsProvider>
          </TrainingNotesProvider>
          </ExerciseCatalogueProvider>
          </HealthExportProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return <AuthProvider><AppSettingsProvider><ThemedApp /></AppSettingsProvider></AuthProvider>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
