/**
 * Design tokens de Vigor (PRD §8.2).
 * Fuente ÚNICA de verdad del sistema visual. Ninguna pantalla hardcodea colores.
 *
 * Estética: minimalista + Liquid Glass, base oscura, apariencia auto (claro/oscuro).
 * Acento principal: verde lima desplazado del de Ladder (más verde/con cuerpo,
 * menos neón ácido) para diferenciación de marca.
 */

/** Acento principal de marca (verde lima Vigor, distinto del neón de Ladder). */
export const BRAND_LIME = '#9BE317';

/** Acentos por sección (misma familia armónica verde→ámbar, PRD §8.2). */
export const sectionAccent = {
  train: BRAND_LIME, // Entrenar
  bio: '#3FE0A9', // Bio (verde menta)
  nutrition: '#A8D84A', // Nutrición (verde salvia)
  progress: '#5CCf9E', // Progreso (fase 2, misma familia)
  profile: '#9BE317', // Perfil (usa el principal)
} as const;

/** Colores semánticos — MANDAN sobre el acento de sección cuando aplican (PRD §8.2). */
export const semantic = {
  danger: '#F2453D', // dolor agudo / lesión AGUDA (EVA alto)
  /**
   * AVISO: algo que reclama atención — trigger de deload por estancamiento,
   * fatiga elevada, descanso agotado. NO usar para la descarga planificada.
   */
  warning: '#F2B03A',
  /**
   * DESCARGA PLANIFICADA (verde aguamarina).
   *
   * Deliberadamente distinto del ámbar: un microciclo de descarga es parte
   * normal del plan, no una alerta. Reservar el ámbar para lo que de verdad
   * avisa. Coincide con el extremo "lejos del fallo" de la rampa de RIR, lo que
   * es coherente: la descarga ES baja intensidad.
   */
  deload: '#3FE0A9',
  success: BRAND_LIME, // progreso positivo
} as const;

/** Paleta por esquema de apariencia. */
export const palette = {
  dark: {
    /** Fondo base: carbón, NO negro puro (referencia Bevel: menos brusco). */
    bg: '#16191C',
    /** Tarjetas y superficies elevadas. */
    bgElevated: '#23272B',
    surface: 'rgba(255,255,255,0.06)', // material base bajo el cristal
    surfaceBorder: 'rgba(255,255,255,0.07)',
    textPrimary: '#F0F2F4',
    textSecondary: '#9AA1A8',
    textMuted: '#6B7279',
    /** Body-map muscle with no volume or no emphasis. */
    muscleNeutral: '#3A3F45',
  },
  light: {
    bg: '#F2F3F5',
    bgElevated: '#FFFFFF',
    surface: 'rgba(0,0,0,0.04)',
    surfaceBorder: 'rgba(0,0,0,0.07)',
    textPrimary: '#16191C',
    textSecondary: '#5A6068',
    textMuted: '#8E959C',
    muscleNeutral: '#DADDE1',
  },
} as const;

/** Tipografía (escala minimalista). */
export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  title: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  metric: { fontSize: 13, fontWeight: '700' as const }, // datos clave (MPI, %)
} as const;

/** Espaciado (múltiplos de 4). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * Radios de esquina. Generosos por decisión estética (referencia Bevel):
 * tarjetas muy redondeadas, sensación suave.
 */
export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

/**
 * Duraciones de animación (ms). Las transiciones de estado deben ser SUAVES,
 * nunca de todo a nada (p. ej. el fondo al completar una serie).
 */
export const motion = {
  fast: 140,
  normal: 240,
  slow: 380,
} as const;

export type ColorScheme = keyof typeof palette;
export type SectionKey = keyof typeof sectionAccent;
