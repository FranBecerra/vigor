/** Human-facing names and exact execution aliases; stable IDs preserve history. */
export const EXERCISE_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  'guide-102': 'Jalón al pecho con agarre ancho',
  'guide-122': 'Remo bajo en máquina (espalda media)',
};

/** Aliases describe the named execution, not all exercises sharing its muscle. */
export const EXERCISE_NAME_ALIASES: Readonly<Record<string, readonly string[]>> = {
  'remo-alto-maquina-pecho-apoyado': ['Chest Supported High Machine Row', 'chest-supported high row'],
  'jalon-agarre-neutro': ['Neutral Grip Pull Down', 'neutral grip pulldown'],
  'press-inclinado-maquina': ['Incline Machine Chest Press'],
  'curl-concentrado': ['DB Concentration Curl', 'dumbbell concentration curl'],
  'curl-martillo': ['DB Hammer Curls', 'dumbbell hammer curls'],
  'guide-198': ['Low Cable Triceps Extension', 'seated overhead low cable triceps extension'],
  'extension-sobre-cabeza-polea': ['Low Cable Triceps Extension', 'overhead low cable triceps extension'],
  'elevacion-lateral-polea': ['Cable Lateral Raises', 'cable lateral raise'],
  'peso-muerto-rumano-maquina-encogimientos': ['Shrug Machine RDL', 'shrug machine Romanian deadlift'],
  'aduccion-cadera-maquina': ['Adduction Machine', 'hip adduction machine'],
  'sentadilla-libre': ['High Bar Squat', 'sentadilla barra alta'],
  'guide-315': ['Glute Bulgarian Squat', 'glute biased Bulgarian split squat'],
  'extension-cuadriceps-unilateral': ['Single Leg Extensions', 'single-leg extension', 'unilateral leg extension'],
  'curl-femoral-tumbado': ['Lying Leg Curl', 'lying leg curls'],
  'jalon-unilateral-maquina-inclinada': ['Single Hand Incline Pulldown Machine', 'incline unilateral machine pulldown'],
  'guide-122': ['Neutral Chest-Supported Low Row', 'remo bajo - low row énfasis en espalda alta'],
  'guide-102': ['Wide Pull Downs', 'wide grip pulldown', 'jalón al pecho focus espalda alta'],
  'curl-inclinado': ['Incline Dumbbell Curls', 'incline dumbbell curl'],
  'face-pull': ['Face Pulls'],
  'curl-femoral-sentado': ['Seated Leg Curl', 'seated leg curls'],
  'press-pecho-maquina': ['Machine Chest Press'],
  'press-inclinado-mancuernas': ['Incline Dumbbell Press'],
  'guide-179': ['High Cable Lateral Raises', 'hip height cable lateral raise'],
  'guide-164': ['Seated DB Lateral Raises', 'seated dumbbell lateral raises'],
  'pushdown-barra': ['High Cable Triceps Extension', 'high cable triceps pushdown'],
  'pushdown-cuerda': ['High Cable Triceps Extension', 'high cable triceps pushdown'],
  'extension-triceps-polea-alta': ['High Cable Triceps Extension', 'high cable triceps pushdown'],
  'guide-208': ['Katana Extensions', 'cable katana extension'],
};
