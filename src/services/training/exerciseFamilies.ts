/** Mechanical families used for redundancy, separate from broad movement coverage. */
import { ExerciseProfile, MovementVector, type Exercise } from '@/models';

export type HipFamily = 'TORSO_HINGE' | 'FLOOR_PULL' | 'SUPPORTED_THRUST' | 'SUPPORTED_EXTENSION' | 'UNVERIFIED';
export function hipFamily(exercise: Exercise): HipFamily | null {
  if (exercise.movementVector !== MovementVector.HIP_DOMINANT
    && exercise.movementVector !== MovementVector.HIP_EXTENSION_ISOLATED) return null;
  const label = `${exercise.id} ${exercise.name}`.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
  if (/HIP.?THRUST|HIPTHRUST|PUENTE|BRIDGE|FROG/.test(label)) return 'SUPPORTED_THRUST';
  if (/RUMANO|ROMANIAN|RDL|RIGIDAS|STIFF|BUENOS.DIAS|GOOD.MORNING|PULL.THROUGH/.test(label)) return 'TORSO_HINGE';
  if (/CONVENCIONAL|SUMO|DEFICIT|BLOQUES|RACK.PULL/.test(label)) return 'FLOOR_PULL';
  if (/HYPER|EXTENSIONES.*BANCO|GLUTE.HAM.RAISE/.test(label)) return 'SUPPORTED_EXTENSION';
  return 'UNVERIFIED';
}

/** A programming concentration heuristic, not a clinical or physiological veto. */
export function isDemandingTorsoHinge(exercise: Exercise): boolean {
  const family = hipFamily(exercise);
  return family === 'TORSO_HINGE' || family === 'FLOOR_PULL';
}

export function redundantSessionPair(left: Exercise, right: Exercise): boolean {
  if (left.id === right.id) return true;
  const a = hipFamily(left); const b = hipFamily(right);
  if (a && b) {
    if (a === 'UNVERIFIED' || b === 'UNVERIFIED') {
      return left.primaryMuscle === right.primaryMuscle && left.movementVector === right.movementVector;
    }
    // RDL and hip thrust are complementary families; two torso-demanding hinges
    // are still preferentially separated to preserve session quality.
    return a === b || (isDemandingTorsoHinge(left) && isDemandingTorsoHinge(right));
  }
  const bothCompound = left.profile !== ExerciseProfile.ISOLATION && right.profile !== ExerciseProfile.ISOLATION;
  if (bothCompound && left.movementVector === right.movementVector) return true;
  return left.primaryMuscle === right.primaryMuscle && left.movementVector === right.movementVector
    && left.profile === right.profile;
}
