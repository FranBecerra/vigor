/**
 * Stack anidado de la pestaña Entrenamiento (PRD §8.5, §8.6).
 *
 * Por qué un stack DENTRO de la pestaña y no una ruta al margen de las
 * pestañas: el usuario quiere poder consultar Bio o Nutrición mientras entrena,
 * así que la barra de pestañas debe seguir visible durante la sesión. Anidando
 * aquí, al empujar `session` la barra permanece; si la sesión viviera fuera del
 * grupo `(tabs)`, la taparía.
 *
 * Rutas:
 *  - `index`      → Inicio/Hoy (E1), pantalla de inicio de la pestaña.
 *  - `session`    → sesión de entrenamiento en curso (E2).
 *  - `mesocycle`  → vista del mesociclo (§8.7).
 *  - `generate`   → generación de un mesociclo nuevo (§8.8).
 */
import { Stack } from 'expo-router';

export default function TrainStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="session" />
      <Stack.Screen name="mesocycle" />
      <Stack.Screen name="generate" />
    </Stack>
  );
}
