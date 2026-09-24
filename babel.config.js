/**
 * Configuración de Babel para Vigor.
 *
 * Babel es el "traductor" que convierte tu TypeScript/JSX moderno a JavaScript
 * que el motor del móvil entiende (transpilación).
 *
 * - `babel-preset-expo`: preset por defecto de Expo. Incluye el soporte de
 *   rutas `@/*` (alias de tsconfig) y todo lo necesario para React Native.
 * - `react-native-worklets/plugin`: requerido por Reanimated v4. Transforma las
 *   "worklets" (funciones que corren en el hilo de animaciones para ir a 120fps).
 *   DEBE ir el ÚLTIMO de la lista de plugins (requisito de la librería).
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
