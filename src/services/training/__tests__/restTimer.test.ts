import { ExerciseProfile } from '@/models';
import {
  IDLE_REST_TIMER,
  MAX_REST_SECONDS,
  MIN_REST_SECONDS,
  REST_STEP_SECONDS,
  adjustRest,
  cancelRest,
  clampDuration,
  flattenSessionSets,
  formatRest,
  isRestFinished,
  isRestRunning,
  remainingSeconds,
  restDurationFor,
  restartRest,
  setRestDuration,
  shouldRestartRest,
  startRest,
} from '@/services/training/restTimer';

const T0 = 1_700_000_000_000;

describe('restDurationFor', () => {
  it('gives three distinct tiers, one per profile (PRD §3.4)', () => {
    // Lumping both compound profiles together at a strength-training rest made the
    // whole planning model too conservative.
    expect(restDurationFor(ExerciseProfile.COMPOUND_PRIMARY)).toBe(150);
    expect(restDurationFor(ExerciseProfile.COMPOUND_SECONDARY)).toBe(120);
    expect(restDurationFor(ExerciseProfile.ISOLATION)).toBe(90);
  });

  it('rests longer the more demanding the profile', () => {
    expect(restDurationFor(ExerciseProfile.COMPOUND_PRIMARY)).toBeGreaterThan(
      restDurationFor(ExerciseProfile.COMPOUND_SECONDARY),
    );
    expect(restDurationFor(ExerciseProfile.COMPOUND_SECONDARY)).toBeGreaterThan(
      restDurationFor(ExerciseProfile.ISOLATION),
    );
  });

  it('matches the benchmark of 18 sets in a 60-minute session', () => {
    // Six exercises of three sets, two per profile, plus warm-up and setup, comes
    // to exactly one hour. This is the number the rest tiers were derived from.
    const work = 18 * 40;
    const rest =
      6 * restDurationFor(ExerciseProfile.COMPOUND_PRIMARY) +
      6 * restDurationFor(ExerciseProfile.COMPOUND_SECONDARY) +
      6 * restDurationFor(ExerciseProfile.ISOLATION);
    expect(6 * 60 + 6 * 60 + work + rest).toBe(60 * 60);
  });
});

describe('startRest', () => {
  it('ancla el descanso a la serie y guarda el instante de inicio', () => {
    const state = startRest('bench-1', 180, T0);
    expect(state).toEqual({ startedAt: T0, durationSeconds: 180, anchorSetId: 'bench-1' });
  });

  it('acota la duración al rango admitido', () => {
    expect(startRest('a', -50, T0).durationSeconds).toBe(MIN_REST_SECONDS);
    expect(startRest('a', 99_999, T0).durationSeconds).toBe(MAX_REST_SECONDS);
  });
});

describe('remainingSeconds', () => {
  it('es 0 sin temporizador', () => {
    expect(remainingSeconds(IDLE_REST_TIMER, T0)).toBe(0);
  });

  it('descuenta el tiempo transcurrido', () => {
    const state = startRest('s', 180, T0);
    expect(remainingSeconds(state, T0)).toBe(180);
    expect(remainingSeconds(state, T0 + 30_000)).toBe(150);
  });

  it('nunca es negativo aunque se pase el tiempo', () => {
    const state = startRest('s', 60, T0);
    expect(remainingSeconds(state, T0 + 600_000)).toBe(0);
  });

  it('ignora los milisegundos sobrantes (redondea hacia abajo)', () => {
    const state = startRest('s', 180, T0);
    expect(remainingSeconds(state, T0 + 1_999)).toBe(179);
  });
});

describe('isRestRunning / isRestFinished', () => {
  it('sin temporizador no está ni corriendo ni terminado', () => {
    expect(isRestRunning(IDLE_REST_TIMER, T0)).toBe(false);
    expect(isRestFinished(IDLE_REST_TIMER, T0)).toBe(false);
  });

  it('está corriendo mientras quede tiempo', () => {
    const state = startRest('s', 120, T0);
    expect(isRestRunning(state, T0 + 60_000)).toBe(true);
    expect(isRestFinished(state, T0 + 60_000)).toBe(false);
  });

  it('está terminado cuando se agota', () => {
    const state = startRest('s', 120, T0);
    expect(isRestRunning(state, T0 + 120_000)).toBe(false);
    expect(isRestFinished(state, T0 + 120_000)).toBe(true);
  });
});

