/**
 * Shared Vigor Subtle design tokens (PRD §8.2).
 * Sage/charcoal surfaces, restrained ambient light and the existing lime brand.
 * Filled accents and readable accent text are deliberately separate tokens.
 */

/** Acento principal de marca (verde lima Vigor, distinto del neón de Ladder). */
export const BRAND_LIME = '#9BE317';

/** Session identity colours for illustrative split diagrams, never effort/volume scores. */
export const sessionPalette = ['#9BE317', '#54A9F8', '#F28B69', '#B295EF', '#E9BD4F', '#41BFA6', '#E990BC'] as const;

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
    bg: '#141A18',
    /** Tarjetas y superficies elevadas. */
    bgElevated: '#222B26',
    surface: '#2B3630',
    surfaceBorder: '#38453C',
    textPrimary: '#F0F5EE',
    textSecondary: '#AEBBB0',
    textMuted: '#9AA99D',
    accentText: '#B0E65C',
    onAccent: '#192509',
    controlBorder: '#748878',
    accentTint: '#31412B',
    bioTint: '#253D33',
    bioText: '#9AC7B2',
    ambient: 'rgba(86,119,56,0.15)',
    ambientClear: 'rgba(86,119,56,0)',
    highlight: 'rgba(235,255,237,0.07)',
    shadow: 'rgba(0,0,0,0.20)',
    scrim: 'rgba(0,0,0,0.58)',
    /** Body-map muscle with no volume or no emphasis. */
    muscleNeutral: '#3B4940',
  },
  light: {
    bg: '#F1F4EF',
    bgElevated: '#FCFDFB',
    surface: '#E8EDE5',
    surfaceBorder: '#DCE3DA',
    textPrimary: '#18231D',
    textSecondary: '#5E6B62',
    textMuted: '#5E6B62',
    accentText: '#426410',
    onAccent: '#192509',
    controlBorder: '#7A897D',
    accentTint: '#E1EDCE',
    bioTint: '#DFECE5',
    bioText: '#39634F',
    ambient: 'rgba(151,185,110,0.14)',
    ambientClear: 'rgba(151,185,110,0)',
    highlight: 'rgba(255,255,255,0.90)',
    shadow: 'rgba(32,51,34,0.09)',
    scrim: 'rgba(18,29,22,0.38)',
    muscleNeutral: '#D9E1D7',
  },
} as const;

/** Tipografía (escala minimalista). */
export const typography = {
  emphasis: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -1 },
  h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.7 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.4 },
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
