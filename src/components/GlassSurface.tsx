/**
 * GlassSurface — superficie de Liquid Glass con fallback seguro (PRD §8.2).
 *
 * Usa el `GlassView` nativo de expo-glass-effect (material real de Apple) cuando
 * está disponible (iOS 26+). En iOS<26 / Android / betas sin la API, cae a un
 * `View` con el material base del tema, para NO crashear (se comprueba con
 * isGlassEffectAPIAvailable()).
 *
 * Cristal "sutil y puntual" (PRD §8.2): pensado para barra de pestañas y tarjetas
 * clave, no para todas las superficies.
 */
import { View, type ViewProps, type ViewStyle } from 'react-native';
import {
  GlassView,
  isGlassEffectAPIAvailable,
  type GlassStyle,
} from 'expo-glass-effect';
import { useTheme } from '@/theme/useTheme';

/**
 * Interruptor de desarrollo para MEDIR el coste del cristal.
 *
 * Ponlo en `false` para comprobar si el material Liquid Glass es lo que hace ir
 * lenta la interfaz: con `false` esta superficie cae al material plano del tema,
 * con un aspecto muy parecido. El simulador de iOS NO tiene aceleración real
 * para los materiales de Apple, así que el cristal puede ser caro ahí y
 * prácticamente gratis en un iPhone físico.
 *
 * Es un cambio solo-JS: basta con recargar Metro (`r`), sin recompilar.
 */
const GLASS_ENABLED = true;

interface GlassSurfaceProps extends ViewProps {
  /** Estilo del cristal nativo cuando está disponible. */
  glassEffectStyle?: GlassStyle;
  /** Tinte opcional del cristal. */
  tintColor?: string;
  style?: ViewStyle | ViewStyle[];
}

export function GlassSurface({
  children,
  style,
  glassEffectStyle = 'regular',
  tintColor,
  ...rest
}: GlassSurfaceProps) {
  const { colors } = useTheme();

  // Camino nativo: material real de Apple (iOS 26+).
  // GLASS_ENABLED permite desactivarlo para medir su coste (ver arriba).
  if (GLASS_ENABLED && isGlassEffectAPIAvailable()) {
    return (
      <GlassView
        style={style}
        glassEffectStyle={glassEffectStyle}
        tintColor={tintColor}
        {...rest}>
        {children}
      </GlassView>
    );
  }

  // Fallback: superficie translúcida del tema (sin crash en plataformas sin API).
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.surfaceBorder,
          borderWidth: 1,
        },
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}