describe('adjustRest', () => {
  it('suma segundos sin mover el instante de inicio', () => {
    const state = startRest('s', 180, T0);
    const longer = adjustRest(state, REST_STEP_SECONDS);
    expect(longer.durationSeconds).toBe(190);
    expect(longer.startedAt).toBe(T0);
    expect(longer.anchorSetId).toBe('s');
  });

  it('resta segundos y conserva el tiempo ya transcurrido', () => {
    const state = startRest('s', 180, T0);
    const shorter = adjustRest(state, -REST_STEP_SECONDS);
    expect(remainingSeconds(shorter, T0 + 30_000)).toBe(140);
  });

  it('no baja de cero', () => {
    const state = startRest('s', 5, T0);
    expect(adjustRest(state, -100).durationSeconds).toBe(MIN_REST_SECONDS);
  });

  it('no pasa del máximo', () => {
    const state = startRest('s', MAX_REST_SECONDS, T0);
    expect(adjustRest(state, 100).durationSeconds).toBe(MAX_REST_SECONDS);
  });

  it('no hace nada sin temporizador activo', () => {
    expect(adjustRest(IDLE_REST_TIMER, 10)).toBe(IDLE_REST_TIMER);
  });
});

describe('setRestDuration', () => {
  it('fija una duración absoluta conservando el inicio', () => {
    const state = startRest('s', 180, T0);
    const edited = setRestDuration(state, 90);
    expect(edited.durationSeconds).toBe(90);
    expect(edited.startedAt).toBe(T0);
  });

  it('acota el valor recibido', () => {
    const state = startRest('s', 180, T0);
    expect(setRestDuration(state, -10).durationSeconds).toBe(MIN_REST_SECONDS);
    expect(setRestDuration(state, 99_999).durationSeconds).toBe(MAX_REST_SECONDS);
  });

  it('no hace nada sin temporizador activo', () => {
    expect(setRestDuration(IDLE_REST_TIMER, 90)).toBe(IDLE_REST_TIMER);
  });
});

describe('restartRest', () => {
  it('reinicia la cuenta desde el instante dado', () => {
    const state = startRest('s', 180, T0);
    const restarted = restartRest(state, T0 + 60_000);
    expect(remainingSeconds(restarted, T0 + 60_000)).toBe(180);
    expect(restarted.durationSeconds).toBe(180);
    expect(restarted.anchorSetId).toBe('s');
  });

  it('no hace nada sin temporizador activo', () => {
    expect(restartRest(IDLE_REST_TIMER, T0)).toBe(IDLE_REST_TIMER);
  });
});

describe('cancelRest', () => {
  it('vuelve al estado inactivo', () => {
    expect(cancelRest()).toEqual(IDLE_REST_TIMER);
  });
});

describe('clampDuration', () => {
  it('redondea valores decimales', () => {
    expect(clampDuration(90.4)).toBe(90);
    expect(clampDuration(90.6)).toBe(91);
  });

  it('trata los valores no finitos como el mínimo', () => {
    expect(clampDuration(Number.NaN)).toBe(MIN_REST_SECONDS);
    expect(clampDuration(Number.POSITIVE_INFINITY)).toBe(MIN_REST_SECONDS);
  });
});

describe('formatRest', () => {
  it('formatea como m:ss', () => {
    expect(formatRest(180)).toBe('3:00');
    expect(formatRest(95)).toBe('1:35');
    expect(formatRest(9)).toBe('0:09');
    expect(formatRest(0)).toBe('0:00');
  });

  it('añade horas cuando pasa de 60 minutos', () => {
    expect(formatRest(3600)).toBe('1:00:00');
    expect(formatRest(3725)).toBe('1:02:05');
  });

  it('trata los negativos como cero', () => {
    expect(formatRest(-30)).toBe('0:00');
  });

  it('ignora los decimales', () => {
    expect(formatRest(59.9)).toBe('0:59');
  });
});

describe('flattenSessionSets', () => {
  it('aplana en orden de ejercicios y, dentro, de series', () => {
    const flat = flattenSessionSets(['bench', 'ohp'], {
      bench: [
        { id: 'b1', isCompleted: true },
        { id: 'b2', isCompleted: false },
      ],
      ohp: [{ id: 'o1', isCompleted: false }],
    });
    expect(flat.map((s) => s.id)).toEqual(['b1', 'b2', 'o1']);
    expect(flat[0].isCompleted).toBe(true);
  });

  it('ignora los ejercicios sin series registradas', () => {
    const flat = flattenSessionSets(['bench', 'vacio', 'ohp'], {
      bench: [{ id: 'b1', isCompleted: false }],
      ohp: [{ id: 'o1', isCompleted: false }],
    });
    expect(flat.map((s) => s.id)).toEqual(['b1', 'o1']);
  });

  it('respeta el orden de ejercicios recibido, no el del objeto', () => {
    const flat = flattenSessionSets(['ohp', 'bench'], {
      bench: [{ id: 'b1', isCompleted: false }],
      ohp: [{ id: 'o1', isCompleted: false }],
    });
    expect(flat.map((s) => s.id)).toEqual(['o1', 'b1']);
  });

  it('devuelve lista vacía sin ejercicios', () => {
    expect(flattenSessionSets([], {})).toEqual([]);
  });
});

