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

**`stimulusQuality`** — estímulo hipertrófico por serie, en escala 1-5. Es el peso con el que el generador elige. Pondera el estiramiento por encima de todo (0,35), luego el perfil de resistencia (0,25), el recorrido (0,20) y, con poco peso, progresión y estabilidad (0,10 cada uno). **La fatiga sistémica no entra**: un coste no es un estímulo.

**`fatigueCost`** — fatiga gastada por serie, escala 1-5 donde más es peor. Sale de `systemicFatigueCost` (0,75) y `stabilityCost` (0,25), invertidos. Gobierna dónde se coloca el trabajo y cuánto cabe, no si se elige.

`isTopTierStimulus` aplica la regla de la propia auditoría: 4 o más en estiramiento **y** en perfil de resistencia. Son 38 de los 113.

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
