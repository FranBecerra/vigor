import { MuscleGroup } from '@/models';
import { bodyHalfOf, exerciseMuscleTags, groupByBodyHalf, LOWER_BODY_MUSCLES } from '../muscleGroups';

describe('bodyHalfOf', () => {
  it('pone en pierna cuádriceps, isquios, glúteo, aductores, gemelo y tibial', () => {
    expect([...LOWER_BODY_MUSCLES].map(bodyHalfOf)).toEqual(Array(6).fill('LOWER'));
  });

  it('pone en torso el resto, incluidos core, lumbar, antebrazo y cuello', () => {
    const upper = Object.values(MuscleGroup).filter((muscle) => !LOWER_BODY_MUSCLES.has(muscle));
    expect(upper).toEqual(expect.arrayContaining([MuscleGroup.CORE, MuscleGroup.ERECTORS,
      MuscleGroup.FOREARMS, MuscleGroup.NECK, MuscleGroup.CHEST]));
    expect(upper.map(bodyHalfOf)).toEqual(Array(upper.length).fill('UPPER'));
  });
});

describe('groupByBodyHalf', () => {
  it('separa torso y pierna conservando el orden de entrada', () => {
    const entries = [
      { muscle: MuscleGroup.TRICEPS, sets: 18 },
      { muscle: MuscleGroup.GLUTES, sets: 8.5 },
      { muscle: MuscleGroup.CHEST, sets: 10 },
      { muscle: MuscleGroup.QUADS, sets: 8 },
    ];
    expect(groupByBodyHalf(entries)).toEqual([
      { half: 'UPPER', entries: [entries[0], entries[2]] },
      { half: 'LOWER', entries: [entries[1], entries[3]] },
    ]);
  });

  it('omite el bloque vacío', () => {
    expect(groupByBodyHalf([{ muscle: MuscleGroup.QUADS }])).toEqual([
      { half: 'LOWER', entries: [{ muscle: MuscleGroup.QUADS }] },
    ]);
  });

  it('sin entradas no devuelve bloques', () => {
    expect(groupByBodyHalf([])).toEqual([]);
  });
});

describe('exerciseMuscleTags', () => {
  it('primero el principal y después los secundarios', () => {
    expect(exerciseMuscleTags({ primaryMuscle: MuscleGroup.TRICEPS,
      secondaryMuscles: [MuscleGroup.CHEST, MuscleGroup.DELTS_FRONT] })).toEqual([
      { muscle: MuscleGroup.TRICEPS, role: 'primary' },
      { muscle: MuscleGroup.CHEST, role: 'secondary' },
      { muscle: MuscleGroup.DELTS_FRONT, role: 'secondary' },
    ]);
  });

  it('no repite el principal ni los secundarios duplicados', () => {
    expect(exerciseMuscleTags({ primaryMuscle: MuscleGroup.CHEST,
      secondaryMuscles: [MuscleGroup.CHEST, MuscleGroup.TRICEPS, MuscleGroup.TRICEPS] })).toEqual([
      { muscle: MuscleGroup.CHEST, role: 'primary' },
      { muscle: MuscleGroup.TRICEPS, role: 'secondary' },
    ]);
  });

  it('sin secundarios devuelve solo el principal', () => {
    expect(exerciseMuscleTags({ primaryMuscle: MuscleGroup.BICEPS, secondaryMuscles: [] }))
      .toEqual([{ muscle: MuscleGroup.BICEPS, role: 'primary' }]);
  });
});