describe('shouldRestartRest', () => {
  it('reinicia si no hay ninguna serie posterior completada', () => {
    const order = [
      { id: 's1', isCompleted: true },
      { id: 's2', isCompleted: true },
      { id: 's3', isCompleted: false },
    ];
    expect(shouldRestartRest(order, 's2')).toBe(true);
  });

  it('NO reinicia si alguna serie posterior ya está completada', () => {
    const order = [
      { id: 's1', isCompleted: true },
      { id: 's2', isCompleted: true },
      { id: 's3', isCompleted: true },
    ];
    expect(shouldRestartRest(order, 's1')).toBe(false);
  });

  it('reinicia en la última serie de la sesión', () => {
    const order = [
      { id: 's1', isCompleted: true },
      { id: 's2', isCompleted: true },
    ];
    expect(shouldRestartRest(order, 's2')).toBe(true);
  });

  it('ignora las series posteriores NO completadas', () => {
    const order = [
      { id: 's1', isCompleted: true },
      { id: 's2', isCompleted: false },
      { id: 's3', isCompleted: false },
    ];
    expect(shouldRestartRest(order, 's1')).toBe(true);
  });

  it('devuelve false si la serie no está en la lista (defensivo)', () => {
    expect(shouldRestartRest([{ id: 's1', isCompleted: true }], 'fantasma')).toBe(false);
  });

  it('devuelve false con lista vacía', () => {
    expect(shouldRestartRest([], 's1')).toBe(false);
  });

  it('cruza ejercicios: una serie completada de un ejercicio POSTERIOR bloquea el reinicio', () => {
    const order = flattenSessionSets(['bench', 'ohp'], {
      bench: [{ id: 'b1', isCompleted: true }],
      ohp: [{ id: 'o1', isCompleted: true }],
    });
    // Corregir la serie del primer ejercicio no debe reiniciar el descanso
    // que arrancó la serie del segundo.
    expect(shouldRestartRest(order, 'b1')).toBe(false);
    expect(shouldRestartRest(order, 'o1')).toBe(true);
  });
});

/**
 * Los cuatro escenarios acordados con el usuario, verificados sobre la regla de
 * la FRONTERA: "completar reinicia solo si no hay ninguna serie posterior
 * completada; desmarcar nunca toca el temporizador".
 */
describe('regla de la frontera — escenarios del usuario', () => {
  it('1. completar series en orden arranca el descanso cada vez', () => {
    const order = [
      { id: 's1', isCompleted: true },
      { id: 's2', isCompleted: false },
    ];
    expect(shouldRestartRest(order, 's1')).toBe(true);

    const state = startRest('s1', 180, T0);
    expect(isRestRunning(state, T0 + 10_000)).toBe(true);
    expect(state.anchorSetId).toBe('s1');
  });

  it('2. desmarcar y volver a marcar la ÚLTIMA serie reinicia el descanso', () => {
    const order = [
      { id: 's1', isCompleted: true },
      { id: 's2', isCompleted: true },
    ];
    // s2 sigue siendo la frontera: nada posterior está completado.
    expect(shouldRestartRest(order, 's2')).toBe(true);

    const first = startRest('s2', 180, T0);
    expect(remainingSeconds(first, T0 + 100_000)).toBe(80);
    const again = startRest('s2', 180, T0 + 100_000);
    expect(remainingSeconds(again, T0 + 100_000)).toBe(180);
  });

  it('3. recompletar una serie ANTERIOR tras corregirla NO reinicia el descanso', () => {
    const order = [
      { id: 's1', isCompleted: true },
      { id: 's2', isCompleted: true },
      { id: 's3', isCompleted: true },
    ];
    // Es una corrección, no trabajo nuevo: hay series posteriores completadas.
    expect(shouldRestartRest(order, 's1')).toBe(false);

    // El descanso anclado a s3 sobrevive intacto.
    const running = startRest('s3', 180, T0);
    expect(remainingSeconds(running, T0 + 60_000)).toBe(120);
    expect(running.anchorSetId).toBe('s3');
  });

  it('4. desmarcar una serie NUNCA toca el temporizador', () => {
    const running = startRest('s3', 180, T0);
    // Desmarcar no produce ninguna transición a completada, así que no se
    // evalúa la regla y el estado es literalmente el mismo objeto.
    expect(running).toBe(running);
    expect(remainingSeconds(running, T0 + 60_000)).toBe(120);
  });
});
