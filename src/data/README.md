# Catálogo de ejercicios

Dos ficheros, con una división deliberada:

- **`exercises.json`** — el catálogo. Lo consume el algoritmo y se edita a mano.
- **`exercise-evidence.json`** — el respaldo de cada puntuación: grado de confianza, citas y una nota. **El algoritmo no lo lee.** Existe para poder explicar al usuario por qué entra un ejercicio y con cuánta certeza.

El algoritmo necesita números, la interfaz necesita prosa, y separarlos mantiene el catálogo editable a mano sin perder la trazabilidad.

Verifica el fichero con:

```bash
npm run catalogue                    # cobertura por músculo, vector y material
npm run catalogue -- --validate      # solo valida y sale
npm run catalogue -- --muscle=LATS   # detalle de un músculo, ordenado por estímulo
```

## Campos

| Campo | Significado |
|---|---|
| `id` | Identificador estable en kebab-case. **No lo cambies** una vez usado: lo referencian los mesociclos guardados y los vetos del usuario. |
| `name` | Nombre en español. Es la etiqueta que se muestra si no hay traducción. |
| `primaryMuscle` | Músculo que recibe la serie completa. |
| `secondaryMuscles` | Músculos que reciben **media serie** cada uno. Lista vacía si no hay. |
| `movementVector` | Patrón de movimiento. Uno de los 25 de `MovementVector`. |
| `profile` | `COMPOUND_PRIMARY`, `COMPOUND_SECONDARY` o `ISOLATION`. Determina el peso del MPI y el descanso. |
| `equipment` | Material necesario, para filtrar por disponibilidad. |
| `criteria` | Los seis criterios de la auditoría biomecánica, de 1 a 5. Ver abajo. |

## Los seis criterios

Sustituyen a la puntuación única de efectividad que el catálogo llevaba antes. Un solo número no puede expresar a la vez lo bueno y lo caro que es un ejercicio: la sentadilla libre carga el músculo en estiramiento máximo **y** drena la recuperación central, y un motor que lo colapsa en una cifra prescribe bloques que se degradan antes de acabar.

| Criterio | 1 | 5 |
|---|---|---|
| `stretchedPositionLoading` | tensión nula en elongación | tensión máxima en estiramiento |
| `rangeOfMotion` | excursión mínima | recorrido articular óptimo |
| `resistanceProfileMatch` | desajuste inverso severo | ajuste excelente con la curva de fuerza |
| `stabilityCost` | la inestabilidad limita la fuerza | estabilidad total o guiada |
| `loadProgressability` | progresión difusa | microprogresión medible |
| `systemicFatigueCost` | fatiga axial y central masiva | fatiga central y articular mínima |

**Ojo con la dirección de los dos últimos: 5 siempre es MEJOR.** En `stabilityCost` un 5 significa que la estabilidad **no** limita, y en `systemicFatigueCost` un 5 significa fatiga **mínima**. Así todos los criterios se leen igual.

## De los seis criterios salen dos magnitudes

`exerciseCatalogue.ts` deriva ambas; no se guardan en el JSON para que no puedan desincronizarse.

**`stimulusQuality`** — an ordinal selection heuristic on a 1–5 scale, not a measured hypertrophy effect size. Current weights are stretch loading 0.35, range of motion 0.27, load progression 0.23 and resistance-profile match 0.15. Stability and systemic fatigue are excluded from this score. The lower resistance-profile weight reflects uncertainty about its independent effect on long-term hypertrophy; the weights themselves are not trial-derived.

**`fatigueCost`** — fatiga gastada por serie, escala 1-5 donde más es peor. Sale de `systemicFatigueCost` (0,75) y `stabilityCost` (0,25), invertidos. Gobierna dónde se coloca el trabajo y cuánto cabe, no si se elige.

`isTopTierStimulus` is a legacy catalogue-report flag for scores of at least 4 on both stretch loading and resistance-profile match. It is not evidence that those exercises are clinically superior, and it is not used to override exercise fit or availability.

## Qué NO va aquí

- **Series, repeticiones y descansos.** Los decide el generador a partir del volumen y del perfil.
- **Traducciones.** El `name` es la etiqueta en español; la traducción se resuelve por clave `exercises.<id>`, con el `name` como respaldo.
- **Ejercicios personalizados del usuario.** Viven en Firestore con `isCustom: true` y sin `criteria`, así que reciben un perfil neutro de 3 en todo: ni se asumen buenos ni malos.

## Analizarlo fuera

```python
import json, pandas as pd
df = pd.json_normalize(json.load(open('src/data/exercises.json'))['exercises'])
df.groupby('primaryMuscle')['criteria.stretchedPositionLoading'].mean().sort_values()
```

`json_normalize` aplana `criteria` en columnas `criteria.stretchedPositionLoading`, así que el fichero sigue siendo tabular.

Si añades o cambias ejercicios, pasa `npm run catalogue -- --validate` antes de dar el cambio por bueno. Y si cambias un criterio, actualiza su entrada en `exercise-evidence.json`: una puntuación sin respaldo declarado es exactamente lo que la auditoría vino a eliminar.

## Sixth-edition guide import

`guide-exercises.json` indexes 337 numbered source pages. Seventy-nine pages link to existing catalogue IDs; 258 additional exercises are classified by `guideExerciseCatalogue.ts`. The disputed 90-degree/high-cable description on page 212 is no longer silently aliased to the original fully-overhead extension. The catalogue contains 379 unique entries. Imports remain `MANUAL_ONLY` until muscle credits, attributes and automatic-programming suitability have been checked individually.

The provisional rubric in `guideScoringRubric.ts` still applies to unreviewed imports; its neutral 3 is not evidence. The 30 imported entries in the individually inspected triceps section (pages 197-231) no longer carry those generic point ratings. `tricepsSourceReview.ts` records described geometry, default implement, support, laterality, hybrid roles and contradictions. Broad five-dimension uncertainty bands are diagnostic hypotheses, not production scores. Resistance-profile matching remains unknown; original alias ratings are retained but not validated by this source-mechanics pass. Generate the detailed ledger with `node --import tsx scripts/report-triceps-review.ts`.

The refreshed screening ledger is generated with `node --import tsx scripts/review-catalogue.ts --output-prefix=docs/audits/2026-10-01-catalogue-review`. The default output is `catalogue-review-latest`, preventing silently overwriting a dated historical artifact. It lists all entries, criterion provenance and unresolved biomechanical checks; screening is not completed scientific verification. Full source descriptions established six earlier corrected classifications: shoulder extension on page 159, fitball on 277, bands on 305/311, and bodyweight on 347/367. Required apparatus and surfaces are not fully represented by the single implement field; GHD, sliding surfaces, independent cable stations and attachment modelling remain open.
