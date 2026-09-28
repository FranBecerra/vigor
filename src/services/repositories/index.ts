/**
 * Repositorios concretos por dominio (Capa 2).
 *
 * Estructura de datos en Firestore, según el PRD:
 *  - Colecciones globales:  exercises (catálogo), mesocycles, workoutSessions,
 *    weeklyCheckIns, muscleGroupAnalytics, nutritionEntries, feedEvents.
 *  - Subcolecciones privadas del usuario (PRD §7, blindadas por reglas de
 *    seguridad):  users/{uid}/privateHealthData, users/{uid}/injuries,
 *    users/{uid}/painLogs, users/{uid}/rehabRoutines.
 *
 * Los datos clínicos y biomarcadores viven bajo users/{uid}/... para poder
 * blindarlos con reglas de Firebase (inaccesibles desde el exterior).
 */
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';
import { db } from '../firebase';
import { BaseRepository } from './BaseRepository';
import type {
  Exercise,
  Mesocycle,
  Routine,
  Microcycle,
  WorkoutSession,
  MicrocycleCheckIn,
  CardioSession,
  WeeklyVolumePlan,
  ReadinessScore,
  MuscleGroupAnalytics,
  InjuryTracker,
  RehabRoutine,
  PainLog,
  NutritionEntry,
  UserProfile,
  PrivateHealthData,
  FeedEvent,
} from '@/models';

// --- Colecciones globales -------------------------------------------------

export const exerciseRepository = new BaseRepository<Exercise>('exercises');
export const userProfileRepository = new BaseRepository<UserProfile>('users');
export const feedEventRepository = new BaseRepository<FeedEvent>('feedEvents');

/**
 * Rutinas: la plantilla de la que se instancian los mesociclos (PRD §3.6).
 *
 * Guarda la intención del atleta —split, sesiones, minutos, material, prioridades,
 * vetos y la semilla— además de su identidad visible. Empezar un bloque nuevo no
 * obliga a volver a responder la configuración.
 */
class RoutineRepository extends BaseRepository<Routine> {
  constructor() {
    super('routines');
  }

  /** Rutinas del usuario, para el acordeón de la pantalla de inicio. */
  listByUser(userId: string): Promise<Routine[]> {
    return this.listWhere('userId', userId);
  }

  /**
   * Applies activation flags in ONE batch. Separate writes could fail halfway and
   * leave two active routines, or none; the "only one active" rule needs atomicity.
   */
  async applyActivation(changes: readonly { id: string; isActive: boolean }[], now: number): Promise<void> {
    if (changes.length === 0) return;
    const batch = writeBatch(db);
    changes.forEach((change) =>
      batch.update(this.ref(change.id), { isActive: change.isActive, updatedAt: now }),
    );
    await batch.commit();
  }

  /**
   * Deletes a routine and its mesocycles in ONE batch, so a failure cannot leave a
   * mesocycle pointing at a routine that no longer exists. Executed sessions are
   * kept: they are the athlete's training history, not part of the plan.
   */
  async deleteWithMesocycles(routineId: string, mesocycleIds: readonly string[]): Promise<void> {
    const batch = writeBatch(db);
    mesocycleIds.forEach((id) => batch.delete(doc(collection(db, 'mesocycles'), id)));
    batch.delete(this.ref(routineId));
    await batch.commit();
  }
}
export const routineRepository = new RoutineRepository();

/** Mesociclos, con acceso al activo del usuario (PRD §3.1). */
class MesocycleRepository extends BaseRepository<Mesocycle> {
  constructor() {
    super('mesocycles');
  }

  /** Devuelve el mesociclo ACTIVE del usuario, o null si no hay ninguno. */
  async getActive(userId: string): Promise<Mesocycle | null> {
    const all = await this.listWhere('userId', userId);
    return all.find((m) => m.status === 'ACTIVE') ?? null;
  }

