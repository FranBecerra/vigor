/**
 * Módulo de Nutrición e IA Multimodal.
 * Fuente de verdad: PRD.md §6 (modelo 5), §5 (nutrición e IA).
 */
import type { Timestampish } from './common';

/** Perfil dietético inyectado en el contexto del LLM (PRD §5.2). */
export enum DietaryProfile {
  OMNIVORO = 'OMNIVORO',
  VEGETARIANO = 'VEGETARIANO',
  VEGANO = 'VEGANO',
  PISCITARIANO = 'PISCITARIANO',
}

/**
 * Un alimento dentro de la respuesta de Gemini (PRD §6 modelo 5).
 * isQuantityGuessed = true cuando el gramaje se estimó por tabla de
 * equivalencias sin pesaje del usuario (PRD §5.1).
 */
export interface NutritionAiFoodItem {
  foodName: string;
  brandHint?: string;
  estimatedGrams: number;
  isQuantityGuessed: boolean;
  /** Confianza del modelo 0-1. */
  confidenceScore: number;
}

/** Schema JSON destino de la Cloud Function nutricional (PRD §6 modelo 5). */
export interface NutritionAiResponse {
  foodItems: NutritionAiFoodItem[];
}

/** Fuente de datos nutricionales de un ítem resuelto (PRD §5.2). */
export type NutritionSource = 'OPEN_FOOD_FACTS' | 'BEDCA' | 'USDA' | 'AI_ESTIMATE';

/** Registro nutricional persistido tras resolver el ítem contra la BD híbrida (PRD §5.2). */
export interface NutritionEntry {
  id: string;
  userId: string;
  foodName: string;
  grams: number;
  isQuantityGuessed: boolean;
  source: NutritionSource;
  /** Macros y micros resueltos. Se refinan al integrar las APIs en la Capa 8. */
  macros?: {
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  micros?: Record<string, number>;
  loggedAt: Timestampish;
}
