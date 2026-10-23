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
import { View, ActivityIndicator, StyleSheet } from 'react-native';
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
import { AppSettingsProvider } from '@/hooks/useAppSettings';
import { TrainingNotesProvider } from '@/hooks/useTrainingNotes';

/**
 * Decide qué mostrar según el estado de sesión.
 *
 * Tres estados, no dos: mientras Firebase restaura la sesión del disco no se
 * sabe aún si hay usuario. Pintar el login en ese hueco provocaría un parpadeo
 * en cada arranque para un usuario que sí tiene sesión.
 */
function AuthGate() {
  const { user, isLoading } = useAuth();
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

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  const { colors, scheme } = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppSettingsProvider>
          <HealthExportProvider>
          <ExerciseCatalogueProvider>
          <TrainingNotesProvider>
          <RehabilitationProvider>
          <ThemeProvider value={navigationThemeFor(scheme)}>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            <AuthGate />
          </ThemeProvider>
          </RehabilitationProvider>
          </TrainingNotesProvider>
          </ExerciseCatalogueProvider>
          </HealthExportProvider>
          </AppSettingsProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