  /**
   * Historial de mesociclos de una rutina, para comparar bloques entre sí.
   *
   * Filters by owner as well: Firestore rejects a query its rules cannot prove is
   * limited to the caller's documents, and the rules check `userId`.
   */
  async listByRoutine(userId: string, routineId: string): Promise<Mesocycle[]> {
    const snap = await getDocs(
      query(this.col(), where('userId', '==', userId), where('routineId', '==', routineId)),
    );
    return snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as Mesocycle);
  }
}
export const mesocycleRepository = new MesocycleRepository();

/** Microciclos (bloques de N días dentro del mesociclo). */
class MicrocycleRepository extends BaseRepository<Microcycle> {
  constructor() {
    super('microcycles');
  }

  /** Microciclos de un mesociclo, para el roadmap y el calendario. */
  listByMesocycle(mesocycleId: string): Promise<Microcycle[]> {
    return this.listWhere('mesocycleId', mesocycleId);
  }
}
export const microcycleRepository = new MicrocycleRepository();

/** Sesiones de entrenamiento. */
class WorkoutSessionRepository extends BaseRepository<WorkoutSession> {
  constructor() {
    super('workoutSessions');
  }

  /** Todas las sesiones de un mesociclo, para reconstruir el historial. */
  listByMesocycle(mesocycleId: string): Promise<WorkoutSession[]> {
    return this.listWhere('mesocycleId', mesocycleId);
  }

  /** Sesiones de un microciclo concreto. */
  listByMicrocycle(microcycleId: string): Promise<WorkoutSession[]> {
    return this.listWhere('microcycleId', microcycleId);
  }

  /** Todas las sesiones del usuario, para el calendario de entrenamientos pasados. */
  listByUser(userId: string): Promise<WorkoutSession[]> {
    return this.listWhere('userId', userId);
  }
}
export const workoutSessionRepository = new WorkoutSessionRepository();

export const microcycleCheckInRepository =
  new BaseRepository<MicrocycleCheckIn>('microcycleCheckIns');

/** Sesiones de cardio (dominio separado de la fuerza, PRD §8.4). */
class CardioSessionRepository extends BaseRepository<CardioSession> {
  constructor() {
    super('cardioSessions');
  }

  listByMicrocycle(microcycleId: string): Promise<CardioSession[]> {
    return this.listWhere('microcycleId', microcycleId);
  }

  listByUser(userId: string): Promise<CardioSession[]> {
    return this.listWhere('userId', userId);
  }
}
export const cardioSessionRepository = new CardioSessionRepository();

/** Volumen semanal planificado (fuerza + cardio, PRD §8.1). */
export const weeklyVolumePlanRepository =
  new BaseRepository<WeeklyVolumePlan>('weeklyVolumePlans');
export const muscleGroupAnalyticsRepository =
  new BaseRepository<MuscleGroupAnalytics>('muscleGroupAnalytics');
export const nutritionEntryRepository =
  new BaseRepository<NutritionEntry>('nutritionEntries');

// --- Subcolecciones privadas del usuario (PRD §7) -------------------------
// Se construyen con el uid porque la ruta incluye el usuario.

export const privateHealthDataRepository = (userId: string) =>
  new BaseRepository<PrivateHealthData>(`users/${userId}/privateHealthData`);

export const injuryRepository = (userId: string) =>
  new BaseRepository<InjuryTracker>(`users/${userId}/injuries`);

export const painLogRepository = (userId: string) =>
  new BaseRepository<PainLog>(`users/${userId}/painLogs`);

export const rehabRoutineRepository = (userId: string) =>
  new BaseRepository<RehabRoutine>(`users/${userId}/rehabRoutines`);

/** Readiness / coach: estado del cuerpo, va en subcolección privada (PRD §7, §8.3). */
export const readinessScoreRepository = (userId: string) =>
  new BaseRepository<ReadinessScore>(`users/${userId}/readinessScores`);
