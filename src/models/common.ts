/**
 * Tipos compartidos transversales a todos los modelos.
 */

/**
 * Marcador temporal compatible con Firestore Timestamp y con serialización local
 * offline-first (PRD §2.1). Se refina al integrar Firestore en la Capa 2.
 */
export type Timestampish = number | { seconds: number; nanoseconds: number };
