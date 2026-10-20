/**
 * Stack anidado de la pestaña Entrenamiento (PRD §8.5, §8.6).
 *
 * Training keeps its own navigation stack. The parent hides native tabs while
 * a workout is open; leaving via the save/back action retains a resumable draft.
 *
 * Rutas:
 *  - `index`      → Inicio/Hoy (E1), pantalla de inicio de la pestaña.
 *  - `session`    → sesión de entrenamiento en curso (E2).
 *  - `mesocycle`  → vista del mesociclo (§8.7).
 *  - `generate`   → generación de un mesociclo nuevo (§8.8).
 */
import { Stack } from 'expo-router';
import { useTheme } from '@/theme/useTheme';

// SDK 57 uses anchor (initialRouteName is deprecated). Direct links and reloads
// into a training detail retain Home underneath them.
export const unstable_settings = { anchor: 'index' };

export default function TrainStackLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="session" />
      <Stack.Screen name="mesocycle" />
      <Stack.Screen name="generate" />
      <Stack.Screen name="create-routine" />
      <Stack.Screen name="manual-routine" />
      <Stack.Screen name="routine" />
      <Stack.Screen name="exercises" />
      <Stack.Screen name="rehab" />
      <Stack.Screen name="history" />
      <Stack.Screen name="performance" />
    </Stack>
  );
}
