# Documento de Requisitos de Producto (PRD): Ecosistema Integral para Atletas

**Estado:** En Definición (MVP Exhaustivo)  
**Plataformas:** iOS y Android (Cross-platform)  
**Ecosistema Tecnológico:** React Native, Firebase Firestore, Google Cloud, Apple HealthKit

---

## 1. Visión del Producto y Alcance del MVP
El mercado actual de aplicaciones deportivas opera en silos: registro de hipertrofia desconectado de la fatiga sistémica, y monitoreo nutricional que exige alta fricción manual. Esta plataforma se concibe como un ecosistema holístico fundamentado en ciencia deportiva contemporánea (consenso 2024-2026), diseñado para integrar la gestión de volumen estático (MEAV), la autorregulación mediante RIR/RPE, la rehabilitación clínica de lesiones y un seguimiento nutricional multimodal por voz de fricción cero[cite: 1, 2].

**Objetivos del MVP:**
- Eliminar la fricción del registro nutricional y de entrenamiento mediante IA y UX predictiva.
- Proteger el Sistema Nervioso Central (SNC) y las articulaciones del atleta mediante una periodización basada en rendimiento agregado y un sistema de veto biomecánico[cite: 1].
- Centralizar biomarcadores de salud (HRV, RHR) para contextualizar el rendimiento físico[cite: 1].
- Brindar valor desde el minuto 1 a través de visualización clara de la trayectoria del mesociclo, autorregulación intuitiva y sustitución ágil de ejercicios[cite: 1].

---

## 2. Arquitectura de Software y Ecosistema Tecnológico

### 2.1. Stack Frontend
- **Framework:** React Native gestionado mediante Expo (New Architecture activada con Fabric Renderer y TurboModules) para garantizar un código base único (~90% compartido) con rendimiento nativo a 120 fps en iOS y Android[cite: 1].
- **Estado y Caché Local:** Implementación Offline-First estricta[cite: 1]. La aplicación debe ser 100% operativa sin conexión a red (situación habitual en sótanos o gimnasios), utilizando la caché persistente nativa de Firestore[cite: 1].
- **Integración de Hardware:** Uso de AVAudioSession en iOS para enrutar las alertas de los temporizadores a través del canal de "Timbre" (Ringer), garantizando avisos acústicos incluso en modo silencio, complementados con CoreHaptics para respuestas físicas intensivas[cite: 1].

### 2.2. Stack Backend y Servicios Cloud
- **Base de Datos:** Firebase Firestore (NoSQL Documental) para almacenamiento descentralizado y escalabilidad de esquemas de datos, respaldado por Firebase Authentication (Google/Apple Sign-In)[cite: 1].
- **Lógica Serverless:** Firebase Cloud Functions (TypeScript) para la ejecución de algoritmos de periodización pesados y comunicación con APIs externas[cite: 1].
- **Motor de Inteligencia Artificial:** Integración de la API de Google Gemini (Multimodal) para el pipeline de Voice-to-JSON en el módulo de nutrición[cite: 1].

### 2.3. Ecosistema de Salud y Wearables
- **iOS:** Apple HealthKit (lectura bidireccional de entrenamientos, gasto energético, VO2 max, HRV [SDNN/rMSSD] y Frecuencia Cardíaca en Reposo)[cite: 1].
- **Android:** Google Health Connect[cite: 1].

---

## 3. Entrenamiento de Fuerza y Periodización (Modelo de Volumen Estático)

El sistema abandona el modelo clásico de adición lineal semanal de series intra-mesociclo[cite: 1, 2]. Se adopta el modelo de **Volumen Estático basado en MEAV (Minimum Effective Adaptive Volume)**, donde la progresión recae sobre la carga (kg), repeticiones y e1RM, ajustando el volumen únicamente entre mesociclos[cite: 1, 2].

### 3.1. Arquitectura del Mesociclo y Observabilidad
Los mesociclos carecen de duración estática predefinida[cite: 1, 2]. Evolucionan de forma fluida y se interrumpen o recalculan según las métricas de recuperación[cite: 1, 2].
- **Microciclos definidos por SESIONES, no por días:** El mesociclo se divide en **microciclos**, bloques compuestos por un **número fijo de sesiones** (`sessionsPerMicrocycle`). La estructura es **uniforme**: todos los microciclos de un mesociclo tienen **siempre el mismo número de sesiones**, y se diferencian entre sí en la **intensidad** (principalmente) y en pequeños ajustes de **volumen**. El sistema **no modela duración en días en ningún nivel**: un microciclo de 6 sesiones puede completarse en 6 días o en 9 porque el usuario intercale descansos, y eso **no se refleja ni se muestra**. Que una sesión se retrase es asunto del atleta, no del modelo. `startedAt`/`completedAt` existen solo para ordenar el histórico, nunca para presentar una duración. Toda la observabilidad, la progresión y el stall detection se anclan al **microciclo**, no a la semana natural ni al calendario.
- **Proyección Visual (Roadmap):** La UI mostrará una línea temporal proyectada (no determinista) mediante líneas punteadas para el mesociclo actual[cite: 1]. Indica al atleta el horizonte estimado del bloque en nº de microciclos (ej. "Microciclo 1 -> ~Microciclo 6"), remarcando mediante el diseño que el final depende de sus biomarcadores y progreso, no de un calendario estricto[cite: 1].
- **Check-in de Observabilidad por Microciclo:** Al cerrar cada microciclo, se requiere un input ultrarrápido[cite: 1]:
  - `Recovery Score (1-10)`: Promedio subjetivo de sueño, energía y motivación[cite: 1, 2].
  - `Fatigue Score`: Sensación articular, pesadez del SNC y cuadre de RPE[cite: 1, 2].

### 3.1.b. Histórico de Ejercicios y Calendario de Entrenamientos (UI)
- **Histórico por Ejercicio:** Vista consultable de la progresión de cada ejercicio a lo largo del tiempo (series, cargas, reps, e1RM por sesión), derivada de las `WorkoutSession` almacenadas. Permite al atleta ver su evolución en un levantamiento concreto y contextualiza la sugerencia de carga de la siguiente sesión.
- **Calendario de Entrenamientos Pasados:** Vista de calendario que marca los días entrenados y permite abrir cualquier sesión pasada para revisar su detalle. Se alimenta de `WorkoutSession.performedAt` filtradas por usuario.

### 3.2. Rendimiento Agregado: Índice de Progreso Muscular (MPI) y e1RM Ponderado
Para evitar que una mala semana en un levantamiento aislado (ej. press de banca plano) falsee el estado de adaptación del grupo muscular completo cuando los ejercicios accesorios o secundarios progresan, el sistema evalúa el rendimiento a nivel de **grupo muscular agregado** mediante variaciones relativas normalizadas:

1. **Tasa de Variación Relativa por Ejercicio ($\Delta \text{e1RM}_{i}$):**
   $$\Delta \text{e1RM}_{i} = \frac{\text{e1RM}_{i, \text{actual}} - \text{e1RM}_{i, \text{baseline}}}{\text{e1RM}_{i, \text{baseline}}}$$
   Donde el $\text{baseline}$ corresponde a la mejor marca de e1RM registrada en los microciclos iniciales del bloque.

2. **Ponderación Biomecánica ($w_i$):**
   - Multiarticular Primario (Banca plana, Sentadilla, Peso Muerto): $w_i = 0.50$
   - Multiarticular Secundario / Guiado (Press inclinado mancuernas, Hack): $w_i = 0.35$
   - Aislamiento (Cruces en polea, Extensiones): $w_i = 0.15$

3. **Índice de Progreso Muscular (MPI):**
   $$\text{MPI}_{\text{Grupo}} = \frac{\sum (w_i \cdot \Delta \text{e1RM}_{i})}{\sum w_i}$$
   *Tolerancia a Swaps:* Si un ejercicio se sustituye u omite durante una sesión, se recalcula dinámicamente el conjunto de pesos normalizando $\sum w_i = 1$ para no distorsionar el índice semanal.

### 3.3. Triggers de Descarga (Deload Automático)
El algoritmo forzará una semana de descarga (Volumen -50%, Carga 85-90%, RIR +3/4) bajo los siguientes escenarios[cite: 1, 2]:
1. **Estancamiento de Rendimiento por Grupo:** Durante 2 semanas consecutivas el $\text{MPI}_{\text{Grupo}} \le 0\%$ de forma generalizada en los vectores principales, combinado con un `Recovery Score` < 5 o un `Fatigue Score` alto[cite: 1, 2].
2. **Safety Override (Molestias Físicas):** Aparición o agravamiento repentino de dolor articular (EVA > 4) reportado en la sesión, forzando un retroceso preventivo o descarga inmediata[cite: 1].
3. **Aborto Manual:** Botón de interrupción si el usuario requiere frenar por motivos personales (vacaciones, enfermedad, saturación)[cite: 1, 2]. Se pasa al estado `INTERRUPTED` para guardar los datos y recalcular el siguiente bloque sin descartar el progreso[cite: 1, 2].

### 3.4. Autorregulación Científica (Matriz RIR) y Ejecución
- **Compuestos Axiales (Sentadilla, Peso Muerto, Remos libres):** Inicio en RIR 3[cite: 1]. Tope máximo rutinario en RIR 2[cite: 1]. Alcanzan RIR 1 o 0 **únicamente** en la serie final de la última semana previa a la descarga para proteger el SNC[cite: 1].
- **Máquinas Multiarticulares (Prensas, Jalones):** Inicio en RIR 2[cite: 1]. Pueden progresar a RIR 1-0 en semanas finales[cite: 1].
- **Ejercicios de Aislamiento:** Inicio en RIR 2[cite: 1]. Progresión rutinaria y permitida hasta el fallo técnico (RIR 0)[cite: 1].
- **Fatigue Auto-fill (UX):** Si el rendimiento decae respecto al pautado, el sistema pre-rellena los campos de la siguiente serie sugiriendo un ajuste a la baja (carga/reps) en color tenue, requiriendo un solo tap de confirmación[cite: 1].
- **Cronómetro Inteligente:** Integrado globalmente en la cabecera[cite: 1]. Tiempos por defecto asignados por perfil biomecánico: 120s para aislamiento, 180s o superior para multiarticulares pesados[cite: 1].

### 3.5. Motor de Sustitución en Cascada (Swap)
Accesible desde un menú contextual (...)[cite: 1]. Las alternativas se ordenan bajo las siguientes reglas algorítmicas descendentes[cite: 1]:
1. **Vector de Movimiento Exacto:** (Ej. Empuje horizontal libre -> Empuje horizontal en máquina convergente)[cite: 1].
2. **Primary muscle group:** the three deltoid heads remain separate, while chest is one group. Horizontal-row retractors are grouped as `MID_BACK`, and cervical muscles plus upper trapezius are grouped as `NECK`. Exercise angle remains a stimulus tag rather than a separate volume budget.
3. **Ejercicios Personalizados:** Los inputs creados por el usuario (solo requieren Nombre y Músculo) se apilan al final si carecen de mapeo biomecánico profundo[cite: 1].

### 3.7. Mesociclo de fuerza

El objetivo de fuerza **no** es hipertrofia con menos repeticiones. Los básicos se **prescriben**, no se sortean: la especificidad es el objetivo. Implementación en `services/training/strengthProgram.ts`; se activa cuando el objetivo es `STRENGTH`.

**Estructura por rol** (`StrengthRole`, persistido en `PlannedExercise.strengthRole`):

| Rol | Ejercicios | Reps | Descanso | RIR µ1 → último |
|---|---|---|---|---|
| MAIN | sentadilla trasera, press de banca, peso muerto convencional (fijos por id) | 3-5 | 240 s | 3 → 1 |
| VARIANT | sentadilla con pausa o frontal, banca con pausa o cerrada, peso muerto con déficit o desde bloques (por semilla) | 3-6 | 240 s | 3 → 1 |
| COMPLEMENTARY | press militar, remo con apoyo en el pecho, dominadas | 4-6 | 180 s | 3 → 1 |
| ACCESSORY | bisagra accesoria (rumano, buenos días), core antimovimiento, tríceps, espalda alta, una por región prioritaria | 6-10 | 120 s / 90 s | 2 → 1 |

- **Frecuencia por exposiciones explícitas.** Sentadilla 2 (3 desde 5 sesiones), banca 2 (3 desde 4), peso muerto 1 (2 desde 4, con variante), complementarios 1 (2 desde 5). Un mismo patrón principal nunca se repite en una sesión.
- **Single pesado** a RPE 8 (`SetType.TOP_SINGLE`) al empezar la primera exposición de cada básico, en intermedio y avanzado. El principiante repite el básico en lugar de una variante y no hace singles.
- **Regla del 60 %.** Básicos y variantes suman al menos el 60 % de las series; el resto entra por prioridad solo mientras la proporción se mantiene.
- **Ajuste al tiempo.** Cada exposición es una plaza con prioridad. Se entra de forma voraz: se prueban de mayor a menor prioridad y entra cada una que quepa. Los accesorios caen antes que las variantes y los tres días pesados son lo último. Si ni esos caben, `insufficient-time`.
- **Sin barra**: los básicos se sustituyen por el multiarticular más cercano del mismo patrón y la previsualización avisa. Convencional por defecto; el sumo queda a un cambio de distancia.
- **Variantes** marcadas `generationTier: STRENGTH_VARIANT`: la selección de hipertrofia no las elige nunca.
- **Horizonte**: 5 microciclos de acumulación más descarga. `prescriptionForMicrocycle` deriva la rampa de RIR y la descarga (≈55 % de las series por ejercicio, +2 RIR, carga ×0,9, sin single) desde el primer microciclo almacenado.
- **Carga (%1RM)**: solo con e1RM (`toPlannedSessions(..., { e1rmByExerciseId })`), invirtiendo Epley sobre `reps + RIR` y redondeando a 2,5 kg hacia abajo. El primer mesociclo va por RIR.
- **RIR por serie siempre entero** (`clampSetRIR`): una reserva de 2,5 repeticiones no se puede ejecutar.

---

## 4. Especificación Funcional: Sistema Clínico de Lesiones y Rehabilitación

El modelo desacopla el dolor de la fatiga muscular, protegiendo las estructuras pasivas[cite: 1].

### 4.1. Fases del Protocolo de Readaptación
Las lesiones registradas (InjuryTracker) transicionan entre cuatro estados con acciones automatizadas por el sistema[cite: 1]:
1. **Fase Aguda (Activa/Inflamación):** Veto absoluto[cite: 1]. El algoritmo bloquea y sustituye automáticamente cualquier ejercicio que involucre el vector de movimiento asociado a la articulación afectada[cite: 1].
2. **Fase Subaguda:** Mantenimiento del veto dinámico, permitiendo exclusivamente reintroducción de trabajo isométrico analítico si se prescribe[cite: 1].
3. **Fase de Readaptación:** Reintroducción progresiva (tempos lentos, fases excéntricas controladas, cumplimiento del volumen sin dolor)[cite: 1].
4. **Fase Resuelta:** Retorno al volumen estándar[cite: 1]. El sistema mantiene monitorización pasiva (alertas) durante dos mesociclos completos[cite: 1].

### 4.2. Bloques de Rehabilitación y Triggers (Pain Tracking)
- **Pre/Post-Workout Blocks:** Rutinas accesorias no fatigantes (ej. manguito rotador, epicondilitis) que no computan en el volumen semanal de hipertrofia[cite: 1]. Se muestran como tarjetas opt-in al inicio o fin del entreno con opción de saltar en 1 solo tap[cite: 1].
- **Trigger de Evaluación EVA (0-10):** El sistema lanza una alerta modal de "1 tap" post-entrenamiento si[cite: 1]:
  1. El usuario ha ejecutado ejercicios que involucran una articulación con estado AGUDA o SUBAGUDA[cite: 1].
  2. El usuario ha completado un bloque de RehabRoutine[cite: 1].

---

## 5. Especificación Funcional: Módulo de Nutrición e IA Multimodal

### 5.1. UX de Fricción Cero por Voz
- **Entrada Manos Libres:** El registro se efectúa mediante notas de audio procesadas directamente por modelos multimodales (Gemini)[cite: 1].
- **Resolución de Ambigüedad:** Si el usuario omite el pesaje (ej. "Me he comido un plato de lentejas y un plátano"), el sistema jamás interrumpe con preguntas de confirmación[cite: 1]. Asigna el gramaje mediante una tabla de equivalencias estandarizada (ej. Plato hondo = 250g) y guarda el registro con un flag booleano de `Cantidad Estimada`[cite: 1].

### 5.2. Arquitectura de Inyección de Prompt y Seguridad de Datos
- **Inyección de Perfil Dietético:** El estado dietético del usuario (OMNIVORO, VEGETARIANO, VEGANO, PISCITARIANO) se inyecta por sistema en el contexto del LLM[cite: 1].
- **Prevención de Alucinaciones Alimentarias:** Si un perfil VEGANO dicta vocabulario ambiguo ("hamburguesa", "leche"), las reglas del sistema obligan a la IA a mapear la consulta hacia ingredientes basados en plantas en la base de datos (proteína vegetal, leches vegetales), evitando fallos de transcripción clásicos[cite: 1].
- **Base de Datos Híbrida:** 
  - Productos procesados: API de Open Food Facts (lectura de código de barras)[cite: 1].
  - Materias primas: BEDCA (España) y USDA FoodData Central para extracción profunda de micronutrientes (Zinc, Hierro, Vitaminas del grupo B)[cite: 1].

---

## 6. Modelado de Datos: Esquemas Principales (Firestore TypeScript Interfaces)

```typescript
// 1. Taxonomía de Ejercicios y Biomecánica
enum MuscleGroup {
  DELTS_FRONT, DELTS_LATERAL, DELTS_REAR,
  NECK, MID_BACK,
  CHEST, LATS, ERECTORS,
  QUADS, HAMSTRINGS, GLUTES, ADDUCTORS, CALVES, TIBIALIS,
  BICEPS, TRICEPS, CORE
}

enum MovementVector {
  PUSH_HORIZONTAL, PUSH_VERTICAL,
  PULL_HORIZONTAL, PULL_VERTICAL,
  KNEE_DOMINANT, HIP_DOMINANT,
  CERVICAL_FLEXION, CERVICAL_EXTENSION, CERVICAL_LATERAL_FLEXION
}

// 2. Modelo de Sesión de Entrenamiento y Mesociclos
enum SetType { WARMUP, NORMAL, FAILURE, DROP_SET, MYO_REP, REST_PAUSE }

interface Mesocycle {
  id: string;
  userId: string;
  status: 'ACTIVE' | 'DELOAD' | 'COMPLETED' | 'INTERRUPTED';
  targetVolumePerGroup: Record<string, number>; // MEAV inicial
  currentMicrocycleIndex: number;
  sessionsPerMicrocycle: number;       // nº FIJO de sesiones; el mismo en TODOS los microciclos
  projectedMicrocycles?: number;       // horizonte estimado (roadmap)
}

// Microciclo: conjunto fijo de sesiones. SIN duración en días: no se modela.
interface Microcycle {
  id: string;
  userId: string;
  mesocycleId: string;
  index: number;         // posición dentro del mesociclo (0-based)
  startedAt: Timestampish;   // solo para ordenar el histórico
  completedAt?: Timestampish;
}

interface WorkoutSet {
  id: string;
  setType: SetType;
  targetReps: number;
  targetRIR: number;
  targetWeight: number;
  actualReps?: number;
  actualRIR?: number;
  actualWeight?: number;
  isAutoFilled: boolean;
}

// 3. Analítica Ponderada por Grupo Muscular
interface MuscleGroupAnalytics {
  id: string; // ID del grupo muscular
  muscleGroup: MuscleGroup;
  currentMPI: number; // Índice de Progreso Muscular relativo (%)
  baselineE1RM: Record<string, number>; // exerciseId -> e1RM inicial
  currentE1RM: Record<string, number>;  // exerciseId -> e1RM última sesión
  exerciseWeights: Record<string, number>; // exerciseId -> peso relativo (ej. 0.50, 0.35, 0.15)
  consecutiveFlatWeeks: number; // Contador para el Stall Detection
  status: 'PROGRESSING' | 'STAGNANT' | 'REGRESSING';
}

// 4. Sistema Clínico de Lesiones
enum InjuryPhase { ACUTE, SUBACUTE, REHAB, RESOLVED }

interface InjuryTracker {
  id: string;
  articulation: string; // ej. "Codo Izquierdo"
  currentPhase: InjuryPhase;
  bannedVectors: MovementVector[];
  latestPainScore: number; // EVA 0-10
  createdAt: any;
}

// 5. Schema JSON Destino (Gemini Output para Función Cloud Nutricional)
interface NutritionAiResponse {
  foodItems: Array<{
    foodName: string;
    brandHint?: string;
    estimatedGrams: number;
    isQuantityGuessed: boolean;
    confidenceScore: number;
  }>;
}
```

## 7. Ecosistema de Privacidad y Despliegue Social (Fase 2)

- **Percentiles de Rendimiento:** La capa analítica utilizará fórmulas cruzadas con el peso corporal y la edad del atleta para estandarizar el nivel de fuerza[cite: 1].
- **Aislamiento Arquitectónico de Datos:** 
  - `FeedEvents`: Colección pública opcional donde se comparte volumen total, ejercicios y marcas de e1RM[cite: 1].
  - `PrivateHealthData`: Subcolección blindada por reglas de seguridad de Firebase[cite: 1]. Almacenará biomarcadores clínicos críticos: Frecuencia cardíaca (RHR), Variabilidad (HRV), VO2max y estados activos de lesiones, totalmente inaccesibles desde el exterior[cite: 1].

---

## 8. Arquitectura de Información y Sistema de Diseño (UI/UX)

### 8.1. Navegación y Secciones (Tabs)
La app se organiza en pestañas inferiores. El principio rector es **"consultar vs hacer"**: las acciones (ejecutar sesiones, registrar) viven en secciones de acción; el estado y las métricas se consultan en secciones de observación.

**MVP (4 pestañas):**
1. **🏋️ Entrenar** — el grueso de la lógica de negocio. Engloba:
   - Sesión de **Fuerza** (mesociclos, series, RIR, MPI aplicado en la ejecución).
   - Sesión de **Cardio** (nuevo dominio, ver §8.4).
   - **Rehabilitación** (bloques de rehab del sistema de lesiones se EJECUTAN aquí).
   - **Desglose de Volumen Semanal planificado** (fuerza y cardio) — métricas del entrenamiento pautado, distinto del histórico ejecutado.
2. **❤️ Bio** — estado del cuerpo. Engloba:
   - **Biomarcadores** (HRV, RHR, VO2max, sueño) desde HealthKit / Health Connect.
   - **Coach de Readiness** (ver §8.3): estado físico de hoy según sueño + biomarcadores, con recomendación de carga, inspirado en Bevel.
   - **Seguimiento clínico de lesiones** (consulta): fase actual, vectores vetados, registro de dolor EVA. (La EJECUCIÓN de rehab está en Entrenar — combinación A/B.)
3. **🥗 Nutrición** — módulo de nutrición e IA multimodal (§5).
4. **👤 Perfil** — datos del atleta, perfil dietético, sesión, ajustes.

**Fase 2 (5ª pestaña):**
5. **📈 Progreso** — analítica de rendimiento agregada: MPI por grupo, roadmap del mesociclo, histórico por ejercicio, calendario de entrenamientos. Solo LEE y agrega datos que las otras secciones ya generan, por lo que se implementa al final.

### 8.2. Sistema de Diseño (Design System)
- **Estética:** minimalista sobre **Liquid Glass** (material nativo de Apple, iOS 26+). Implementado con `expo-glass-effect` (`GlassView`/`GlassContainer`), con fallback seguro a `View` en iOS<26 / Android vía `isGlassEffectAPIAvailable()`.
- **Apariencia:** claro y oscuro, **automático según el sistema**. Base oscura como identidad principal.
- **Intensidad del cristal:** **sutil y puntual** — solo en barra de pestañas y tarjetas clave, no en todas las superficies.
- **Color de acento principal:** **verde lima**, con un tono deliberadamente desplazado del de Ladder (más verde/con cuerpo, menos neón ácido) para diferenciación de marca.
- **Color por sección (acento armónico):** cada sección tiene un acento dentro de la MISMA familia (verde→ámbar) para facilitar la orientación en la navegación, sin romper el core visual:
  - Entrenar: verde lima (principal).
  - Bio: verde menta.
  - Nutrición: verde salvia/oliva.
  - Progreso: (por definir, misma familia).
- **Colores semánticos (mandan sobre el acento de sección):**
  - **Rojo** = dolor agudo / lesión en fase AGUDA (EVA alto).
  - **Ámbar** = **aviso**: trigger de deload por estancamiento, fatiga elevada, descanso agotado. Reservado para lo que reclama atención.
  - **Verde aguamarina** = **descarga planificada**. Deliberadamente NO ámbar: un microciclo de descarga es parte normal del plan, no una alerta. Coincide con el extremo "lejos del fallo" de la rampa de RIR, lo cual es coherente — la descarga *es* baja intensidad.
- **Tokens** centralizados en `src/theme/` (colores, tipografía, espaciados, radios, materiales de cristal). Fuente única de verdad; ninguna pantalla hardcodea valores.

### 8.3. Coach de Readiness (nuevo)
Motor que combina sueño + HRV + RHR (y tendencia) en un **estado de hoy** con recomendación de carga, al estilo Bevel. Alimenta y puede reforzar los triggers de deload (§3.3). Lógica pura y testeable (objetivo 100% cobertura).

### 8.4. Cardio (nuevo dominio)
El entrenamiento incluye **cardio** además de fuerza. Modelado propio (tipo, duración, distancia, zonas de FC, kcal), con su **volumen semanal** separado. El cardio NO computa en el MPI (que es específico de fuerza/e1RM); tiene su propio conjunto de métricas. Se ejecuta y planifica desde Entrenar.

### 8.5. Pantalla Inicio/Hoy de Entrenamiento (E1)

La pestaña **Entrenamiento** tiene como pantalla de inicio (*home*) esta vista E1, desde la que se accede al registro de fuerza o de cardio. Estructura confirmada con el usuario (2026-09-22), basada en la opción **E** de la segunda iteración de mockups:

1. **Pastillas Fuerza / Cardio** en la parte superior. Alternan el dominio completo de la pantalla.
2. **Tarjeta de la sesión de hoy**, destacada: icono con el color de la rutina, nombre de la sesión, rutina de procedencia, pastillas de grupo muscular **con su número de series** (`Espalda 6`, `Pecho 4`), resumen (`6 ejercicios · 18 series · ~62 min`) y botón primario **Empezar entrenamiento**.
3. **Acordeón de rutinas**, una tarjeta por rutina registrada (los distintos macrociclos). La rutina activa viene expandida. Dentro, las sesiones del microciclo en curso.
4. **Entrenamiento vacío**: acción siempre disponible para crear una sesión añadiendo ejercicios a mano (§3.5.3).

**Fechas reales en lugar de días de la semana.** Las sesiones completadas muestran **su fecha de realización** (`16 SEP`), las pendientes no muestran día alguno (`—`), y la seleccionada muestra `HOY`. Decisión deliberada: el microciclo se define por sus **sesiones**, no por el calendario (§3.1), así que no existe correspondencia entre sesión y día de la semana — el usuario puede tardar en completarlo lo que necesite, y etiquetar una sesión como "lunes" sería falso. La fecha de completado ya se almacena, así que no supone coste adicional de modelado.

**Selección explícita de sesión.** Cualquier sesión pendiente del microciclo es pulsable para convertirse en la sesión activa de la tarjeta superior. El usuario no está obligado a seguir el orden previsto.

**Raíl del mesociclo, explorable.** La cabecera de cada rutina incluye un raíl segmentado con un segmento por microciclo. Todos los segmentos tienen el **mismo ancho**, porque todos los microciclos tienen el mismo número de sesiones (§3.1): no hay duración variable que representar. Propiedades:
- El segmento del microciclo en curso se resalta; los completados van atenuados.
- El microciclo de **descarga** se pinta en **verde aguamarina** (`semantic.deload`), no en ámbar: es parte del plan, no un aviso (§8.2).
- Al pulsar el raíl se abre la **vista del mesociclo** (§8.7).

**Previsualización de la sesión sin iniciarla.** La tarjeta de hoy incluye una zona pulsable **independiente del botón verde** (para que nunca se arranque un entreno por error) que abre una **hoja inferior** con: series por grupo muscular en barras, y la lista completa de ejercicios con sus series y repeticiones previstas. Se eligió hoja inferior frente a expandir la tarjeta porque (a) el acordeón de rutinas queda justo debajo y expandir ambos alargaría el scroll hasta perder la orientación, y (b) es la superficie donde vivirán de forma natural el **swap** de ejercicios y la edición previa de la sesión (E6), sin necesidad de rediseño posterior.

**Rutinas con identidad visual.** Cada rutina admite un **color** y un **icono** de un catálogo predefinido, que se usan en su tarjeta del acordeón y en el icono de la tarjeta de sesión. Iconografía: SVG vectoriales custom, nunca librerías de iconos ni emojis.

**Origen de los datos (2026-09-28).** El acordeón y la tarjeta de hoy leen las rutinas guardadas del atleta (`routines` + su `Mesocycle` activo), no datos de ejemplo. `services/training/routineView.ts` es el único punto que une la prescripción persistida (`PlannedSession`, por id de catálogo) con la vista que pintan las tarjetas (nombre, músculos, descanso, rango de repeticiones). La carga se repite **cada vez que la pantalla gana el foco**, porque guardar una rutina vuelve a una E1 ya montada. Reglas:
- Una rutina sin mesociclo o sin sesiones planificadas (guardado a medias) **no se muestra**: no hay microciclo que pintar.
- Si el mesociclo no guarda horizonte, se proyectan **6 microciclos** con el último como descarga, el ejemplo del §3.1.
- Las sesiones con el mismo enfoque se distinguen con letra (`Torso A`, `Torso B`).
- Orden: la rutina activa primero, después la más reciente.
- Estados propios de carga, error con reintento y lista vacía.

**Una sola rutina activa (2026-09-28).** `Routine.isActive` marca la que se sigue; como mucho una por atleta. Solo ella da la sesión de hoy y sus sesiones son seleccionables; las demás aparecen debajo bajo *Otras rutinas*, con **Activar rutina**. Activar escribe todos los cambios de bandera en un único *batch* (`activationChanges`) para que un fallo no deje dos activas o ninguna, y pide confirmación si ya había una activa. Una rutina nueva solo nace activa si no hay ninguna.

**Nombre, renombrado y borrado.** El nombre se pone en la página del plan generado, junto a *Guardar rutina* (hasta 40 caracteres, espacios normalizados), y es **obligatorio y único** por atleta, sin distinguir mayúsculas (`routineNameProblem`): no hay nombre por defecto, porque tres rutinas llamadas igual no se distinguen en Inicio. Se cambia después desde la tarjeta con una hoja propia, con la misma regla. **Eliminar** pide confirmación siempre y borra la rutina y sus mesociclos en un *batch*; las sesiones ejecutadas se conservan como historial. Borrar la activa deja al atleta sin rutina activa hasta que active otra.

Pendiente: las sesiones aún no muestran fecha de completado (no se leen `workoutSessions`), y la vista del mesociclo (§8.7) y la sesión en curso siguen con datos de ejemplo.

### 8.6. Barra de sesión en curso

Mientras hay una sesión de entrenamiento activa, la barra de pestañas **permanece visible** y una **barra de sesión en curso** se ancla justo encima de ella, en todas las pestañas.

Resuelve una tensión real: el usuario quiere poder consultar sus métricas (Bio, Nutrición) mientras entrena, lo que exige mantener las pestañas; pero no debe poder perder de vista la sesión, lo que invitaría a ocultarlas. La barra satisface ambas cosas — con ella "perder la sesión" deja de ser posible, porque está siempre presente y se vuelve con un solo toque.

Contenido: indicador de actividad, nombre de la sesión, progreso (`Serie 7 de 18`), tiempo transcurrido y **cuenta atrás del descanso**. Efecto secundario valioso: el temporizador de descanso sigue visible desde cualquier pestaña, que es precisamente cuando el usuario se va a mirar otra cosa.

Patrón de referencia: el mini-reproductor persistente (Spotify), por la misma razón de diseño.

### 8.7. Vista del mesociclo

Se abre al pulsar el raíl de progreso en la cabecera de la rutina (§8.5). Su propósito **no** es listar microciclos, sino mostrar **cómo progresa la prescripción** a lo largo del mesociclo.

Razón de ser: dado que la estructura de todos los microciclos es **idéntica** (§3.1) y lo que varía entre ellos es sobre todo la **intensidad** y, en menor medida, el **volumen**, un listado de microciclos no aporta nada — todos dirían lo mismo. Lo que el atleta necesita ver es **la rampa**.

**Semántica de color (importante):** el color asociado a la intensidad es el **RIR**, tomado de la rampa `RIR_COLORS` ya existente (rojo RIR 0 → verde aguamarina RIR 5). El bloque de **descarga** se marca en **verde aguamarina** (`semantic.deload`), **no en ámbar**: el ámbar queda reservado para avisos reales (trigger de deload por estancamiento, fatiga elevada), y una descarga programada no es un aviso. No hay colisión conceptual: la descarga es precisamente baja intensidad, así que comparte el extremo de la rampa de forma coherente.

**Diseño confirmado (N2 + gráfico de segmentos):**
- **Pestañas por sesión** del microciclo (Push / Pull / Upper / Lower).
- **Gráfico de progresión**: una **barra por microciclo**, un **segmento por serie**. La altura (número de segmentos) es el volumen; el **color de cada segmento** es el RIR de *esa* serie concreta. Esto permite que una serie tenga un RIR distinto de su vecina, algo que una representación de un solo color por microciclo no puede expresar — y esa fue precisamente la razón de descartar la alternativa en matriz.
- **Proyección por OPACIDAD, nunca por líneas punteadas**: los microciclos completados van atenuados, el actual a plena intensidad y los futuros translúcidos. El usuario puede así, desde el momento de crear el mesociclo, ver a varios microciclos vista lo que previsiblemente acabará haciendo, descarga incluida.
- **Scroll horizontal**, porque el mesociclo es **dinámico**: si el rendimiento cae puede insertarse una descarga en el punto donde ocurrió (no al final), y si tras un microciclo hay energía para otro se añade a la derecha sin replantear la vista.
- **Contadores de sesiones y microciclos. Sin contador de días ni de tiempo restante**: el usuario puede alargar o acortar el bloque, así que un "quedan N días" sería engañoso.
- **Músculos objetivo** con conmutador **Día / Ciclo**: volumen de la sesión seleccionada frente al del microciclo completo.
- **Series fraccionadas** en el recuento por músculo (`12.4 series`). Ver §8.9.

**Distinguir una serie al fallo de un RIR 0.** El color NO los distingue, y es correcto: son la misma intensidad — un RIR 0 y un fallo son igual de duros. Lo que cambia es la **intención**, que es un atributo del *tipo de serie*, no de la intensidad. Por eso el segmento lleva la **sigla del tipo** (`F`, `DS`, `RP`, `M`), las mismas que ya usa la tabla de series. Un segmento rojo sin sigla es RIR 0; con `F`, al fallo. Codificar el tipo con color exigiría una segunda dimensión cromática y destruiría la lectura de la rampa, que es lo único que el gráfico debe comunicar bien.

**Beneficio de diagnóstico:** la vista revela un ejercicio cuyo RIR **no baja** entre microciclos (progresión estancada). Complementa —no sustituye— el stall detection automático del §3.3.

### 8.8. Series avanzadas: Rest Pause, MyoReps y Drop Set

Estas series **no se describen con un solo número de repeticiones**: son una serie principal más una secuencia de tramos extra. Durante la sesión el atleta debe poder registrar cuántas repeticiones hizo en cada tramo y, cuando corresponda, con cuánto peso.

**Modelo** (`SetExtension` en `src/models/training.ts`):
- `reps` — repeticiones logradas en el tramo.
- `weight?` — peso del tramo **en kg absolutos**. Se guarda absoluto y no como diferencia respecto a la serie principal: un Drop Set *baja* el peso, así que una diferencia obligaría a interpretar signos. Absoluto sirve igual en los dos sentidos.
- `weight` ausente = el tramo **hereda** el peso de la serie principal, que es el caso normal en Rest Pause y MyoReps. Consecuencia en la interfaz: esos dos tipos solo piden repeticiones, mientras el Drop Set pide repeticiones y peso.

**Decisión de almacenamiento:** las repeticiones de la serie principal (`actualReps`) y las de los tramos se mantienen **separadas**, y solo se suman al calcular. Una serie de 10 + 3 + 2 **no equivale** a una de 15 a efectos de estímulo; aplanarlas al guardar perdería información irrecuperable.

**Lógica pura** (`src/services/training/advancedSets.ts`, 100 % cubierta): `totalReps`, `totalVolumeLoad` (usa el peso de cada tramo, de modo que un Drop Set computa correctamente), `formatReps` → `10+3+2`, `formatWeightProgression` → `60 → 50 → 40` (devuelve `null` cuando ningún tramo cambia el peso, para que la interfaz omita la línea).

**`FAILURE` no admite tramos.** Llevar una serie al fallo marca la *intención* con la que se ejecutó, no genera mini-series. Es una decisión revisable si se decide registrar repeticiones forzadas como tramos.

### 8.9. Atribución fraccionada de volumen por músculo

Los recuentos de series por grupo muscular son **decimales** (`12.4 series`) porque una serie no aporta lo mismo a todos los músculos que interviene: el **principal recibe la serie completa** y cada **secundario una fracción** (`SECONDARY_MUSCLE_WEIGHT = 0.5`, convención habitual en planificación de hipertrofia).

Es un concepto **distinto** de `PROFILE_WEIGHT` (§3.2): aquel pondera el perfil del ejercicio para el MPI, este reparte volumen entre músculos. No deben confundirse ni unificarse.

Reglas de cálculo (`src/services/training/sessionSummary.ts`, 100 % cubierta):
- Los **calentamientos NO cuentan** como volumen, aunque sí ocupan tiempo en la duración estimada.
- Un músculo que es principal en un ejercicio y secundario en otro **acumula** ambas contribuciones.
- Un secundario **duplicado** en el mismo ejercicio cuenta una sola vez, para que un dato mal introducido no infle el volumen.
- El músculo principal **nunca** se cuenta además como secundario.
- La duración estimada cuenta un descanso por serie **excepto tras la última de cada ejercicio**, y se presenta siempre como estimación (`~62 min`), nunca como promesa.

---


## Changelog Interno

### 2026-09-20 — Capa 0 (Cimientos) + Capa 1 (Modelos de datos)
Implementación inicial de la estructura del proyecto y traducción de los esquemas del §6 a TypeScript.

**Estructura de carpetas (`src/`):** `models/`, `services/`, `screens/`, `components/`, `navigation/`, `hooks/`, `store/`, `utils/`.

**Configuración:**
- Path alias `@/*` -> `./src/*` en `tsconfig.json` (resuelto por `babel-preset-expo` en Expo 57, sin plugins extra). Se omite `baseUrl` por estar deprecado en TypeScript 6.
- `strict: true` conservado.

**Modelos (`src/models/`):** traducción fiel de los 5 esquemas del §6. Decisiones y tipos añadidos que el PRD no listaba explícitamente pero que la especificación implica:

- **`common.ts` → `Timestampish`**: tipo temporal (`number | {seconds, nanoseconds}`) compatible con Firestore Timestamp y con persistencia offline-first (§2.1). Provisional hasta integrar Firestore en la Capa 2.
- **`biomechanics.ts` → `ExerciseProfile`** (`COMPOUND_PRIMARY | COMPOUND_SECONDARY | ISOLATION`): codifica la ponderación biomecánica `w_i` (0.50/0.35/0.15, §3.2.2), el RIR de inicio/tope (§3.4) y el descanso por defecto (§3.4). Nuevo respecto al PRD.
- **`biomechanics.ts` → `Exercise`**: entidad de catálogo (nativo/personalizado) con `movementVector` y `profile`, base del swap (§3.5) y del veto de lesiones (§4.1). Los personalizados llevan `isCustom` y `ownerId` (§3.5.3).
- **`training.ts` → `WorkoutExercise` y `WorkoutSession`**: contenedores de `WorkoutSet[]` implícitos en el §6. `WorkoutExercise` registra `isSwap`/`swappedFromExerciseId` para la renormalización de pesos del MPI (§3.2.3).
- **`training.ts` → `WeeklyCheckIn`**: materializa el check-in semanal del §3.1 (`recoveryScore`, `fatigueScore`).
- **`training.ts` → `Mesocycle.projectedWeeks`**: horizonte estimado no determinista para el roadmap visual (§3.1).
- **`analytics.ts` → `DeloadTrigger`** (`STALL | SAFETY_OVERRIDE | MANUAL_ABORT`): enumera las 3 causas del §3.3.
- **`injury.ts` → `RehabRoutine` y `PainLog`**: materializan los bloques pre/post-workout y el trigger EVA del §4.2. `InjuryTracker` añade `affectedMuscles` y `resolvedAtMesocycleIndex` (monitorización pasiva 2 mesociclos, §4.1).
- **`nutrition.ts` → `NutritionSource` y `NutritionEntry`**: registro persistido tras resolver el ítem contra la BD híbrida (§5.2). `NutritionAiResponse`/`NutritionAiFoodItem` traducen el schema Gemini del §6.
- **`user.ts` → `UserProfile`, `PrivateHealthData`, `FeedEvent`**: materializan el §2.3 (biomarcadores) y el aislamiento de datos del §7.

**Verificación:** `npx tsc --noEmit` limpio.

**Pendiente para capas siguientes:** refinar `Timestampish` con el tipo real de Firestore (Capa 2); poblar `services/` con repositorios tipados; el fence del bloque TypeScript del §6 quedó sin cerrar en el documento original (no modificado en este cambio).

### 2026-09-21 — Capa 2 (Persistencia Firebase + Autenticación)
Integración de la nube: Firestore (offline-first) y login con Apple.

**Decisión de arquitectura — SDK Firebase:** se adopta **React Native Firebase** (`@react-native-firebase/*` v26) sobre el JS SDK, porque envuelve el SDK nativo de Firestore y ofrece la **caché persistente nativa completa** que exige el offline-first estricto del §2.1. Coste asumido: obliga a **development build** (no Expo Go) y a New Architecture (requerida desde RN Firebase v26). Pruebas priorizadas en **iOS** (dispositivo del usuario).

**Proyecto Firebase:** `vigor-5ddda`, región europea. App iOS registrada con Bundle ID **`com.vigor.app`**. Login habilitado: **Apple** (Google queda para más adelante).

**Configuración (`app.json`):**
- `ios.bundleIdentifier` / `android.package` = `com.vigor.app`.
- `ios.googleServicesFile` → `./GoogleService-Info.plist` (añadido a `.gitignore`, no se versiona).
- `ios.usesAppleSignIn = true`.
- Config plugins: `@react-native-firebase/app`, `@react-native-firebase/auth`, y `expo-build-properties` con `ios.useFrameworks: "static"` (requisito de RN Firebase en iOS).

**Dependencias añadidas:** `@react-native-firebase/{app,firestore,auth}`, `expo-dev-client`, `expo-build-properties`, `@invertase/react-native-apple-authentication`.

**Código (`src/services/`):**
- `firebase.ts` — inicialización con **API modular** (`getApp`, `getFirestore`, `getAuth`). La persistencia offline está activada por defecto en RN Firebase (cumple §2.1 sin config extra).
- `auth.ts` — `signInWithApple()` (flujo Apple → credencial Firebase → `signInWithCredential`), `signOut()`, `getCurrentUser()`, `onAuthChange()`.
- `repositories/BaseRepository.ts` — repositorio genérico con CRUD tipado sobre Firestore modular (`get`, `list`, `listWhere`, `create`, `update`, `delete`).
- `repositories/index.ts` — repositorios por dominio. **Layout de datos definido**: colecciones globales (`exercises`, `mesocycles`, `workoutSessions`, `weeklyCheckIns`, `muscleGroupAnalytics`, `nutritionEntries`, `feedEvents`, `users`) y **subcolecciones privadas** `users/{uid}/{privateHealthData,injuries,painLogs,rehabRoutines}` para blindar los datos clínicos con reglas de seguridad (§7).

**Cambio de esquema:** `PrivateHealthData` gana campo `id` (id de documento) para encajar en el repositorio genérico.

**Verificación:** `npx tsc --noEmit` limpio. (Nota: aún NO se ha compilado el development build de iOS; el código está listo para cuando el usuario quiera correr `npx expo prebuild` + `run:ios`.)

**Pendiente para capas siguientes:** escribir reglas de seguridad de Firestore reales (hoy en "modo de prueba", §7); habilitar Google Sign-In; refinar `Timestampish` con `serverTimestamp()` en escrituras; el fence del bloque TypeScript del §6 sigue sin cerrar en el documento original.

### 2026-09-21 — Microciclos de duración variable + Histórico y Calendario (cambios de alcance)
Cambios de producto solicitados por el usuario, aplicados a spec y modelo de datos.

**1. Microciclos de duración variable (afecta modelo y lógica):**
- Se introduce la entidad **`Microcycle`** (bloque de N días dentro del mesociclo). Reemplaza la noción implícita de "semana fija de 7 días".
- `Mesocycle`: `currentWeekIndex` → `currentMicrocycleIndex`; se añade `defaultMicrocycleLengthDays` (normalmente 7) y `projectedWeeks` → `projectedMicrocycles`.
- `WorkoutSession`: `weekIndex` → `microcycleId` + `microcycleIndex`.
- `WeeklyCheckIn` → **`MicrocycleCheckIn`** (anclado al microciclo).
- `MuscleGroupAnalytics.consecutiveFlatWeeks` → `consecutiveFlatMicrocycles` (stall detection sobre microciclos).
- PRD §3.1 reescrito para describir microciclos variables y check-in por microciclo.

**2. Histórico de Ejercicios (feature UI, PRD §3.1.b):** vista de progresión por ejercicio a lo largo del tiempo, derivada de las `WorkoutSession`. Repositorio: `workoutSessionRepository.listByMicrocycle()` y consultas por ejercicio.

**3. Calendario de Entrenamientos Pasados (feature UI, PRD §3.1.b):** vista de calendario de días entrenados; se alimenta de `workoutSessionRepository.listByUser()` sobre `performedAt`.

**Repositorios añadidos/cambiados (`src/services/repositories/`):** nuevo `microcycleRepository` (con `listByMesocycle`); `workoutSessionRepository` gana `listByMicrocycle` y `listByUser`; `weeklyCheckInRepository` → `microcycleCheckInRepository`.

**Verificación:** `npx tsc --noEmit` limpio.

**Nota de proceso:** se eliminó el repositorio git del scaffold de `create-expo-app` (1 commit inicial, sin remoto) a petición del usuario; el historial lo iniciará él en la v1.0.0. Los archivos del proyecto no se tocaron.

### 2026-09-21 — Capa 3 (Navegación y pantallas base)
Esqueleto navegable de la app.

**Decisión — enrutado:** se adopta **Expo Router** (navegación basada en archivos), recomendado por Expo. Punto de entrada cambiado a `expo-router/entry`; se eliminan `index.ts` y `App.tsx` (los reemplaza `src/app/_layout.tsx`).

**Configuración (`app.json`):** `scheme: "vigor"` (deep links) y `experiments.typedRoutes: true` (rutas tipadas). Plugin `expo-router` añadido.

**Dependencias:** `expo-router`, `react-native-safe-area-context`, `react-native-screens`, `expo-linking`, `expo-constants`.

**Estructura de rutas (`src/app/`):**
- `_layout.tsx` — layout raíz (Stack + SafeAreaProvider + StatusBar).
- `(tabs)/_layout.tsx` — 5 pestañas inferiores: Entrenar, Analítica, Lesiones, Nutrición, Perfil.
- `(tabs)/{index,analytics,injuries,nutrition,profile}.tsx` — pantallas placeholder por sección.
- `src/components/PlaceholderScreen.tsx` — componente reutilizable de cascarón.

**Nota:** `src/screens/` se elimina; con Expo Router las pantallas viven en `src/app/`.

**Verificación:** `npx tsc --noEmit` limpio. (Pendiente: iconos de pestañas, y ver la app en el simulador requiere el development build de iOS.)

### 2026-09-21 — Fix build iOS: eliminación de expo-av + plugin RNFirebaseDisableSPM
Ajustes de dependencias/config para que el development build de iOS compile.

**1. `withRNFirebaseDisableSPM` (config plugin local, `plugins/`):** RN Firebase v26 resuelve Firebase por Swift Package Manager (SPM), incompatible con `useFrameworks: static`. El plugin inyecta `$RNFirebaseDisableSPM = true` en el Podfile durante prebuild para forzar resolución vía CocoaPods. Registrado en `app.json`.

**2. Eliminado `expo-av`:** venía del scaffold inicial, NO se usaba en `src/`, y está deprecado en Expo 57 (dividido en `expo-audio` / `expo-video`). Su versión rompía el build iOS con `'ExpoModulesCore/EXEventEmitter.h' file not found`. Se elimina. Cuando se implementen las alertas acústicas del cronómetro (§2.1) se usará **`expo-audio`** (reemplazo moderno), no `expo-av`.

**Nota de entorno:** el `pod install` y la compilación final (`xcodebuild`) no pueden ejecutarse desde el entorno del agente por una restricción de `sandbox-exec` de macOS (`Operation not permitted`); el usuario los ejecuta en su Terminal con `npx expo prebuild` + `npx expo run:ios`. El resto (código, config, prebuild de archivos) sí se valida aquí.

### 2026-09-21 — Fix build iOS (2): worklets, babel y Apple auth
Segundo bloque de arreglos de dependencias del development build.

- **`react-native-worklets` 0.10.1 instalado:** Reanimated v4.5.1 lo exige como dependencia (movió las worklets a esa librería). Sin él, `pod install` fallaba con "Failed to validate worklets version".
- **`babel.config.js` creado:** añade `react-native-worklets/plugin` (último de la lista), requerido por Reanimated v4. El antiguo `react-native-reanimated/plugin` está deprecado.
- **`expo-apple-authentication` instalado:** requerido por `ios.usesAppleSignIn` (activado en la Capa 2 para el login con Apple). Prebuild lo avisaba como pendiente.
- **Aviso informativo (no error):** falta `REVERSED_CLIENT_ID` en el plist → solo afecta a Google Sign-In, que aún no habilitamos; Apple Sign-In no lo necesita.

Reanimated y worklets vienen del scaffold; se conservan porque el PRD pide animaciones fluidas a 120fps (§2.1), donde Reanimated es el estándar.

**Verificación:** `npx tsc --noEmit` limpio. Recompilar en Terminal: `npx expo prebuild --platform ios --clean` + `npx expo run:ios`.

### 2026-09-21 — Fix build iOS (3): Apple Sign-In diferido para desarrollo con cuenta gratuita
`usesAppleSignIn` (capability nativa activada en la Capa 2) requiere una cuenta **Apple Developer de pago**; una Personal Team gratuita no puede generar el provisioning profile ("Personal development teams do not support the Sign In with Apple capability"), lo que bloqueaba incluso el build de simulador.

**Decisión:** se elimina `ios.usesAppleSignIn` de `app.json` para poder desarrollar en simulador con la cuenta gratuita del usuario. El **código** de auth (`signInWithApple` en `src/services/auth.ts`) se conserva intacto; solo se desactiva la capability nativa. Se **reactivará** `usesAppleSignIn` cuando el usuario disponga de cuenta Apple Developer de pago o vaya a publicar en la App Store.

**Nota:** desarrollar/compilar para el SIMULADOR no requiere firma de código ni cuenta de pago. La firma solo es necesaria para dispositivos físicos y para capabilities como Sign in with Apple.

### 2026-09-21 — Fix crash de arranque iOS 27: Scene Lifecycle
La app compilaba e instalaba, pero **crasheaba al lanzar** antes de pintar nada. Causa (crash report): `___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption` — el SDK de iOS 27 (Xcode 27) **exige** que la app adopte el UIKit scene lifecycle, y el AppDelegate no lo hacía.

**Fix:** activado `ios.enableSceneSupport: true` en `expo-build-properties` (requiere Expo SDK ≥ 57.0.23; el proyecto usa 57.0.24). Reorganiza el arranque de React Native al scene delegate de Expo y añade el scene manifest al Info.plist. Requiere `prebuild` + recompilar.

**Flujo de build que funciona (Xcode 27 + Expo 57):** `expo run:ios` clasifica mal el simulador como dispositivo físico (bug CLI + Xcode 27), así que se compila directo con:
`xcodebuild -workspace ios/vigor.xcworkspace -scheme vigor -configuration Debug -sdk iphonesimulator -destination 'id=<UDID_SIM>' -derivedDataPath ios/build build`, seguido de `xcrun simctl install/launch` y `npx expo start` para la metro.

### 2026-09-21 — Fix bundling Metro: overrides para versión única
Tras compilar y arrancar la app (dev client), el **bundling de Metro** fallaba con `TypeError: Cannot read properties of undefined (reading 'transformFile')`. Causa: árbol de dependencias con **Metro duplicado/descuadrado** — `@expo/metro` 56.0.2 (fork de Expo) espera `metro@0.84.5`, pero había un `metro@0.84.6` anidado en `metro-config/node_modules`, arrastrado por reinstalaciones con `--legacy-peer-deps`.

**Fix:** bloque `overrides` en `package.json` fijando todo el ecosistema Metro a `0.84.5` (metro, metro-config, metro-resolver, metro-transform-worker, metro-babel-transformer, metro-runtime, metro-cache, metro-source-map). Reinstalar (`rm -rf node_modules package-lock.json && npm install --legacy-peer-deps`) y `npx expo start --clear`.

**Riesgo latente anotado:** Node del entorno es v23.7.0 (no-LTS, marcado EBADENGINE por Expo). Si persisten fallos raros de Metro, migrar a Node 22 LTS.

### 2026-09-21 — Arquitectura de Información + Design System + Cardio/Readiness
Decisiones de producto y diseño (nueva §8 del PRD).

**Navegación reestructurada (Capa 3):** de 5 pestañas genéricas a **4 del MVP**: Entrenar / Bio / Nutrición / Perfil (Progreso → fase 2). Se eliminan `analytics.tsx` e `injuries.tsx`; se crea `bio.tsx`. Entrenar engloba fuerza+cardio+rehab+volumen planificado; Bio engloba biomarcadores+coach+seguimiento de lesiones (rehab se EJECUTA en Entrenar — combinación A/B).

**Modelos nuevos (`src/models/`):**
- `cardio.ts` — `CardioType`, `HeartRateZone`, `CardioSession`, `WeeklyVolumePlan` (volumen planificado fuerza+cardio). Cardio NO computa en MPI.
- `readiness.ts` — `LoadRecommendation`, `ReadinessScore` (coach estilo Bevel: sueño+HRV+RHR → estado del día). Lógica pura, objetivo 100% cobertura.

**Repositorios añadidos:** `cardioSessionRepository`, `weeklyVolumePlanRepository`, `readinessScoreRepository` (privado bajo `users/{uid}/`).

**Design system (`src/theme/`):**
- `tokens.ts` — acento de marca **verde lima `#9BE317`** (desplazado del neón de Ladder para diferenciación), acentos por sección (armónicos verde→ámbar), semánticos (rojo dolor, ámbar deload), paleta dark/light, tipografía, spacing, radius.
- `useTheme.ts` — resuelve esquema auto según sistema.
- `components/GlassSurface.tsx` — Liquid Glass nativo (`expo-glass-effect` `GlassView`) con **fallback seguro** vía `isGlassEffectAPIAvailable()` (iOS<26/Android → View del tema, sin crash).
- `PlaceholderScreen` migrado a tokens + acento por sección.

**Verificación:** `npx tsc --noEmit` limpio. Pendiente: recompilar para ver el look en simulador (cambio de navegación es JS, pero `expo-glass-effect` es nativo — ya estaba en node_modules como transitivo; conviene declararlo explícito en package.json).

### 2026-09-21 — Capa 4 (parte 1): Testing + e1RM + MPI
Arranca el motor de entrenamiento por su núcleo matemático, con framework de tests.

**Testing (regla de cobertura):** `jest-expo` + `jest` + `@types/jest` + `@react-native/jest-preset` (peer que jest-expo separó en versiones nuevas). Scripts `test` / `test:watch` / `test:coverage`. `coverageThreshold` 100% funciones/líneas/sentencias, 90% ramas, sobre `src/**` EXCLUYENDO `src/app/**` (UI) — coherente con "100% en lógica, comportamiento en UI".

**Lógica (`src/services/analytics/`, funciones puras):**
- `e1rm.ts` — `epleyE1RM` (Epley: peso×(1+reps/30)) y `relativeE1RMChange` (Δe1RM relativo, §3.2.1). Decisión de producto: fórmula **Epley** (Brzycki queda como posible añadido futuro).
- `mpi.ts` — `PROFILE_WEIGHT` (0.50/0.35/0.15), `muscleProgressIndex` y `muscleProgressIndexFromE1RM`. El divisor Σw normaliza sobre los ejercicios presentes → **tolerancia a swaps** (§3.2.3) sin distorsión.

**Tests (`__tests__/`):** e1rm-test y mpi-test con edge cases (inputs inválidos, lista vacía, swap/omisión, regresión, pesos iguales). **Suite verde confirmada** por el usuario.

### 2026-09-21 — Capa 4 (parte 2): Máquina de estados, Deload y RIR
Completado el núcleo de lógica del motor de entrenamiento.

**Lógica (`src/services/training/`, funciones puras):**
- `mesocycleStateMachine.ts` — transiciones ACTIVE↔DELOAD→COMPLETED, INTERRUPTED terminal desde cualquier no-terminal (§3.1, §3.3.3); `canTransition`, `isTerminal`, `transition`, `advanceMicrocycle`.
- `deloadTriggers.ts` — `evaluateDeload` con las 3 causas del §3.3 y prioridad SAFETY_OVERRIDE > MANUAL_ABORT > STALL. Umbrales en `DELOAD_THRESHOLDS` (2 microciclos planos, recovery<5 o fatiga≥7, EVA>4).
- `rirAutoregulation.ts` — matriz RIR por perfil (§3.4: axiales inicio 3/tope 2, RIR 0 solo serie final pre-deload; máquinas 2→1; aislamiento hasta fallo) y `fatigueAutoFill` (ajuste −5% redondeado a 0.5kg cuando el rendimiento decae).

**Tests:** 78 tests en 5 suites, **cobertura 100%** (statements/branches/functions/lines) en toda la lógica de negocio.

**Decisión de cobertura:** el umbral 100% se acota (`collectCoverageFrom`) a `src/services/analytics` y `src/services/training` (lógica pura). Modelos (solo tipos), repositorios (Firebase, se prueban con integración) y UI quedan fuera del umbral estricto, coherente con la regla "100% en lógica". Los motores futuros (readiness, swap, veto de lesiones, nutrición) entrarán en el 100%.

**Pendiente Capa 4:** motor de sustitución (swap, §3.5) — pieza aparte; e integración de estas funciones puras con los repositorios/UI en capas siguientes.

### 2026-09-21 — Capa 4 (parte 3): Motor de Sustitución (Swap)
Completada la última pieza de lógica del motor de entrenamiento.

**Lógica (`src/services/training/swapEngine.ts`, funciones puras):**
- `rankSwapCandidates(target, candidates)` — ordena alternativas en cascada descendente (§3.5): vector+músculo → vector exacto (§3.5.1) → grupo muscular principal (§3.5.2) → resto. Los ejercicios `isCustom` se apilan SIEMPRE al final de su franja (§3.5.3, offset de tier). Excluye el propio target; empates estables (conservan orden de entrada).
- `bestSwapCandidate(target, candidates)` — mejor alternativa o null.

**Tests (`__tests__/swapEngine-test.ts`):** catálogo vacío, exclusión del target, orden de cascada completo, personalizados al final aunque coincidan, solo-personalizados, empates estables. Cobertura 100%.

**Estado suite:** 88 tests, 6 suites, cobertura 100% en toda la lógica de negocio (`analytics` + `training`). El núcleo de lógica de la Capa 4 queda COMPLETO (e1RM, MPI, máquina de estados, deload, RIR, swap). Pendiente: integración con repositorios/UI en capas siguientes.

### 2026-09-21 — UX de la pantalla Entrenar + Internacionalización (i18n)

**8.5. Pantalla Entrenar — patrón de registro (validado con mockups)**
Referencias del usuario: Hevy + MacroFactor. Decisiones cerradas:
- **Miniaturas horizontales arriba**: todos los ejercicios de la sesión visibles; cambio de ejercicio en **1 tap**, deslizamiento horizontal, y un `+` al final para añadir ejercicio. El activo se marca con acento y subrayado. (Alternativa descartada: scroll vertical con todos los ejercicios.)
- **Tabla de series** con columnas: `SET · PREVIOUS · KG · REPS · RIR · ✓`.
  - `PREVIOUS`: referencia en gris de la última vez, **incluyendo el RIR/RPE** ("80kg × 8 · RIR 2").
  - `KG` / `REPS`: campos numéricos independientes (teclado).
  - `RIR`: **columna compacta** (celda pequeña coloreada), NO bolas grandes ni ruleta. **Pre-rellenada con el RIR OBJETIVO** (no con el anterior). Al tocarla se abre un selector compacto de píldoras 0-5.
  - Código de color del RIR: rojo (0-1, cerca del fallo) → ámbar (2-3) → verde (4-5), coherente con los semánticos. NO se muestra leyenda de escala.
  - **Sin columna de "objetivo"** separada: el objetivo ES el valor pre-rellenado.
- **Tipos de serie en la columna SET**: al pulsar el número se abre un selector con sigla + nombre completo. Siglas **universales** (no traducidas): `W` Calentamiento, número Normal, `F` Fallo, `M` Myo-Rep, `DS` Drop Set, `RP` Rest-Pause. Mapean 1:1 al enum `SetType` ya existente.
- **Sugerencia del Fatigue Auto-fill**: se indica con **fondo ámbar tenue + barra lateral ámbar**, NUNCA con líneas discontinuas.
- **Añadir serie**: un `+` discreto bajo la última serie (no botón grande). **Borrar serie**: mantener pulsado o deslizar lateralmente.
- **Resumen de sesión**: series **hechas/total** (ej. `18/20`, hechas en acento y total en gris) + MPI del grupo. **No** se muestra volumen total en kg (no aporta).
- **Acciones del ejercicio** (Swap · Info · Nota): **centradas**.
- **Regla de iconografía (global)**: NO se usan librerías de iconos ni emojis en ninguna parte de la app. Solo **imágenes vectorizadas custom (SVG propios)**.
- Pendiente de pulido: alineación tipográfica de la tabla (anchos consistentes, alineación numérica).

**8.6. Internacionalización (i18n)**
La app debe funcionar en el **idioma del sistema**. Idiomas iniciales: **castellano, inglés, francés, japonés** (ampliable).
- **`expo-localization`** lee el locale del dispositivo (`languageCode`, `textDirection` para futuro soporte RTL, `measurementSystem`, `decimalSeparator`, `currencyCode`).
- **`i18next` + `react-i18next`** para la resolución de claves → texto.
- **Regla de código**: NUNCA se escriben textos literales en las pantallas; siempre claves (`t('train.addSet')`). Recursos en `src/i18n/locales/{es,en,fr,ja}.json`.
- **Unidades adaptativas**: usando `measurementSystem` se mostrará **kg o lb** según la región del usuario (relevante: las referencias de MacroFactor usan `Lb`).
- Las **siglas de tipo de serie** (W/F/M/DS/RP) se mantienen SIN traducir por ser jerga internacional y para evitar colisiones (en francés, *Échauffement* y *Échec* colisionaban en "É").

**Nota de calidad pendiente:** las traducciones de FR y JA fueron generadas por el agente y **deberían ser revisadas por un hablante nativo** antes de publicar.

### 2026-09-22 — i18n operativo + Pantalla Entrenar (UI real con datos mock)

**Internacionalización implementada (§8.6):**
- Dependencias: `expo-localization` 57.0.2, `i18next` 26.4.2, `react-i18next` 17.0.15.
- `src/i18n/index.ts` — inicializa i18next con el idioma del SISTEMA; importado en `src/app/_layout.tsx` para que se configure antes de renderizar.
- `src/i18n/resolveLanguage.ts` — resolución de idioma **sin efectos secundarios** (extraída de index.ts para ser testeable): recorre las preferencias del usuario y cae a `en` si ninguna está soportada.
- `src/i18n/units.ts` — `weightUnitFor` (US → lb, resto → kg), `convertWeight`, `toKilograms`. Almacenamiento canónico en **kg**; la conversión es solo de presentación.
- Recursos en `src/i18n/locales/{es,en,fr,ja}.json`. Tabs y pantalla Entrenar ya consumen claves (cero texto literal).

**Pantalla Entrenar construida (§8.5), con datos mock (`src/mocks/session.ts`):**
- `src/app/(tabs)/index.tsx` — cabecera + cronómetro en `GlassSurface`, miniaturas horizontales con cambio de ejercicio en 1 tap y `+` para añadir, resumen `hechas/total` + MPI, tabla de series, `+` discreto para añadir serie, acciones **centradas** (Swap/Info/Nota, sin iconos de librería).
- `src/components/train/SetRow.tsx` — fila de serie. **Alineación tabular resuelta**: `COLUMN_WIDTHS` compartido entre cabecera y filas, y `fontVariant: ['tabular-nums']` en todos los números para que no “bailen” al cambiar de dígito.
- `src/components/train/rirColor.ts` — escala de color del RIR 0→5 (rojo→verde), recorta valores fuera de rango.
- `src/components/train/setTypeLabel.ts` — siglas universales (W/F/M/DS/RP) + lista de tipos seleccionables.
- **Selector de tipo de serie**: modal inferior al pulsar la columna SET, con sigla + nombre traducido.
- **Lógica real enganchada**: `targetRIR()` del motor (Capa 4) fija el RIR objetivo según el perfil biomecánico del ejercicio activo; las series con `isAutoFilled` se pintan con fondo ámbar + barra lateral y el aviso de confirmación.

**Interacciones aún NO implementadas (pendientes):** edición numérica de KG/REPS con teclado, selector de píldoras al pulsar RIR, borrar serie (mantener pulsado / deslizar), y el cronómetro funcional (ahora es estático). Tampoco hay persistencia: los cambios viven en estado local.

**Verificación:** `tsc --noEmit` limpio · **120 tests, 9 suites, cobertura 100%** en toda la lógica pura (analytics, training, i18n, helpers de train).

### 2026-09-22 — Correcciones de UI tras verificación visual en simulador
Revisión de la pantalla Entrenar ya ejecutándose (captura del simulador), con los defectos encontrados y corregidos:

- **Barra de pestañas sin tematizar (grave):** salía con el estilo iOS por defecto — fondo **blanco** y acento **azul**, rompiendo la estética oscura. Corregido en `src/app/(tabs)/_layout.tsx`: fondo `colors.bgElevated`, borde `colors.surfaceBorder`, y `tabBarActiveTintColor` con el **acento de cada sección** (§8.2: Entrenar lima, Bio menta, Nutrición salvia), inactivas en `textSecondary`.
- **Aviso del Fatigue Auto-fill mal indentado:** invadía la fila siguiente. Ahora se indenta con `spacing.lg + COLUMN_WIDTHS.set`, alineado bajo los valores de su propia fila.
- **Añadir serie heredaba el peso SUGERIDO:** al pulsar `+` tras un ajuste por fatiga, la nueva serie copiaba el peso reducido (77.5) en vez del pautado (80). Corregido: `addSet()` toma como referencia la última serie **no** marcada `isAutoFilled`, de modo que una serie nueva parte siempre del objetivo planificado.
- **Cronómetro pegado al borde:** se le añadió margen. Nota: lo que aparece encima en las capturas es el **botón flotante del dev-client de Expo**, presente solo en builds de desarrollo, no un defecto de la UI.

**Pendiente identificado:** los iconos de las pestañas son los de por defecto (triángulos) porque aún no existen los **SVG vectoriales custom** que exige §8.5. 

**Verificación:** `tsc --noEmit` limpio · 120 tests, 9 suites en verde. Cambios solo de JS → aplicados con Fast Refresh, sin recompilar.

### 2026-09-22 — Rediseño de Entrenar (11 ajustes del usuario) + edición de KG/REPS/RIR
Referencia estética aportada por el usuario: MacroFactor en modo oscuro (miniaturas grandes con imagen y subrayado en la activa, `Previous` en dos líneas discreto, valores en cajas). **No se plagia**: se toma como referencia de ergonomía.

**Cambios aplicados (§8.5 actualizado):**
1. **Barra de pestañas en Liquid Glass**: `tabBarBackground` con `GlassSurface` y **pastilla de cristal sobre la pestaña activa** mediante `tabBarButton` personalizado (`GlassTabButton`). Barra transparente y posicionada en absoluto.
2. **Eliminado el texto "Ajustado por fatiga"**: el ajuste es automático y silencioso — simplemente pre-rellena el valor a la baja en las series siguientes. Se elimina también el resaltado ámbar de fila.
3. **RIR editable**: al pulsar la celda se abre un selector de píldoras 0-5 con su color.
4. **Deslizamiento lateral entre ejercicios**: `ScrollView` horizontal con `pagingEnabled`; una página por ejercicio, sincronizada con las miniaturas en ambos sentidos.
5. **Miniaturas más grandes** (84×72, hasta 3 líneas de texto) con subrayado de la activa.
6. Referencia estética incorporada (ver arriba).
7. **El contador de series de la cabecera es del ENTRENAMIENTO completo** (suma de todos los ejercicios), no del ejercicio activo. El progreso del ejercicio se muestra junto a su nombre.
8. **MPI eliminado de la cabecera** (concepto no evidente para el usuario; el índice sigue existiendo en la lógica y se expondrá en Progreso cuando tenga contexto explicativo).
9. **Cabecera rediseñada**: fuera el "Entrenar" grande y su subtítulo; ahora el **nombre de la sesión** en grande (ej. "Push") + cronómetro.
10. **Tabla con más relieve**: `KG` y `REPS` en **cajas** (`TextInput` con fondo y borde), insignia de SET **circular**, `PREVIOUS` en dos líneas (peso×reps / RIR) en tono claro y discreto, y cabeceras de columna en **blanco con toque lima sutil** (`#E4F0C8`). Checkbox real en lugar de símbolo.
11. **Series propias por ejercicio**: los datos mock pasan de una lista única a `mockSetsByExercise` (exerciseId → series), con valores distintos y realistas por ejercicio.

**Edición implementada:** `KG` (teclado decimal) y `REPS` (teclado numérico) editables in-place con `selectTextOnFocus`; `RIR` mediante selector. Al marcar la serie completada se fija lo mostrado como valor real (`actualWeight/Reps/RIR`).

**Verificación:** `tsc --noEmit` limpio · 120 tests, 9 suites en verde. **Pendiente de confirmación visual**: la app en el simulador seguía mostrando el bundle anterior (Fast Refresh no aplica cambios estructurales); requiere recarga completa de la metro.

**Sigue pendiente:** borrar series (mantener pulsado / deslizar), cronómetro funcional, iconos SVG custom, y persistencia (todo vive en estado local).

### 2026-09-22 — Estética Bevel, escala RIR/RPE y corrección de bugs de layout
Pestaña renombrada de "Entrenar" a **"Entrenamiento"** en los 4 idiomas.

**Decisión sobre el MPI:** se retira definitivamente de la sesión individual. Su sitio es el **análisis del MESOCICLO** en la pestaña Progreso: un porcentaje de progreso solo tiene sentido comparando varios microciclos, en una sesión aislada no significa nada.

**Bug corregido (layout):** el `ScrollView` horizontal de las miniaturas no tenía altura acotada y, al estar en un contenedor flex, **se expandía** dejando un hueco enorme antes de la tabla. Se envuelve en una `View` de altura fija (`THUMB_STRIP_HEIGHT = 84`).

**Selector de intensidad rediseñado:** el modal a pantalla completa oscurecía todo (intrusivo). Ahora es un **selector compacto inline** que aparece bajo la propia serie, con `FadeIn`/`FadeOut`, sin atenuar el resto de la pantalla.

**8.7. Escala de intensidad: RIR o RPE (`src/services/training/intensityScale.ts`)**
- El usuario elige la escala en los **ajustes de su perfil**. Almacenamiento **canónico en RIR**; RPE es una transformación de PRESENTACIÓN.
- **RIR** cuenta hacia abajo (0 = fallo); su valor ABIERTO es **`+5`** ("5 o más en reserva"), necesario al calentar cuando no se sabe cuántas repeticiones quedan.
- **RPE** cuenta hacia arriba (10 = fallo); su valor abierto es **`-5`**.
- La intensidad puede quedar **VACÍA** (`null`): el modelo `WorkoutSet.actualRIR` pasa a `number | null`.
- El **color** se deriva de la `distanceToFailure` (0 = fallo → rojo, 5 = lejos → verde), de modo que ambas escalas comparten la misma rampa. Cobertura 100%.

**Estética (referencia Bevel, §8.2 actualizado):** se abandona el **negro puro** por resultar brusco.
- Paleta oscura: fondo `#16191C` (carbón), tarjetas `#23272B`, textos `#F0F2F4 / #9AA1A8 / #6B7279`. Contraste más suave.
- **Radios más generosos**: sm 10, md 16, lg 22, xl 28.
- Nuevos tokens **`motion`** (fast 140 / normal 240 / slow 380 ms): las transiciones de estado deben ser suaves, nunca "de todo a nada".
- **Barra de pestañas flotante en cápsula** (imitando Bevel): separada de los bordes, `borderRadius: pill`, material Liquid Glass y **pastilla clara sobre la activa**.

**Animaciones suaves:** al completar una serie el fondo y el checkbox se interpolan con Reanimated (`withTiming` + `interpolateColor`) en `motion.normal`, en lugar del cambio instantáneo anterior.

**Verificación:** `tsc --noEmit` limpio · **138 tests, 10 suites, cobertura 100%** en la lógica.

**Pendiente reconocido:** la interacción de **mantener pulsado y soltar sobre el valor deseado** del selector de intensidad NO está implementada (requiere gestos con seguimiento entre hijos); ahora funciona con dos toques (uno en la celda, otro en el valor). También siguen pendientes: borrar series, cronómetro funcional, iconos SVG custom y persistencia.

### 2026-09-22 — Campos vacíos, selector por gesto, barra tipo Bevel y optimización de renderizado

**1. Campos KG/REPS admiten VACÍO** (`src/components/train/NumericField.tsx`): antes se convertía el texto a número en cada pulsación, así que al borrar el contenido aparecía un `0` automático. Ahora el componente conserva el TEXTO del usuario y comunica `number | undefined` al padre (undefined = vacío); se resincroniza solo si el valor cambia desde fuera (p. ej. ajuste por fatiga).

**2. Selector de intensidad por gesto** (`src/components/train/IntensityCell.tsx`): implementadas AMBAS interacciones con `react-native-gesture-handler`:
- **Dos toques**: uno en la celda abre el selector, otro elige el valor.
- **Mantener pulsado y soltar**: al mantener pulsado emerge el selector; sin levantar el dedo se arrastra y **al soltar** queda seleccionado el valor bajo el dedo (la opción resaltada crece para dar retroalimentación). El mapeo dedo→valor usa la geometría fija del selector (`OPTION_WIDTH`/`OPTION_GAP`) y la posición absoluta medida con `measureInWindow`.
- Incluye la opción **vacía** (`—`) además de la escala.
- `GestureHandlerRootView` añadido en el layout raíz (requisito de gesture-handler).

**3. Barra de pestañas fiel a Bevel** (§8.2): la selección **ya NO se indica con color** (era lima); todas las etiquetas comparten color y la pestaña activa se distingue por una **pastilla de cristal más clara con canto visible** (`GlassSurface` + borde sutil). Márgenes laterales reales (`BAR_MARGIN = 20`) para que la cápsula flote y no quede pegada a los bordes.

**4. Optimización de renderizado (lentitud percibida al pulsar):** el estado de todas las series vive en la pantalla y el carrusel renderiza las 5 páginas, así que **cada pulsación re-renderizaba las 5 páginas completas**. Refactor:
- Nuevo `src/components/train/ExercisePage.tsx`, **memoizado** (`memo`), con el contenido de un ejercicio.
- `SetRow` también memoizada.
- Los callbacks de la pantalla se estabilizan con `useCallback` (sin esto `memo` no sirve de nada).
- La pantalla queda como mero orquestador (cabecera, carrusel, resumen, paginado).

**Nota honesta sobre rendimiento:** parte de la lentitud es inherente a la build de **Debug** (JS sin optimizar + simulador). Para juzgar el rendimiento real hay que compilar en **Release** (`-configuration Release`). El refactor elimina el desperdicio que sí era nuestro.

**Verificación:** `tsc --noEmit` limpio · 138 tests, 10 suites en verde.

### 2026-09-22 — Diagnóstico de la lentitud percibida de la interfaz

Investigación tras reportar el usuario que "cualquier pulsación tarda unas décimas de segundo" y que **persistía después de recompilar** (la memoización de la iteración anterior no lo resolvió).

**Hipótesis DESCARTADA (quedó registrada para no repetirla):** se intentó desactivar el retardo de toque de `UIScrollView` con `delaysContentTouches={false}` en los tres ScrollViews anidados. **Es incorrecto en React Native 0.86**: la prop ya no existe en la API porque RN la fija internamente. Verificado en el código nativo — `React/Fabric/Mounting/ComponentViews/ScrollView/RCTScrollViewComponentView.mm:145` hace `_scrollView.delaysContentTouches = NO` de forma incondicional. No hay nada que optimizar por esa vía; los cambios se revirtieron.

**Evidencia real encontrada (el entorno, no el código):**
- **Host saturado:** carga media de `12.96` (15 min) y `10.26` (5 min) sobre **12 núcleos**. Carga sostenida por encima del número de núcleos degrada el simulador con independencia de cómo esté escrita la UI.
- **Spotlight reindexando los artefactos de build:** `ios/build` ocupa **6.6 GB** y `ios/Pods` **1.3 GB**, con **59.651 ficheros** y **sin exclusión de Spotlight**. Cada `expo prebuild --clean` + `xcodebuild` regenera ese árbol completo y `mds_stores` lo reindexa entero.
- **Build de Debug:** el JavaScript corre sin optimizar. El experimento de control para separar el coste de Debug del de nuestro código es compilar en `-configuration Release`.

**Limitación honesta:** no fue posible identificar el proceso culpable desde la sesión del agente — el sandbox bloquea `ps` y `top` (`Operation not permitted`). Requiere Monitor de Actividad.

**Herramienta de medición añadida** (`src/theme/featureFlags.ts`): interruptor `GLASS_ENABLED`. Poniéndolo en `false`, `GlassSurface` cae a una superficie translúcida plana, lo que permite aislar por A/B el coste del material Liquid Glass — el simulador de iOS no tiene aceleración real para los materiales de Apple, así que el cristal puede ser caro ahí y prácticamente gratis en un iPhone físico. Es un cambio solo-JS: basta recargar Metro (`r`), sin recompilar.

**Recomendaciones de entorno:** excluir `/Users/franbecerra/vigor/ios` en Ajustes del Sistema → Spotlight → Privacidad (la exclusión persiste por ruta y sobrevive a la regeneración de `ios/`), y limpiar `ios/build` periódicamente.

**Verificación:** `tsc --noEmit` limpio · 138 tests, 10 suites en verde.

### 2026-09-22 — Corrección: `ReferenceError: Property 'GLASS_ENABLED' doesn't exist`

**Síntoma:** al recargar, `GlassSurface.tsx:39` lanzaba `ReferenceError: Property 'GLASS_ENABLED' doesn't exist`. El segundo error del stack (`index.tsx:127`) no era un fallo independiente, sino la cascada de render del mismo origen.

**Causa:** `src/theme/featureFlags.ts` se había creado como fichero NUEVO mientras Metro ya estaba en marcha. Metro había construido su mapa de ficheros antes de que el módulo existiera, así que el import se resolvió a nada y el identificador quedó sin definir en tiempo de ejecución (el type-check pasaba, porque TypeScript sí veía el fichero en disco). La solución general para esta clase de error es reiniciar el bundler con `npx expo start --clear`.

**Arreglo aplicado:** en lugar de depender de que se limpie la caché, el interruptor `GLASS_ENABLED` se ha movido DENTRO de `src/components/GlassSurface.tsx` como constante local y se ha eliminado `src/theme/featureFlags.ts`. Un interruptor de desarrollo de una sola línea no justifica un módulo propio, y así vive justo donde se activa.

**Verificación:** sin referencias huérfanas a `featureFlags` · `tsc --noEmit` limpio · 138 tests, 10 suites en verde.

### 2026-09-22 — Selector de intensidad: selección por toque y apertura única · barra más estrecha

**1. Las pastillas del selector no eran pulsables (bug de omisión).** La implementación anterior solo resolvía la selección al SOLTAR un arrastre, así que en el modo de dos toques no había ningún elemento que recibiera la pulsación: el selector se abría y no se podía elegir nada. Cada opción es ahora un `Pressable` con `onPress`.

**2. Se podían abrir varios selectores a la vez.** Cada `IntensityCell` guardaba su propio estado `open` sin coordinación, de modo que se desplegaban varias filas de pastillas simultáneamente. Introducido `IntensityPickerProvider` (contexto), que guarda el `cellId` de la única celda abierta; abrir una cierra la anterior. El `cellId` es el id de la serie, que ya es único a nivel global en los datos. El proveedor envuelve la pantalla de sesión.

**3. El arrastre solo actúa en modo mantener-pulsado.** Añadido un `isDragging` que solo se activa en `onStart` del `LongPress`. Sin esto, el fin del gesto de arrastre podía interferir con un toque normal y cerrar el selector sin seleccionar.

**4. Barra de pestañas más estrecha:** `BAR_MARGIN` 20 → 34.

### 2026-09-22 — Rendimiento: diagnóstico CORREGIDO (memoria, no CPU)

La atribución anterior a saturación de CPU era **incorrecta**. Los datos de `top` aportados por el usuario la descartan: **`CPU usage: 76.52% idle`**. La carga media alta (8.49 / 7.25 / 10.48) engañaba porque en macOS cuenta también los procesos bloqueados en E/S, que es precisamente lo que produce el trasiego de memoria.

**La causa real es agotamiento de memoria y trasiego de swap:**
- `PhysMem: 35G used, 237M unused` — memoria libre prácticamente nula.
- `8755M compressor` — el sistema está comprimiendo 8,7 GB de RAM por falta de sitio.
- `1267867 swapouts` — más de 1,2 millones de páginas escritas a disco.

Cada evento táctil necesita páginas que están comprimidas o en swap; descomprimirlas o traerlas de disco cuesta decenas o cientos de milisegundos. Eso es exactamente la latencia de "unas décimas de segundo" descrita.

**Mayores consumidores de memoria (ninguno es nuestra app):**
- **iTerm2: 3210M residentes + 2896M comprimidos ≈ 6,1 GB** — historial de salida de `xcodebuild`. Mayor ganancia individual.
- `python3.12`: 1979M (1785M comprimidos), del grupo de procesos de la herramienta de agente.
- `WindowServer`: 781M · `KiroCrew Helper`: 432M

**Confirmado el indexado de los artefactos de build:** `mdbulkimport` al **28,4 % de CPU** y `mds` al 16,2 % — Spotlight está reindexando activamente, lo que valida la observación previa (`ios/build` 6,6 GB + `ios/Pods` 1,3 GB, 59.651 ficheros, sin exclusión).

**Además:** `wdavdaemon` (Microsoft Defender) acumula **3 h 04 min de CPU** y `wdavdaemon_u` está al 10,5 % — el antivirus está escaneando los ficheros que genera `xcodebuild`, un cuello de botella conocido en builds de iOS. `workflowd` acumula 6 h 04 min de CPU, cifra anómala.

**Conclusión:** el problema es del entorno, no del código de Vigor. El proceso del simulador no aparece siquiera entre los 22 procesos más costosos. Queda pendiente la build en `Release` como experimento de control para confirmarlo.

**Verificación:** `tsc --noEmit` limpio · 138 tests, 10 suites en verde.

### 2026-09-22 — Rendimiento: resultado de las mitigaciones y CIERRE de la investigación

Aplicada la exclusión de `/Users/franbecerra/vigor` completo en Spotlight → Privacidad (se eligió la carpeta del proyecto en lugar de solo `ios/` para que la exclusión sobreviva a los `expo prebuild --clean`).

**Resultado medido:**

| Métrica | Antes (15:13) | Después (15:38) |
|---|---|---|
| Memoria comprimida | 8.755 MB | **5.306 MB** |
| Memoria libre | 237 MB | 712 MB |
| **Swapouts acumulados** | 1.276.504 (creciendo) | **1.276.504 (congelado)** |
| Carga media (15 min) | 10,48 | 6,15 |
| `mds` / `mdbulkimport` | 16,2 % / 28,4 % CPU | **ausentes de la lista** |

La cifra decisiva es la de **swapouts: idéntica en tres lecturas consecutivas**. El trasiego de swap se ha detenido por completo (antes crecía ~8.600 páginas en 19 minutos). Spotlight ha desaparecido de los procesos más costosos, lo que confirma que el indexado de los 59.651 ficheros de build era un factor real.

**Confirmación de que el código de Vigor NO es el cuello de botella:** con la máquina despejada, el proceso `vigor` aparece por fin en la lista con **1,4 % de CPU y 327 MB**. Es un proceso barato.

**Límite estructural que NO se puede eliminar (Mac gestionado por la empresa):** la pila de seguridad corporativa consume de forma continua el equivalente a más de un núcleo — `dlp_agent` 25,9 %, `workflowd` 22,4 %, `wdavdaemon` ×3 (~21 % combinado), más `dlpdaemon`, `com.netskope`, `com.beyondtrust` y `epsext` (2 h 20 min de CPU acumulada). Estos agentes interceptan llamadas de sistema de ficheros y de red, lo que añade latencia a todo lo que hace el simulador. No es modificable sin permisos de administración corporativa, por lo que existe un **suelo de latencia** en este equipo del que no se puede bajar.

**Pendiente menor de entorno:** iTerm2 sigue en ~5 GB (2.666 MB residentes + 2.317 MB comprimidos) y 46,4 % de CPU. Se resuelve limitando el scrollback en sus ajustes; `xcodebuild` genera una salida enorme que lo infla en cada compilación.

**Conclusión:** la investigación se cierra. La lentitud era del entorno (presión de memoria + indexado + pila de seguridad), no de la UI. Queda como experimento de control opcional una build en `-configuration Release`, que separaría definitivamente el coste del modo Debug.

### 2026-09-22 — Temporizador de descanso, bloqueo de series completadas y valores previstos atenuados

**1. Series completadas: KG y REPS de solo lectura.** Una vez marcada la serie, el peso y las repeticiones quedan bloqueados (`editable={false}`) y pierden el borde de la caja, para que se lean como dato consolidado y no como campo de entrada. **RIR y tipo de serie siguen editables**: son los dos datos que el usuario puede querer matizar después de ejecutar (percepción de esfuerzo y naturaleza de la serie). Para cambiar peso o reps hay que desmarcar la serie, lo que es deliberado: evita alterar un registro consolidado sin querer.

**2. Valores previstos en gris atenuado.** Mientras un valor mostrado sea el PREVISTO (`actualWeight`/`actualReps` a `undefined`) se pinta con `colors.textMuted` en lugar de `textPrimary`. En cuanto el usuario lo escribe, pasa a blanco. Distingue de un vistazo lo planificado de lo realmente registrado. Se controla por campo de forma independiente con `weightIsPlanned` / `repsIsPlanned` en `SetRowData`.

**3. Temporizador de descanso — REGLA DE LA FRONTERA** (`src/services/training/restTimer.ts`, lógica pura).

> El temporizador se reinicia cuando una serie pasa a completada **y ninguna serie posterior está ya completada**. Ninguna otra acción lo toca.

Dicho de otro modo: el temporizador solo reacciona a la serie que está en la **frontera del progreso**. De esa regla se derivan los cuatro comportamientos acordados, sin casos especiales:
- Completar series en orden arranca el descanso cada vez, con la duración del perfil del ejercicio (PRD §3.4: 150 s multiarticular primario, 120 s secundario, 90 s aislamiento).
- Desmarcar y volver a marcar la ÚLTIMA serie lo reinicia: sigue siendo la frontera, porque no hay nada posterior completado.
- **Recompletar una serie ANTERIOR tras corregir un dato NO lo reinicia**: hay series posteriores completadas, luego es una corrección y no trabajo nuevo. El descanso en curso se conserva.
- Desmarcar cualquier serie **nunca** toca el temporizador.

El orden de sesión cruza ejercicios: `flattenSessionSets` aplana los ejercicios en su orden y, dentro de cada uno, sus series, de modo que corregir una serie del primer ejercicio no reinicia el descanso que arrancó una serie del tercero.

Nota de diseño: la primera formulación fue "solo completar reinicia el temporizador", que el usuario corrigió acertadamente — recompletar una serie previa tras editarla no es trabajo nuevo y no debía reiniciar nada. La condición de frontera lo resuelve sin dejar de ser una sola regla.

Decisión de implementación: el estado guarda el **instante de inicio** (`startedAt`), no los segundos restantes. El tiempo se deriva del reloj, así que no se desvía aunque la interfaz repinte de forma irregular o la app pase a segundo plano. Los ajustes de duración conservan `startedAt`, de modo que el tiempo ya transcurrido no se pierde al sumar o restar segundos.

En la pantalla, el estado de las series se espeja en un `useRef` para que la regla pueda consultar el orden completo desde dentro de un callback **estable** (meterlo en las dependencias rompería la memoización de `ExercisePage`). Tanto `updateSet` como `addSet` mantienen ese ref sincronizado.

**4. Controles del temporizador** (`src/components/train/RestTimer.tsx`): al pulsarlo se despliegan **−10 s**, **+10 s**, **reiniciar** (↺), **editar** (✎, admite `90` o `2:30`) y **descartar** (✕, en rojo semántico). El color del tiempo es el acento verde mientras corre y **ámbar** al agotarse (el color semántico manda sobre el de sección). El tick de 1 s solo se programa si hay descanso activo, para no repintar en balde.

**Verificación:** `tsc --noEmit` limpio · **181 tests, 11 suites, 100 % de cobertura** en toda la lógica (43 tests nuevos solo para `restTimer`, con los cuatro escenarios del usuario como casos de prueba explícitos, incluido el cruce entre ejercicios).

### 2026-09-22 — Decisión de diseño de E1 (Inicio/Hoy) y barra de sesión en curso

Cerrada la fase de diseño de la pantalla de inicio de Entrenamiento tras **dos iteraciones de mockups** con el usuario. Documentado en **§8.5** y **§8.6**.

**Iteración 1** — tres opciones: A (acordeón de rutinas, al estilo de la referencia aportada), B (carrusel horizontal de días del microciclo) y C (eje vertical del mesociclo). Reacción del usuario: gustó la *vista* de C pero no las rutinas como chips superiores; gustó el *aspecto* de A; gustó la tira superior de B que muestra lo ya realizado. Señaló además que no quedaba claro si se podía **elegir** la sesión entre las pendientes.

**Aportación del usuario que cambió el modelo de datos de la vista:** los días no deben ser `LUN`/`MAR` hardcodeados; al completar un entreno debe registrarse **la fecha real** y mostrarse esa. Se valoró como posible exceso ("rizar el rizo") pero se adoptó porque es **más correcto y más simple**: con microciclos de duración variable no existe correspondencia sesión↔día de la semana, y la fecha de completado ya se almacenaba.

**Corrección propia registrada:** en la iteración 1 se afirmó que la opción A "trataba el microciclo como una semana". Era **falso** — A es dirigida por rutina y no asume duración. El usuario lo señaló correctamente.

**Iteración 2** — tres combinaciones (D: rutina en cabecera; E: acordeón de A con fechas reales y selección; F: eje de C sin chips). **Elegida E**, con dos añadidos pedidos por el usuario: el raíl de avance del mesociclo debe ser **pulsable** y abrir una vista general del meso, y debe poder **previsualizarse** el entrenamiento (series, por músculo y ejercicios) sin pulsar *Empezar entrenamiento*.

**Decisiones de diseño derivadas y aprobadas:**
- Segmentos del raíl con **ancho proporcional a los días reales** de cada microciclo: hace visible la duración variable.
- Microciclo de descarga en **ámbar** (color semántico sobre acento de sección).
- Pastillas de músculo con **número de series** incorporado, para que el desglose más útil no requiera ninguna interacción.
- Previsualización en **hoja inferior** (no expandiendo la tarjeta), por el riesgo de scroll excesivo junto al acordeón y porque es la superficie donde encajará después el swap y la edición previa (E6).
- Zona de previsualización **separada del botón primario**, para no arrancar entrenos por accidente.

**Barra de sesión en curso (§8.6):** aprobada por el usuario como respuesta a su propia duda sobre si convenía ocultar las pestañas durante el entrenamiento. Se mantienen las pestañas visibles y se ancla sobre ellas una barra persistente con nombre de sesión, progreso, tiempo y cuenta atrás del descanso.

**Pendiente antes de implementar:** iconografía SVG custom. Los iconos de los mockups son de relleno, y la barra de pestañas sigue mostrando los triángulos por defecto, lo que **incumple** la norma de iconografía (§8.2: sin librerías de iconos, sin emojis, solo SVG vectoriales propios).

**Estado del código:** sin cambios en esta entrada — es exclusivamente decisión de diseño. Suite en verde: 181 tests, 11 suites, 100 % de cobertura en lógica.

### 2026-09-22 — CAMBIO DE MODELO: el microciclo se define por sesiones, no por días

Corrección de una decisión previa del PRD a raíz de una aclaración del usuario. **Invalida** el apartado "Microciclos de Duración Variable" del §3.1, que se ha reescrito por completo.

**Lo que decía antes (incorrecto):** los microciclos admitían duraciones distintas dentro de un mismo mesociclo (7, 8, 9… días); cada uno declaraba su `lengthInDays` y el mesociclo un `defaultMicrocycleLengthDays`.

**Lo que dice ahora:** todos los microciclos de un mesociclo tienen **siempre el mismo número de sesiones**, y se diferencian entre sí en la **intensidad** (principalmente) y en ajustes pequeños de **volumen**. El microciclo se define por sus **sesiones**, nunca por el calendario. Que el usuario tarde dos días más en completar uno —por descansos obligatorios o por sus circunstancias— **no se modela ni se muestra**: un microciclo de 6 sesiones puede realizarse en 9 días sin que el sistema lo registre como una propiedad del bloque.

**Cambios en el esquema** (`/Users/franbecerra/vigor/src/models/training.ts`):
- `Mesocycle.defaultMicrocycleLengthDays` → **`Mesocycle.sessionsPerMicrocycle`** (nº fijo de sesiones, uniforme).
- `Microcycle.lengthInDays` → **eliminado**. No se sustituye por ningún cálculo derivado: no hay duración en días en ningún nivel del modelo.
- `Microcycle.startedAt` / `completedAt` se conservan, pero su propósito documentado es **ordenar el histórico**, no presentar una duración al usuario.

Ambos campos estaban declarados únicamente en el modelo, sin ningún consumidor en servicios, repositorios ni UI, por lo que el cambio no arrastró refactores.

**Consecuencias en la UI ya documentadas:**
- §8.5 — retirada la idea de que los segmentos del raíl del mesociclo tuvieran **ancho proporcional a los días** de cada microciclo. Ya no hay duración variable que representar: todos los segmentos miden igual.
- §8.5 — se mantiene la decisión de mostrar **fechas reales** en las sesiones completadas, pero la justificación cambia: no es que los microciclos duren distinto, sino que el microciclo no está anclado al calendario y el usuario tarda lo que necesite, por lo que etiquetar una sesión con un día de la semana sería falso.
- §8.7 — **nueva sección**. La vista del mesociclo se replantea: al ser la estructura idéntica en todos los microciclos, un listado no aporta información. La vista pasa a mostrar la **progresión de la prescripción** (series × repeticiones × RIR por ejercicio y microciclo). Se elimina el contador de días restantes por engañoso; se conserva el de sesiones (`10 de 18`).

**Ideas adoptadas de la referencia aportada por el usuario:** conmutador **Día / Ciclo** en el volumen por músculo, y **series fraccionadas** en el recuento por grupo muscular, que reutiliza el `PROFILE_WEIGHT` ya existente del MPI.

**Verificación:** `tsc --noEmit` limpio · 181 tests, 11 suites, 100 % de cobertura en lógica. Sin cambios de comportamiento: el cambio es exclusivamente de esquema y documentación.

### 2026-09-22 — IMPLEMENTACIÓN: E1 (Inicio/Hoy), iconografía SVG propia y series avanzadas

Primera implementación de la pantalla de inicio de Entrenamiento, más la iconografía propia que la norma del §8.2 exigía y que hasta ahora estaba incumplida.

**Nueva dependencia:** `react-native-svg@15.15.4`, la versión recomendada por los docs versionados de Expo 57. Es un **módulo nativo**, por lo que obliga a **recompilar** (no basta recargar Metro). Era inevitable: no hay forma de renderizar SVG propio en React Native sin ella, y la alternativa (`expo-symbols`, SF Symbols) sería una librería de iconos del sistema, justo lo que la norma prohíbe.

**Iconografía propia** (`src/components/icons/`) — SVG de trazo, lienzo 24×24, grosor 1.8, extremos redondeados:
- `TabIcons.tsx` — los cuatro de la barra de pestañas: mancuerna (Entrenamiento), onda de pulso (Bio), llama sobre cuenco (Nutrición) y busto (Perfil). **Sustituyen a los triángulos por defecto**, que incumplían el §8.2.
- `RoutineIcons.tsx` — catálogo cerrado de 8 iconos para rutinas (`dumbbell`, `barbell`, `kettlebell`, `bodyweight`, `run`, `bike`, `stopwatch`, `mountain`) más `ROUTINE_ICONS` para resolver la clave persistida. Conjunto **cerrado** a propósito: garantiza coherencia visual y evita validar SVG arbitrario del usuario.
- Decisiones de diseño: Bio usa una **onda de pulso, no un corazón**, que se confunde con "favoritos"; Nutrición usa una **llama sobre cuenco, no una fruta**, que sesgaría el significado hacia "dieta" en lugar de "nutrición".

**Reestructuración de rutas.** La pestaña Entrenamiento pasa a ser un **stack anidado** (`src/app/(tabs)/(train)/`):
- `index.tsx` → E1 Inicio/Hoy (nuevo)
- `session.tsx` → la sesión de entrenamiento (movida desde `(tabs)/index.tsx`, sin cambios de contenido)
- `mesocycle.tsx` → vista del mesociclo (nuevo)

Se anida **dentro** de la pestaña, y no como ruta al margen de `(tabs)`, precisamente para que la **barra de pestañas siga visible durante la sesión** (§8.6): el usuario quiere poder consultar Bio o Nutrición mientras entrena.

**Componentes de E1** (`src/components/home/`): `HomeHeader.tsx` (pastillas Fuerza/Cardio y `MesoRail` pulsable), `TodayCard.tsx`, `RoutineCard.tsx` (acordeón con fechas reales y selección de sesión) y `SessionPreviewSheet.tsx` (hoja inferior con series por músculo en barras y lista de ejercicios).

**Vista del mesociclo** (`mesocycle.tsx`): gráfico de barras con un **segmento por serie**, coloreado por el RIR de cada serie, con la **sigla del tipo** dentro del segmento y **opacidad** —no líneas punteadas— para distinguir lo proyectado de lo hecho. Scroll horizontal para mesociclos de cualquier longitud.

**Lógica pura nueva, ambas al 100 %:**
- `src/services/training/advancedSets.ts` (§8.8) — 32 tests.
- `src/services/training/sessionSummary.ts` (§8.9) — 28 tests.

**i18n:** añadidos los bloques `home` (15 claves), `muscle` (los 18 grupos de `MuscleGroup`) y `meso` (6 claves) en **es, en, fr y ja**, con paridad de claves verificada. Cero texto literal en las pantallas nuevas.

**Verificación:** `tsc --noEmit` limpio · **232 tests, 13 suites, 100 % de cobertura** en toda la lógica de negocio.

**Limitaciones honestas de esta entrega:**
- **No verificado visualmente.** El agente no puede compilar iOS (restricción de sandbox documentada), y además esta entrega requiere recompilación nativa por `react-native-svg`. Los iconos y las pantallas están sin ver en dispositivo.
- La **barra de sesión en curso** (§8.6) está documentada pero **no implementada**: requiere estado global de sesión activa, que es la siguiente pieza.
- Los datos provienen de `src/mocks/home.ts`; nada está conectado todavía a los repositorios de Firestore.
- El conmutador **Día / Ciclo** del §8.7 está especificado pero no implementado en la vista.
- Las traducciones **fr** y **ja** las ha generado el agente y deberían revisarse con hablante nativo antes de publicar.

### 2026-09-22 — Icono de la aplicación

Idea del usuario: **una V cursiva en la que uno de los trazos de la V es un rayo**, sobre fondo gris carbón y con la V en verde lima.

**Construcción** (`assets/icon.svg`, fuente de verdad del diseño):
- **Brazo izquierdo de la V**: triángulo de trazo cónico, grueso arriba y en punta en el vértice. Su inclinación a la derecha aporta el aire cursivo.
- **Brazo derecho**: el rayo, formado por **dos triángulos opuestos cuyas bases se solapan**. El desplazamiento horizontal entre ambas bases produce el zigzag sin que ninguna arista se cruce, lo que evita los artefactos de relleno de un polígono autointersecante.
- Colores tomados del sistema de diseño, no inventados: fondo `#16191C` (`palette.dark.bg`, carbón y no negro puro) y marca `#9BE317` (`BRAND_LIME`).
- Sin esquinas redondeadas: iOS aplica su propia máscara.

**Decisión tomada comparando a tamaño real:** se probaron dos variantes, una de muesca suave y otra de **muesca marcada**. Se eligió la marcada porque a **60 px** —el tamaño real en la pantalla de inicio— el zigzag de la suave desaparecía y el rayo dejaba de leerse. Verificado además a 180, 120, 87, 60 y 40 px (Spotlight): la marca se mantiene legible en todos.

**Assets generados** (1024×1024 salvo el favicon), con supersampling ×4 y reescalado Lanczos para bordes limpios:
- `assets/icon.png` — iOS, cuadrado completo.
- `assets/android-icon-foreground.png` y `android-icon-monochrome.png` — la marca al **62 %** para respetar la zona segura del icono adaptativo de Android, que recorta en círculo.
- `assets/android-icon-background.png` — carbón sólido.
- `assets/splash-icon.png` — marca al 55 %, con más holgura.
- `assets/favicon.png` — 48 px.

**Corrección de `app.json`:** `android.adaptiveIcon.backgroundColor` estaba en `#E6F4FE` (azul claro del scaffold de Expo), que chocaba con la marca. Ahora es `#16191C`.

**Requiere prebuild.** Los iconos se copian durante `expo prebuild`, así que el cambio **no** se ve recargando Metro ni en una compilación ya en curso: necesita el siguiente ciclo de `prebuild` + build.

### 2026-09-22 — Icono de la app: rediseño del rayo (sustituye a la entrada anterior)

El usuario aportó una referencia de silueta concreta para el rayo, que **sustituye** el diseño de la entrada previa. Diferencias respecto a aquel:
- **Dos muescas escalonadas** en lugar de una.
- **Macizo en la parte alta** y con una **cola larga terminada en punta fina**, que es justamente el vértice de la V.
- Corte superior en diagonal, no horizontal.

**Cambio de método de construcción.** El diseño anterior se colocaba con puntos escritos a mano; con dos muescas eso es propenso a polígonos autointersecantes (que rellenan mal). Ahora la geometría se **calcula**: el rayo se define en un sistema local vertical —donde copiar la silueta de la referencia es directo—, se **rota** para alinearlo con el eje del brazo derecho de la V, y después la composición completa se **centra y encaja** en el lienzo de forma automática. Los puntos resultantes se emiten al SVG, que sigue siendo la fuente de verdad del diseño.

**Calibración elegida comparando a tamaño real.** Se generaron tres variantes cambiando anchura del rayo, inclinación y profundidad de las muescas del lado izquierdo (las que aprietan contra el brazo de la V):
- La más ancha **cerraba el hueco** de la V y la marca se leía como "V con un rayo encima" en lugar de una V cuyo trazo *es* el rayo.
- La más estrecha **perdía las muescas** al reducir de tamaño.
- Se eligió la intermedia: mantiene el hueco abierto conservando la doble muesca legible a **58 px**.

Verificado a 180, 120, 87, 60 y 40 px (Spotlight).

**Nota de criterio:** la referencia tiene una ligera irregularidad de trazo a mano en los bordes de las muescas. Se ha reproducido la silueta de forma **limpia y geométrica** a propósito: a tamaño de icono ese ruido no se percibe y sí ensucia los bordes al reescalar.

Regenerados todos los assets desde la nueva geometría (`icon.png`, foreground y monochrome de Android al 62 %, background, splash al 55 %, favicon). **Sigue requiriendo `expo prebuild`** para que el icono se copie.

### 2026-09-22 — Icono de la app: diseño DEFINITIVO (boceto del usuario)

El usuario aportó un boceto a mano que corrige la composición y añade dos requisitos. **Sustituye a las dos entradas de icono anteriores.**

**Corrección de composición:** el rayo es el brazo **IZQUIERDO**, no el derecho. Barre desde arriba a la izquierda hacia el vértice. El brazo **derecho** es el trazo cónico limpio. Las versiones previas lo tenían espejado.

**Dos tonos** (petición del usuario): el rayo en `#9BE317` (`BRAND_LIME`) y el brazo derecho en `#6FA310`, el mismo verde más oscuro. Da profundidad sin introducir un color nuevo al sistema.

**Textura sutil** (petición del usuario): grano aplicado **solo dentro de la marca**, nunca al fondo, al **10 %**. Se compararon 0 %, 10 % y 20 %: el 20 % resultaba excesivo y el 10 % se percibe en tamaño grande y desaparece a tamaño de icono, que es el comportamiento correcto. Detalle técnico que importa: el grano se aplica **después** del reescalado y con un desenfoque ligero, porque un ruido fino desaparece al reducir y, peor, se confunde con artefactos de compresión JPEG.

**Borde superior del rayo horizontal**, como en el boceto. Se consigue **pre-inclinando** el borde en el sistema local del rayo, de modo que la rotación posterior lo deje horizontal en el lienzo. Se comparó con la versión de borde inclinado y se eligió la horizontal por fidelidad al boceto y por resultar más estable visualmente.

**Ajuste tras revisión visual:** una primera calibración cerraba el hueco de la V demasiado cerca del vértice y dejaba el brazo derecho fino, de modo que ambos brazos se leían como una sola masa. Se ensanchó el brazo derecho y se desplazó su borde superior a la derecha para abrir el hueco, que es lo que hace legible una V.

**Generador en el repositorio:** `scripts/build_icon.py`. Los PNG de `assets/` son **artefactos derivados y no se editan a mano**; se regeneran desde ese script, que también emite `assets/icon.svg` con la geometría ya calculada. Antes el pipeline vivía fuera del repositorio, lo que hacía el icono irreproducible. Los parámetros que merece la pena tocar están agrupados y nombrados al principio del fichero (grosor del rayo, inclinación, profundidad de muesca, anchura del brazo derecho, intensidad del grano).

El SVG **no** lleva el grano, y está documentado por qué: un ruido fino en SVG no sobrevive al reescalado.

Verificado a 180, 120, 87, 60 y 40 px. **Requiere `expo prebuild`** para que los iconos se copien.

### 2026-09-22 — Icono: TRAZADO del boceto (fin de las aproximaciones) · área de músculos de alto fijo

**1. Icono — cambio de método tras tres intentos fallidos.**

Las tres versiones anteriores reconstruían la forma **estimando coordenadas** desde la foto del boceto, y las tres estaban mal: el rayo en el brazo equivocado, dos muescas en lugar de una, y un vértice inferior incorrecto. El usuario lo señaló las tres veces. En lugar de seguir ajustando, se cambió de enfoque: **trazar el boceto**.

Procedimiento (documentado en `scripts/build_icon.py`):
1. Umbralizado del boceto para aislar el trazo del bolígrafo, con el umbral **relativo al fondo** para tolerar la sombra desigual de la foto.
2. Dilatación para cerrar las discontinuidades que deja el bolígrafo.
3. Relleno por inundación desde el borde para separar el fondo exterior; lo que queda son las dos regiones **cerradas** por el dibujo.
4. Etiquetado de componentes conexas → rayo (69.426 px) y romboide (61.735 px).
5. Dilatación de cada región hasta la **línea central del trazo**, de modo que ambas queden adyacentes igual que en el dibujo, donde la línea es la frontera entre las dos formas.
6. Seguimiento de contorno de Moore y simplificación **Ramer–Douglas–Peucker**: 1.609 → 13 puntos el rayo, 1.289 → 8 puntos el romboide.

Forma resultante, ahora sí la del boceto: brazo **izquierdo** = rayo de **dos trazos** (una sola muesca, borde superior horizontal, barrido desde la izquierda); brazo **derecho** = **romboide**, no un triángulo en punta; ambos convergen en el vértice inferior. Colores: rayo `#9BE317`, romboide `#6FA310`, grano al 10 %.

Los polígonos quedan fijados en el generador con su nota de procedencia. Para cambiar la **forma** hay que trazar un boceto nuevo; lo que se ajusta en el script son colores, textura y encuadre.

**Lección de proceso registrada:** cuando el usuario aporta una referencia visual concreta y hay que reproducirla con fidelidad, trazar la imagen es más rápido y más fiable que estimar coordenadas a ojo, incluso contando el coste de montar el trazado.

**2. Área de músculos de la tarjeta de hoy: alto FIJO.**

Problema detectado por el usuario: el número de grupos musculares varía entre sesiones, así que la tarjeta cambiaba de alto y, al cambiar de rutina, **el contenido de debajo saltaba**.

Solución (`src/components/home/TodayCard.tsx`): el área de pastillas reserva siempre el espacio de **tres filas** (`MUSCLE_AREA_HEIGHT`), suficiente incluso para un *full body*. Las pastillas se reparten en **columnas** de tres filas y el desbordamiento se resuelve **desplazando en horizontal**, no creciendo en vertical. Las filas vacías ocupan su hueco para preservar el alto. Ya no se recorta la lista de músculos: se muestran todos.

**Verificación:** `tsc --noEmit` limpio · 232 tests, 13 suites en verde. Icono verificado a 180, 120, 87, 60 y 40 px. **Requiere `expo prebuild`** para que los iconos se copien.

### 2026-09-22 — Icono: acabado moderno (bisel, degradado, sombra y textura)

El usuario aportó una referencia renderizada con **la forma ya correcta** (la trazada de su boceto) pidiendo "un poco más de textura, más moderno y brillante". El cambio es por tanto de **acabado**, no de geometría.

**Tratamiento aplicado** (`scripts/build_icon.py`), todo con una única dirección de luz coherente, desde arriba a la izquierda:
- **Degradado diagonal** en cada forma, más claro arriba a la izquierda. Se construye a 64×64 y se amplía con bicúbica: un degradado suave escala sin pérdida visible y evita iterar sobre millones de píxeles en Python.
- **Bisel**: filo claro en el borde superior-izquierdo y oscuro en el inferior-derecho. Se obtiene **restando la máscara desplazada a la máscara original**, lo que deja exactamente el reborde de un solo lado, y desenfocando ligeramente el resultado.
- **Sombra proyectada** de la marca sobre el fondo, desenfocada y desplazada hacia abajo-derecha.
- **Viñeta** radial sutil en el fondo, para que el centro respire.
- **Grano** sobre fondo y marca, con intensidades independientes.

**Corrección técnica que importa:** el grano estaba aplicado en modo **multiplicar**, que solo puede oscurecer. Con una cantidad apreciable de textura eso bajaba el brillo medio y el verde lima **viraba a oliva** — comparado con la referencia se veía apagado y sucio. Se cambió a **superposición sobre un ruido de media neutra**, que aclara y oscurece por igual: añade textura sin alterar la luminosidad. Además se subieron los tonos base y se afinó el grano (menos desenfoque, menos cantidad) porque la primera versión salía moteada en lugar de mate.

**Parámetros agrupados al principio del script** para poder ajustar el acabado sin tocar la lógica: intensidad de grano de marca y fondo por separado, grosor e intensidad de los dos filos del bisel, y desplazamiento, desenfoque y opacidad de la sombra.

**Variantes sin relieve, a propósito:** el favicon (48 px) y la versión monocroma de Android se generan con `finish=False`. A esos tamaños y en esa variante el relieve no se percibe y solo ensucia los bordes.

El **SVG sigue en color plano** y está documentado por qué: el acabado es un efecto de rasterizado, y reproducirlo en SVG lo haría divergir del pipeline que genera los assets reales.

`app.json` — `android.adaptiveIcon.backgroundColor` alineado con el fondo generado (`#111315`) para que el color de reserva no difiera del PNG.

Verificado a 420, 120, 87, 60 y 40 px. **Requiere `expo prebuild`.**

### 2026-09-22 — Icono: se abandona la reinterpretación; referencia del usuario como base directa

El usuario rechazó el acabado generado (granulado visible en el fondo y demasiados trazos) y pidió empezar de nuevo usando **la última imagen aportada como base**, sin reinterpretarla. Decisión aplicada:

- `assets/icon-reference.png` conserva la imagen fuente del usuario (1254×1254).
- `assets/icon.png` es su derivado directo a 1024×1024 para iOS.
- No se añaden a esa variante textura sintética, biseles, sombras ni geometría reconstruida. La referencia manda.
- `scripts/build_icon.py` queda como herramienta experimental/documental y **no debe ejecutarse** mientras esta decisión esté vigente, porque regeneraría los assets desde una interpretación geométrica. Si se quiere cambiar el icono, se parte de una nueva referencia visual aprobada por el usuario, no del trazado anterior.

**Cápsula inferior:** `BAR_MARGIN` 34 → **54 px** en `src/app/(tabs)/_layout.tsx`, para que la barra flotante no intente ocupar casi todo el ancho de pantalla.

**Nota honesta:** el cambio del icono requiere un nuevo `expo prebuild` + build para entrar en el bundle nativo. La barra inferior es JavaScript y basta con recargar Metro una vez la build incluya los cambios.

### 2026-09-23 — Cápsula con ancho determinista · mesociclo seleccionable · RIR por serie

**1. La cápsula de pestañas ya se estrecha de verdad.** Los intentos previos con `BAR_MARGIN` y con porcentajes (`left`/`right`) no funcionaban: el navegador de pestañas reescribe ese estilo y la barra acababa ocupando todo el ancho o quedando anclada a la izquierda. Ahora el ancho se calcula en **puntos** desde `useWindowDimensions` (`76 %` del ancho) y se centra con un `left` explícito, anulando `right`. Es determinista y no depende de cómo la librería interprete los porcentajes.

**2. Traducción que faltaba.** El gráfico mostraba literalmente `RIR meso.average`, una clave sin resolver. Añadidas `meso.average`, `meso.perSetIntensity` y `meso.volume` en **es, en, fr y ja**.

**3. Microciclos seleccionables.** Cada columna del gráfico es ahora pulsable y fija el microciclo cuya prescripción se lista debajo. El microciclo EN CURSO sigue distinguiéndose por opacidad, y el SELECCIONADO por borde de acento más fondo de superficie: son dos estados distintos y se ven como tales.

**4. Gráfico más compacto.** La altura máxima de barra baja de 88 a 56 pt y las columnas de 78 a 58 pt de ancho. La observación del usuario era correcta: ocupaba mucho espacio para poca información.

**5. RIR por serie, no un valor fijo** (`src/services/training/setIntensity.ts`, lógica pura). El badge único por ejercicio contradecía lo ya acordado: la prescripción real deja más reserva en las primeras series y aprieta en las últimas. `deriveSetRIRs` genera la lista a partir del RIR objetivo y del número de series de trabajo (un ejercicio a RIR 2 con 3 series queda **4 · 3 · 2**), y `adjustSetRIRs` aplica el endurecimiento del microciclo elegido.

Decisión de diseño: el RIR por serie se **deriva**, no se escribe a mano en los datos. Un campo paralelo se desincronizaría del número de series en cuanto se añadiera o quitara una.

**6. Datos de ejemplo con progresión real.** Todos los microciclos mostraban `19 series` y `RIR 1.3` porque el mock no diferenciaba su prescripción. Ahora cada uno lleva `volumeAdjustmentSets` e `intensityAdjustmentRIR`, con la descarga recortando volumen y devolviendo reserva.

**Verificación:** `tsc --noEmit` limpio · **257 tests, 15 suites, 100 % de cobertura** en toda la lógica de negocio.

**Nota de entorno (diagnóstico de esta sesión):** el `CommandError: No development build (com.vigor.app) ... is installed` tras un `prebuild --clean` **no es un fallo de la app**: `expo start` sirve el bundle pero no compila ni instala, así que hay que reconstruir con `xcodebuild` e instalar con `simctl` antes de volver a usar Metro. Y el crash de `PosterBoard` reportado es de un servicio interno del simulador (fondos y widgets), sin relación con Vigor: no aparece `com.vigor.app` ni ningún módulo del proyecto en su stack.

### 2026-09-23 — Alineación del gráfico del mesociclo

Las columnas aparecían a distintas alturas. Causa concreta: la etiqueta **DESCARGA** no cabía en el ancho de columna (58 pt) y se partía en **dos líneas**, empujando hacia abajo la barra, la cifra de volumen y el badge de RIR de esa columna. Como cada columna se alineaba por su propio contenido, una sola etiqueta de dos líneas desalineaba toda la fila.

Arreglo, en dos partes:
- Etiqueta corta `meso.deloadShort` (`DESC.` / `DELOAD` / `DÉCH.` / `調整`) más `numberOfLines={1}`, para que no pueda partirse en ningún idioma.
- **Alturas fijas** en cada zona de la columna: etiqueta 13 pt, área de barra `MAX_BAR_HEIGHT`, cifra de volumen 17 pt. Así la alineación no depende del contenido y no volverá a romperse porque una cifra pase a tres dígitos o una traducción sea más larga.

Decisión de fondo: se prefiere reservar altura antes que confiar en que el texto quepa. El mismo criterio ya se aplicó al área de músculos de la tarjeta de hoy (§8.5), donde un número variable de grupos musculares movía el contenido inferior.

**Verificación:** `tsc --noEmit` limpio · 257 tests, 15 suites, 100 % de cobertura en lógica.

### 2026-09-23 — Capa de datos: reglas de seguridad, sesión de usuario y persistencia de la sesión

Cierre del ciclo de datos en Entrenamiento. Hasta ahora todo vivía en memoria: cerrar la app perdía el entrenamiento.

**1. Reglas de seguridad reales** (`firestore.rules`). Sustituyen al **modo de prueba**, que permitía lectura y escritura a cualquiera y además caduca. Principios aplicados:
- Nada accesible sin autenticación.
- La propiedad se comprueba por el campo **`userId` del documento**, no solo por la ruta. Existen `ownsExisting` (puedes leer lo tuyo), `ownsIncoming` (no puedes crear datos a nombre de otro) y `keepsOwner` (una actualización no puede cambiar de dueño).
- Todo lo que vive bajo `users/{uid}/**` es exclusivo de ese usuario, sin excepción: biomarcadores, lesiones, dolor, rehabilitación y readiness (§7).
- El **catálogo de ejercicios** es de lectura para autenticados y de **escritura prohibida** desde el cliente: alterarlo afectaría a las prescripciones de todos los usuarios.
- **Deny por defecto** al final: cualquier ruta no contemplada queda cerrada.

**2. Autenticación: sesión anónima como puente a Apple.** Apple Sign-In requiere la capability que una cuenta de desarrollador gratuita no puede firmar, y por eso se retiró de `app.json`. Bloquear la persistencia hasta tener cuenta de pago habría dejado la app sin datos reales indefinidamente.

Solución: `signInAnonymously()`. Firebase crea un usuario **real con su propio `uid`**, así que las reglas de seguridad y la separación por usuario funcionan exactamente igual que con cualquier otro método.

La pieza que lo convierte en decisión y no en parche: **`linkWithApple()` vincula la sesión anónima a una cuenta Apple CONSERVANDO el `uid`**. Como todos los datos se indexan por `uid`, el historial de entrenamiento sobrevive a la migración. Empezar en anónimo es el primer paso del camino correcto, no deuda técnica.

Limitación declarada: una sesión anónima vive en su dispositivo. Si el usuario borra la app, pierde el acceso a esos datos porque no hay credencial que permita recuperarlos. **Aceptable en desarrollo, no para publicar.**

**3. Estado de sesión global** (`src/hooks/useAuth.tsx`). `AuthProvider` envuelve la app por encima del Stack, porque cualquier pantalla puede necesitar el `uid`. Distingue explícitamente **`isLoading`** de "sin datos": sin esa distinción, una lista cargando y una lista vacía se ven igual, que es un error clásico. El listener de Firebase es la única fuente de verdad del usuario.

**4. Conversión pantalla ↔ documento** (`src/services/training/sessionMapper.ts`, lógica pura). La pantalla trabaja con un mapa `exerciseId -> series[]` porque es lo que necesita el carrusel; Firestore guarda una lista ordenada de `WorkoutExercise`. Decisiones:
- **El invariante que se testea es la reversibilidad**: guardar y volver a leer devuelve las mismas series, en el mismo orden, con los mismos tramos. Si no lo fuera, el usuario perdería trabajo real al reabrir.
- `isCompleted` **no se persiste**: se deriva de que existan `actualReps` y `actualWeight`. Guardar ambas cosas permitiría que se contradijeran.
- El orden lo manda la sesión, no las claves del objeto: el orden de claves de un objeto no es garantía sobre la que construir un historial.
- `completedAt` se **omite** en lugar de escribirse como `undefined`, que Firestore rechaza.

**5. Persistencia con escritura diferida** (`src/hooks/useSessionPersistence.ts`):
- **Debounce de 1,2 s.** Escribir en cada pulsación generaría una escritura por carácter mientras se teclea un peso. El usuario no nota la diferencia; la cuota de Firestore sí.
- **La red no bloquea la interfaz.** El estado local manda mientras se entrena. La caché en disco de RN Firebase encola las escrituras sin cobertura y sincroniza al recuperar red (§2.1): entrenar en un sótano sin señal es el caso normal, no la excepción.
- **No se guarda una sesión vacía**: abrir y salir sin registrar nada no debe dejar documentos huérfanos.
- **No se escribe antes de intentar recuperar**, porque hacerlo sobreescribiría con el estado inicial una sesión ya empezada.
- Al desmontar se vuelca lo pendiente: salir de la pantalla no pierde los últimos segundos.

**6. Indicador de guardado** en la cabecera de sesión. Aparece solo cuando hay algo que decir: `Guardando…` mientras escribe y un aviso **persistente** en ámbar si falló, porque un fallo de guardado implica riesgo de perder datos. Un "guardado ✓" permanente sería ruido.

**7. Tests de repositorios con Firestore simulado** (`BaseRepository.test.ts`, 11 tests). Se simula el módulo en lugar de golpear la base real: lo que se verifica es **nuestra** lógica (cómo se arma la referencia, cómo se inyecta el `id`, qué ocurre si el documento no existe), no el comportamiento de Firestore. Cubre el punto delicado: `create` guarda **sin** el campo `id` y `get` lo vuelve a inyectar; si esa simetría se rompiera, los objetos saldrían de la base de datos sin id.

**Corrección de configuración:** `app.json` declaraba **`expo-router` dos veces** en `plugins`.

**Verificación:** `tsc --noEmit` limpio · **288 tests, 17 suites, 100 % de cobertura** en lógica de negocio y en la capa de repositorios.

**PENDIENTE CRÍTICO — acción manual del usuario:** las reglas de `firestore.rules` están escritas pero **NO desplegadas**. Mientras no se publiquen en la consola de Firebase (o con `firebase deploy --only firestore:rules`), la base de datos sigue en modo de prueba y abierta. El fichero no surte efecto por existir en el repositorio.

### 2026-09-23 — Autenticación con Google · el anónimo deja de ser la puerta por defecto

Corrección de criterio a raíz de una objeción acertada del usuario: dejar la autenticación anónima como vía de entrada por defecto abre un vector de abuso.

**El análisis de riesgo, con precisión.** No es una brecha de datos: las reglas de `firestore.rules` aíslan por `uid` sea la sesión anónima o no. Lo que sí es real es **amplificación de coste**: la API key de Firebase viaja dentro del binario —es pública por diseño, no un secreto— así que con el proveedor anónimo habilitado cualquiera puede extraerla y crear cuentas en bucle vía la API REST de Auth, cada una escribiendo en sus propios documentos y generando factura.

**Matiz que conviene no perder:** Google no resuelve el abuso automatizado por sí solo. Lo que lo resuelve específicamente es **Firebase App Check** (App Attest en iOS), que verifica que las peticiones vienen de la app genuina y no de un script. Queda pendiente, junto con alertas de presupuesto en Google Cloud.

**Lo implementado:**
- `@react-native-google-signin/google-signin@16.1.5` más su config plugin en `app.json`. No requiere ninguna capability de Apple: el client ID sale del plist y el URL scheme de iOS lo genera el plugin desde `REVERSED_CLIENT_ID`. Verificado en los docs de Expo 57.
- `GoogleService-Info.plist` sustituido por el que ya incluye `CLIENT_ID` y `REVERSED_CLIENT_ID` (el anterior no los tenía porque Google no estaba habilitado como proveedor). Comprobada la coherencia de `BUNDLE_ID` y `PROJECT_ID` antes de instalarlo, con copia de seguridad del anterior, añadida al `.gitignore`.
- `signInWithGoogle`, `linkWithGoogle` y `signOut` (que cierra también la sesión de Google, para que el siguiente acceso vuelva a preguntar).
- **`SignInCancelledError`**: cancelar el diálogo NO es un fallo. Sin esta distinción, cerrar el selector de cuenta mostraría un mensaje de error al usuario.
- `GoogleSignin.configure()` es **perezoso e idempotente**: se llama antes de usarlo, no al arrancar, para no trabajar si el usuario ya tiene sesión guardada y nunca toca el botón. Tampoco se pasa `webClientId` a mano: con el plist presente el SDK lee el cliente correcto, y escribirlo duplicaría una fuente de verdad.

**El anónimo se conserva, pero degradado a opción explícita** (`continueWithoutAccount`). `AuthProvider` ya **no** abre sesión automáticamente: toda sesión nace de una acción del usuario. Sigue siendo útil —permite entrenar sin fricción— y `linkWithGoogle()` lo convierte después conservando el `uid`, así que el historial sobrevive a la conversión.

**Puerta de autenticación** (`AuthGate` en el layout raíz). Va en la raíz y no dentro de cada pantalla a propósito: así no existe forma de añadir una pantalla nueva y olvidarse de protegerla. Maneja **tres** estados, no dos: mientras Firebase restaura la sesión del disco no se sabe si hay usuario, y pintar el login en ese hueco provocaría un parpadeo en cada arranque.

**Pantalla de acceso** (`src/components/auth/SignInScreen.tsx`): Google como acción primaria sólida; "probar sin cuenta" secundaria y discreta, **con su coste declarado** en lugar de escondido.

**Pantalla de Perfil**: identidad actual, vinculación con Google si la sesión es anónima, y cierre de sesión. La advertencia de pérdida irreversible aparece **solo** cuando cerrar sesión implica realmente perder el acceso, es decir en sesión anónima.

**Sobre Apple:** el código (`signInWithApple`, `linkWithApple`) sigue listo. Requiere la capability, que exige cuenta de pago. Dato relevante para planificar: la **directriz 4.8 de la App Store** obliga a ofrecer Sign in with Apple si se ofrece un login social de terceros, así que publicar en iOS con Google implica pagar la cuenta de todos modos.

**Verificación:** `tsc --noEmit` limpio · 288 tests, 17 suites, 100 % de cobertura en lógica.

**PENDIENTE — requiere recompilación nativa:** `@react-native-google-signin/google-signin` es un módulo nativo, así que el login con Google no funcionará hasta ejecutar `expo prebuild` y reconstruir e instalar la app.

**PENDIENTE de seguridad, por orden de importancia:** (1) deshabilitar el proveedor **Anonymous** en la consola de Firebase si se decide no ofrecer la entrada sin cuenta; (2) activar **App Check**; (3) configurar **alertas de presupuesto** en Google Cloud.

### 2026-09-24 — Cimientos del generador: taxonomía biomecánica, plan de volumen y banco de pruebas

Primer bloque del generador de mesociclos (§3.6), que el usuario identificó como el diferencial de la app.

**1. `MovementVector` reescrito: de 7 patrones a 25.** El usuario señaló acertadamente que la taxonomía era insuficiente. El defecto concreto: `ISOLATION` era un cajón de sastre donde convivían curl de bíceps, elevación lateral, extensión de cuádriceps y crunch. Consecuencias que eso provocaba:
- El generador **no podía equilibrar** trabajo de aislamiento, porque no distinguía flexión de codo de extensión de codo.
- El veto biomecánico por lesión (§4.1) no podía vetar una articulación concreta sin vetar todo el aislamiento del cuerpo.

Los patrones de aislamiento se nombran ahora por **articulación + acción**, que es lo que un veto clínico necesita señalar: flexión y extensión de codo; abducción, abducción horizontal, aducción horizontal, flexión y **extensión** de hombro (esta última añadida a petición del usuario: pullovers); elevación escapular; extensión y flexión de rodilla; extensión aislada, abducción y aducción de cadera; flexión plantar y dorsiflexión de tobillo; flexión y extensión de columna; y antimovimiento de core. Entre los multiarticulares se añaden **unilateral de rodilla** y **transporte cargado**.

Añadido también `ANTAGONIST_PAIRS`: el generador lo usa para no producir sesiones desequilibradas (tres empujes y ninguna tracción), que es una causa conocida de problemas de hombro a medio plazo.

La migración se hizo con el compilador señalando cada uso: mocks y test del motor de swap actualizados, con `ISOLATION` traducido al patrón preciso en cada caso (cruces → aducción horizontal de hombro; tríceps en cuerda → extensión de codo).

**2. Campos nuevos en `Exercise`:**
- `equipment` — permite excluir lo que el atleta no puede ejecutar. Sugerir prensa a quien entrena en casa hace inservible la propuesta.
- `effectiveness` (1-5) — **peso de selección del generador**. Resuelve el problema que planteó el usuario: la elección es aleatoria **ponderada**, no uniforme, así que los ejercicios de mayor estímulo salen más a menudo sin que los demás desaparezcan. Evita el popurrí de ejercicios raros. Criterio: rango en posición alargada, estabilidad, perfil de resistencia y capacidad de progresar carga. Es un valor de contenido, ajustable sin tocar el algoritmo.
- `illustration` (opcional) — inicio y final de la concéntrica. Opcional a propósito: el catálogo es utilizable sin ellas y se añaden por lotes sin migrar datos.

**3. `AthleteTrainingProfile`** (`src/models/athlete.ts`), separado de `UserProfile` porque son cosas distintas: identidad frente a parámetros del generador. Incluye nivel de experiencia, volumen reciente declarado, material disponible, **`vetoedExerciseIds`** (petición del usuario: vetar un ejercicio que no le gusta o no tiene), músculos priorizados, escala de intensidad y unidad de peso preferida.

Decisión: el veto se modela como lista explícita **y además** existe el filtro por material, porque son cosas distintas — se puede tener la máquina y aun así no querer el ejercicio.

**4. Cadena de cálculo del volumen** (`src/services/training/volumePlan.ts`, lógica pura). Confirmada con el usuario:

```
nivel de experiencia  ─┐
                       ├─→  MEV / MAV / MRV por músculo  ─→  MEAV del mesociclo
volumen declarado     ─┘
```

- `VOLUME_LANDMARKS` da los cuatro puntos de referencia por músculo para un intermedio; `EXPERIENCE_SCALING` deriva principiante (0,7) y avanzado (1,15). Un principiante no es que "deba hacer menos": su umbral efectivo y su techo están más abajo.
- **El volumen declarado prevalece** sobre la tabla. Si alguien lleva tiempo haciendo N series y progresando, ese N está en su zona adaptativa, y es mejor dato que cualquier promedio poblacional. Se acota al MRV de su nivel para no convertir un volumen desmedido en una prescripción irrecuperable.
- `meavFor` sitúa el objetivo entre MEV y MAV (45 % del rango) sin prioridad, y **en el MAV** con prioridad — que es donde el rendimiento por serie empieza a caer y por tanto no tiene sentido pasar.
- **El MRV es techo absoluto**: nunca se prescribe por encima, ni priorizando.
- `volumeWarnings` **informa en lugar de corregir en silencio**: es el atleta quien decide si acepta una carga alta, pero debe saberlo.

**Unidad: series por MICROCICLO, no por semana.** El modelo no tiene semanas (§3.1), así que expresar el volumen en semanas habría reintroducido el calendario por la puerta de atrás.

**5. Banco de pruebas relanzable** (`scripts/volume-harness.ts`, `npm run volume`). Idea del usuario y es la correcta: iterar sobre el cálculo dentro de la app obligaría a recompilar y navegar hasta la pantalla en cada cambio.

```bash
npm run volume
npm run volume -- --level=beginner --priority=CHEST,LATS
npm run volume -- --declared=BICEPS:24
npm run volume -- --compare
```

Imprime tabla con los cuatro puntos de referencia, el MEAV resultante, el origen de cada valor (declarado o estimado) y los avisos. `--compare` pone los tres niveles en columnas. Valida contra el enum: un músculo mal escrito falla con la lista de válidos en lugar de ignorarse en silencio.

**6. Corrección de criterio sobre la testabilidad del generador.** El agente planteó que la aleatoriedad exigía semilla *para poder testear*. El usuario corrigió con mejor criterio: lo que se testea son las **invariantes** —volumen por músculo, equilibrio de vectores, topes por sesión, asignación de intensidad— que son deterministas aunque el ejercicio concreto varíe. Al algoritmo le da igual que salga sentadilla hack o libre. La semilla es una **función de producto**: el botón de refrescar hasta obtener un conjunto que guste. Queda registrado porque cambia el diseño del generador.

**Verificación:** `tsc --noEmit` limpio · **314 tests, 18 suites, 100 % de cobertura** en lógica de negocio y repositorios.

**Estado de las unidades imperiales:** `src/i18n/units.ts` ya resuelve kg/lb según la región y está al 100 % de cobertura. Falta **cablearlo a la interfaz** (la tabla de series tiene `kg` escrito a mano) y respetar `AthleteTrainingProfile.weightUnit` para quien quiera forzarlo.

**Pendiente del generador, en orden:** catálogo de ejercicios poblado · modelo `Routine` como plantilla · selección ponderada de ejercicios con equilibrio de vectores y veto · instanciación del mesociclo · pantallas de creación y edición.

**Nota abierta sobre ilustraciones:** el formato SVG no es la limitación (admite color y cualquier nivel de detalle); el coste está en el **dibujo**, que es trabajo de ilustración, no de programación. Un camino viable es un **esqueleto parametrizado**: definir una figura articulada una vez y describir cada ejercicio como dos conjuntos de ángulos (inicio y final de la concéntrica). Eso convierte 200 ilustraciones en 200 filas de datos y garantiza consistencia, a cambio de un resultado esquemático y no ilustrado. Sin decidir.

### 2026-09-24 — Catálogo de ejercicios y selección ponderada

**1. `src/data/exercises.json` — catálogo de 113 ejercicios, editable a mano.**

Antes no existía: los 18 ejercicios visibles estaban incrustados en `src/mocks/session.ts`, mezclados con datos de sesión falsos. El formato es **JSON plano, un objeto por ejercicio, sin anidamiento**, elegido para que el usuario pueda analizarlo con pandas o una hoja de cálculo y editarlo sin pasar por el compilador. `src/data/README.md` documenta cada campo y el criterio de puntuación.

**Traducciones fuera del catálogo.** El `name` es la etiqueta en español y la traducción se resuelve por clave `exercises.<id>`, con el `name` como respaldo. Cuatro idiomas en línea habrían cuadruplicado el fichero y arruinado su edición manual, que es su razón de ser.

**2. `ADDUCTORS` añadido a `MuscleGroup`.** Incoherencia introducida en el cambio anterior: existía el vector `HIP_ADDUCTION` sin ningún grupo muscular al que acreditar volumen, así que un aductor en máquina no habría contado nada. Detectada al poblar el catálogo.

**3. Cargador con validación** (`exerciseCatalogue.ts`). Un catálogo que se edita a mano tendrá un músculo mal escrito antes o después; sin validación ese valor llegaría al generador como `undefined` y produciría una rutina silenciosamente incorrecta. Ahora falla al importar, nombrando el ejercicio y el campo. Rechaza además dos cosas que pasarían inadvertidas: **ids duplicados** y un **músculo principal repetido como secundario** (acreditaría 1,5 series por serie ejecutada, inflando el volumen sin que se note).

**4. `exerciseSelection.ts` — selección ponderada con semilla.**

El peso de cada candidato combina tres cosas: su **efectividad** del catálogo, un **refuerzo a los multiarticulares** mientras queda volumen por cubrir (que los pone primero sin necesitar una regla de orden aparte, porque cuando la necesidad es alta su peso domina), y una **penalización a los vectores ya usados**.

Funciona en dos fases, y la separación es la que evita el defecto descrito abajo:
- **Fase 1** elige qué ejercicios entran, cada uno con el mínimo de series.
- **Fase 2** reparte el volumen que falta entre los ya elegidos, empezando por los de mayor efectividad. Sumar series a un buen ejercicio es preferible a añadir otro mediocre.

**Defecto corregido durante el desarrollo.** Con un mínimo de 2 series el algoritmo repartió 13 series de deltoides lateral entre **cuatro variantes de elevación lateral**, y 9 de gemelos entre cuatro variantes de elevación de gemelos. No eran ejercicios raros, sino redundantes: el mismo defecto de fondo con otra cara. La causa era la fragmentación, no la aleatoriedad. Corregido subiendo el mínimo a 3 series, el tope a 6 y bajando el máximo de ejercicios por músculo a 3. Resultado: de 4 variantes por músculo a 2 o 3, con más series cada una.

**5. Series EJECUTADAS frente a ATRIBUIDAS.**

Una serie de press de banca se ejecuta una vez pero acredita 1 al pecho y 0,5 al tríceps y al deltoides frontal: **2 atribuidas por 1 ejecutada**. Por eso los 178 del plan de volumen no eran 178 series de trabajo. Ambas cifras hacen falta: el MEAV se cubre con volumen **atribuido**, pero lo que cansa al atleta y ocupa la sesión son las **ejecutadas**.

Para un intermedio de cuerpo completo: **124 ejecutadas, 183 atribuidas, factor 1,48×, 34 ejercicios**.

**6. Restos frente a huecos reales.** Un déficit menor que el mínimo de series de un ejercicio no se puede cerrar sin pasarse del objetivo, y son cosas distintas que el aviso debe distinguir. Un resto de 1 serie en el deltoides frontal es lo que queda cuando el músculo se nutre de trabajo indirecto; cerrarlo con tres series de elevación frontal empeoraría el plan. Un hueco de 8 series sí es un problema, y casi siempre significa que el material o los vetos dejaron al músculo sin ejercicios: con solo mancuernas y peso corporal el script avisa de que faltan 3 series de deltoides posterior y 3 de gemelos, que es un hueco real del catálogo.

**7. El criterio de testabilidad, aplicado.** Los tests fijan las **invariantes** y no los nombres, como estableció el usuario:
- Misma semilla, propuesta idéntica.
- **El volumen se mantiene estable entre semillas** (123 a 131 ejecutadas en cinco semillas) **mientras los ejercicios varían** (16 a 20 de 34 en común con la primera).
- Las atribuidas son las ejecutadas más el crédito de los secundarios, comprobado recalculando desde cero.
- Ningún ejercicio pasa del tope, ningún músculo recibe más ejercicios que el tope, ningún ejercicio se repite.
- Un ejercicio vetado no aparece nunca; material no disponible tampoco.
- Un músculo puede quedar cubierto **solo con crédito indirecto**: 6 series de press cubren un objetivo de 3 de tríceps sin ningún ejercicio de tríceps.

**8. Dos scripts relanzables.**

```bash
npm run volume                                   # plan + ejercicios + ambas cifras de series
npm run volume -- --seed=7                       # otra propuesta
npm run volume -- --seeds=5                       # el volumen se mantiene, los ejercicios no
npm run volume -- --equipment=DUMBBELL,BODYWEIGHT  # gimnasio en casa
npm run volume -- --veto=press-banca,sentadilla-libre
npm run volume -- --level=advanced --priority=LATS --declared=BICEPS:20

npm run catalogue                  # cobertura por músculo, vector y material
npm run catalogue -- --validate    # pásalo tras editar el JSON a mano
npm run catalogue -- --muscle=LATS # detalle de un músculo
```

The earlier catalogue audit found gaps in the legacy rhomboid and middle-trapezius buckets. Those buckets were superseded on 2026-09-28 by the functional `MID_BACK` group; catalogue coverage is now validated against the current taxonomy.

**Verificación:** `tsc --noEmit` limpio · **380 tests, 20 suites, 100 % de líneas, ramas, funciones y sentencias** en lógica de negocio y repositorios.

**Pendiente inmediato:** el reparto entre sesiones. La selección trabaja a nivel de **microciclo** (qué ejercicios y cuántas series en total); todavía no reparte ese trabajo entre las sesiones según la estructura del split, que es el siguiente paso y lo que hace falta antes de tocar pantallas. El usuario debe revisar las puntuaciones de efectividad del catálogo, que son la parte de contenido que más influye en la calidad de la propuesta.

### 2026-09-24 — Corrección de fondo: el volumen se presupuesta por REGIÓN, no por músculo

El plan anterior prescribía **124 series ejecutadas** por microciclo para un intermedio, cuando el rango de referencia es 40-90. El usuario lo señaló y aportó los rangos de la literatura. Había dos causas independientes, y ninguna era la aleatoriedad.

**Cause 1: applying regional landmarks to every sub-muscle.** In the legacy taxonomy, lats, rhomboids, middle/lower trapezius and upper trapezius each inherited a full back budget and produced **43 attributed sets**. The current taxonomy prevents that duplication by combining the horizontal-row retractors into `MID_BACK` and moving upper-trapezius/cervical work into the optional `NECK` region.

**Causa 2: prescribir volumen a los diecinueve grupos musculares.** El plan asignaba MEAV a todos, incluidos tibial, aductores, lumbar, trapecio superior y deltoides frontal, que reciben trabajo indirecto suficiente o aportan poco a hipertrofia, fuerza y salud.

#### Capa de región

`VolumeRegion` (16 regions) is where the budget lives. Each region declares its muscles and its share:

- `CHEST` → one chest budget (100 %); press angle is handled as stimulus variety.
- `BACK` → lats 55 %, mid back 45 %.
- The remaining regions contain one muscle group each.

Una porción con reparto bajo **no es menos importante**: significa que ya recibe mucho crédito indirecto. El romboides se lleva poco directo porque todo remo lo acredita.

Los hombros van en tres regiones separadas y no en una porque sus porciones no comparten presupuesto en la práctica: el deltoides lateral necesita y tolera mucho más volumen directo que el frontal, que se nutre de todo el empuje.

`REGION_OF_MUSCLE` se **deriva** de las definiciones en lugar de escribirse a mano, para que no puedan desincronizarse. Un test comprueba que cada músculo pertenece a exactamente una región y que cada reparto suma 1.

#### Regiones desactivadas por defecto

`DELTS_FRONT`, `NECK`, `ERECTORS`, `TIBIALIS`, `ADDUCTORS` and `CALVES` are disabled by default and can be enabled explicitly. Neck work is not inferred from ordinary compounds: direct cervical exercise and upper-trapezius work share the optional `NECK` budget.

#### Eje de objetivo

`TrainingGoal` = `HYPERTROPHY` | `STRENGTH`, con factor 1 y 0,7. La fuerza busca adaptaciones neurales y especificidad, así que necesita menos volumen: la referencia da 6-15 series en intermedios frente a 10-20 en hipertrofia. El escalado por nivel se recalibró a 0,65 / 1 / 1,3 para cuadrar con los rangos aportados (6-12 / 10-20 / 12-30).

#### El no prioritario se queda CERCA del MEV, y el principiante EN el MEV

`NON_PRIORITY_RANGE_FRACTION` pasa a depender del nivel: principiante 0, intermedio 0,2, avanzado 0,35. Aplica el patrón que describe la referencia: concentrar volumen en los músculos prioritarios y mantener el resto en su mínimo efectivo.

El caso del principiante lo destapó el propio script. Con 0,2 salía a **53 series ejecutadas** frente a un rango de 20-50: con diez regiones activas, cualquier margen sobre el mínimo lo saca de rango. Y en esa etapa mejorar la técnica y progresar en carga rinde más que añadir series, así que quedarse en el MEV no es una concesión.

#### Techo de volumen total, y las dos unidades que no se mezclan

`TOTAL_SETS_RANGE` codifica los rangos de volumen total por objetivo y nivel, y `totalSetsVerdict` devuelve `below` / `within` / `above`. Es la comprobación de sensatez del conjunto: **un plan que suma bien músculo a músculo puede seguir siendo una barbaridad en total**, que es exactamente lo que pasaba.

La distinción que faltaba explicitar y que hacía parecer aceptables 124 series:

- **Por músculo el volumen es ATRIBUIDO.** Una serie de press acredita 1 al pecho y 0,5 al tríceps. Los rangos por grupo muscular de la literatura se cuentan así.
- **El total de la rutina es EJECUTADO.** Series duras hechas en el gimnasio. Los rangos de volumen total se cuentan así.

Comparar uno con el otro fue el error.

#### Resultado

| | atribuidas | ejecutadas | rango |
|---|---|---|---|
| Principiante · hipertrofia | 59 | **48** | 20-50 |
| Intermedio · hipertrofia | 98 | **76** | 40-90 |
| Avanzado · hipertrofia | 140 | **110** | 60-140 |
| Principiante · fuerza | 42 | **30** | 15-40 |
| Intermedio · fuerza | 70 | **58** | 30-70 |
| Avanzado · fuerza | 94 | **68** | 50-120 |

Los seis dentro de rango. Espalda: **13 series repartidas en dorsal 7, romboides 3, trapecio medio 3**, frente a las 43 anteriores. El plan de intermedio queda en 22 ejercicios.

#### La invariante que faltaba

Los tests comprobaban el volumen por músculo y el equilibrio de vectores, pero **nada comprobaba el total**, y por eso pasó un plan de 124 series. Añadido: cada combinación de nivel y objetivo debe dar `within`, se mantiene con ocho semillas distintas, activar todas las regiones y priorizar todo debe dar `above`, y un plan casi vacío debe dar `below`. Un techo que no se comprueba no es un techo.

#### Nuevos parámetros del script

```bash
npm run volume -- --goal=strength
npm run volume -- --regions=CHEST,BACK,QUADS,HAMSTRINGS   # solo estas
npm run volume -- --add-regions=CALVES,TRAPS              # además de las de serie
npm run volume -- --declared=BACK:20,BICEPS:16            # ahora por REGIÓN
npm run volume -- --compare                               # niveles con su rango
```

El plan se imprime por región con el reparto entre músculos, y la línea de totales dice si cae dentro del rango de referencia.

**Verificación:** `tsc --noEmit` limpio · **402 tests, 20 suites, 100 % de líneas, ramas, funciones y sentencias**.

#### CONTRADICCIÓN ABIERTA, pendiente de decisión del usuario

La referencia aportada describe **volumen progresivo dentro del mesociclo**: semana 1 cerca del MEV, subida gradual, semana 5 cerca del MRV, semana 6 descarga. El §3 de este PRD especifica lo contrario, **Volumen Estático basado en MEAV**: el volumen no sube dentro del mesociclo y la progresión intra-mesociclo recae en carga, repeticiones y e1RM.

No se ha cambiado nada por esto. Son dos modelos de programación distintos y defendibles, y la decisión es del usuario:

- **Estático** (lo implementado): el volumen es el mismo en todos los microciclos, sube la carga. Más simple de seguir y de medir, porque solo varía una cosa a la vez.
- **Progresivo** (lo que describe la referencia): el volumen sube microciclo a microciclo desde el MEV hacia el MRV. Acumula más estímulo pero también más fatiga, y exige que el motor de descarga funcione bien porque el final del mesociclo es deliberadamente insostenible.

Implementar el progresivo afecta a `Mesocycle.targetVolumePerGroup` (un valor por microciclo en lugar de uno fijo), a la vista de mesociclo, al gráfico de progresión y a los disparadores de descarga.

### 2026-09-24 — Énfasis por región, volumen de descarga y calibración al límite superior

**Decisión cerrada: el volumen es ESTÁTICO dentro del mesociclo.** El usuario confirma el §3 y descarta el volumen progresivo que describía su documento de referencia. La contradicción registrada en la entrada anterior queda resuelta a favor del PRD.

#### Énfasis: tres niveles en lugar de un booleano

`RegionEmphasis` sustituye a `isPriority`:

| Énfasis | Volumen objetivo | Para qué |
|---|---|---|
| `PRIORITY` | entre MAV y MRV (60 % del tramo) | el músculo que se quiere hacer progresar |
| `NORMAL` | parte alta del rango adaptativo | comportamiento por defecto |
| `DEPRIORITIZED` | entre MV y MEV | conservar sin gastar recuperación |

El énfasis se declara por **músculo** (un toque en la pantalla de creación) y se aplica por **región**, porque es donde vive el presupuesto: no se puede subir el dorsal sin subir la espalda. Dos músculos de la misma región cuentan como una sola prioridad.

**`PRIORITY` no llega al MRV, y eso se sigue de la decisión de volumen estático.** El MRV es por definición el máximo recuperable, así que prescribirlo en un volumen que no varía significa vivir en el borde de lo recuperable durante los cuatro a seis microciclos enteros. En un modelo progresivo el MRV se toca solo en el último microciclo; en uno estático no se toca.

#### Presupuesto de prioridades

Petición del usuario: hasta 2 grupos, 3 si son pequeños. Implementado como presupuesto de **plazas**, que cubre todos los casos con una sola regla: una región cara ocupa una plaza, una barata media, presupuesto 2, tope duro de 3 regiones.

- espalda + cuádriceps → 2 plazas ✓
- espalda + bíceps + tríceps → 2 plazas ✓
- bíceps + tríceps + gemelos → 1,5 plazas ✓
- espalda + cuádriceps + pecho → 3 plazas ✗
- cuatro regiones baratas → 2 plazas, pero **rechazado por el tope de 3**: cabría en el presupuesto y no sería una priorización, sería un plan sin foco.

`LOW_COST_REGIONS` no agrupa por tamaño del músculo sino por **coste de recuperación**: priorizar bíceps o gemelos no compite con el resto del entrenamiento como priorizar espalda o cuádriceps. El deltoides lateral entra aunque absorba mucho volumen, porque ese volumen no es sistémicamente caro.

Hasta **3 regiones desprioriorizadas**, sin más restricción. `assertEmphasisLimits` **lanza** en lugar de recortar en silencio: la pantalla debe impedir el cuarto toque, y si llega al motor es un error de programa. Rechaza también que una región esté priorizada y desprioriorizada a la vez.

#### El trade de volumen es AUTOMÁTICO

Medido: priorizar dos regiones caras sin compensar daba **102 series ejecutadas con un rango de 40-90**. El volumen total está acotado por lo que el atleta puede recuperar, así que subir dos regiones sin bajar nada deja el plan por encima de su techo.

`NORMAL_RANGE_FRACTION_WITH_PRIORITY` (0 / 0 / 0,2) baja las regiones normales al mínimo efectivo cuando hay prioridades. Es lo que hace un entrenador, y exigirle al atleta que lo compense a mano desprioriorizando tres regiones convertiría una decisión de programación en un rompecabezas de presupuesto. Con el trade automático, priorizar dos regiones caras da 76-87 según semilla: dentro de rango.

#### Volumen de descarga

`DELOAD_VOLUME_FACTOR = 0,5` y `deloadVolumePlan(plan)`, que **se deriva del plan en vigor y no de las referencias**: el recorte es relativo a lo que el atleta venía haciendo, y la mitad de un mesociclo con la espalda priorizada no es la mitad de un mesociclo genérico. El −50 % ya estaba documentado en `deloadTriggers.ts` pero ninguna función lo calculaba.

El recorte **no baja del volumen de mantenimiento**: bajar del MV durante la descarga costaría masa, que es lo contrario de su función. Los énfasis se conservan para que la vista de mesociclo siga mostrando qué se estaba priorizando.

`VolumePlan.isDeload` cambia cómo se juzga el plan. Sin ese campo la descarga disparaba **10 avisos de "por debajo del MEV"**, cuando estar por debajo del MEV es precisamente su objetivo. Y el veredicto de volumen total no la compara contra el rango de acumulación, porque daría siempre `below` y no diría nada: en su lugar el script la expresa como porcentaje de la acumulación. Medido: **41 series, 47 % de las 88**.

#### Calibración al límite superior del rango

Petición del usuario: que el volumen se acerque al límite superior del rango del nivel. `NORMAL_RANGE_FRACTION` queda en **0 / 0,4 / 0,8**, calibrado con el banco de pruebas sobre veinte semillas:

| | ejecutadas | rango | posición |
|---|---|---|---|
| Principiante · hipertrofia | 42-48 | 20-50 | 93 % |
| Intermedio · hipertrofia | 84-87 | 40-90 | 94 % |
| Avanzado · hipertrofia | 128-134 | 60-140 | 94 % |

**El margen hasta el techo es deliberado, no conservadurismo.** Apuntando al 98 % del techo, seis de cada ocho semillas se salían del rango: la selección es aleatoria y un plan que elige más multiarticulares necesita **menos series ejecutadas** para el mismo volumen atribuido, así que la cifra que se compara con el techo varía entre semillas aunque el presupuesto no cambie. La calibración deja sitio para esa variación.

El **principiante se queda en el MEV** (fracción 0). Con diez regiones activas su rango total es estrecho y cualquier margen lo saca: a 0,1 tocaba 50 exactos en una de veinte semillas. Además coincide con la referencia, que en esa etapa da prioridad a la técnica y a la progresión de carga sobre el volumen.

#### Salida del script compactada

La **primera línea es el veredicto** y dice si el plan es sano sin leer nada más:

```
✓ intermediate · hypertrophy  84 ejecutadas de 40-90  · 134.5 atribuidas 1.60×  · 22 ejercicios  · sin huecos
```

Un `✓` verde o un `!` ámbar, y el `!` aparece si el total sale de rango o hay huecos reales. El plan pasa a una línea por región con el reparto en la misma fila, los ejercicios a una línea cada uno agrupados bajo su región, y las marcas `▲` y `▼` señalan el énfasis. `--brief` imprime solo el veredicto.

Parámetros nuevos: `--deprioritize=`, `--deload`, `--brief`.

#### Tests

- `PRIORITY` queda entre MAV y MRV sin llegar al MRV, `DEPRIORITIZED` entre MV y MEV, y el orden desprioriorizado < normal < prioritario se cumple en los tres niveles.
- El presupuesto de plazas acepta 2 caras, 1 cara + 2 baratas y 3 baratas; rechaza 3 caras y 4 baratas.
- **El volumen cae en el 75 % superior de su rango** en los tres niveles, que es el requisito explícito del usuario.
- **Veinte semillas** dentro de rango, no ocho: ocho no habrían detectado el problema de calibración.
- La descarga recorta a la mitad, no baja del MV, conserva los énfasis, y no avisa de estar por debajo del MEV, mientras el mismo plan marcado como acumulación **sí** avisa.

**Verificación:** `tsc --noEmit` limpio · **429 tests, 20 suites, 100 % de líneas, ramas, funciones y sentencias**.

#### Hallazgos abiertos

**Priorizar tres regiones como principiante sale de rango** (57 ejecutadas de 20-50). El límite de plazas lo permite y el veredicto lo señala, siguiendo el principio del PRD de informar en lugar de corregir en silencio. Queda a criterio del usuario si la pantalla debe además desaconsejarlo: especializar sin base es una señal de alarma de programación, pero no se ha añadido una regla que el usuario no ha pedido.

**Priorizar tres regiones Y activar una nueva a la vez** también sale de rango en el intermedio (99 de 40-90). Son dos decisiones de volumen sumadas; el veredicto las detecta.

### 2026-09-24 — Corrección del techo del avanzado

El documento de referencia daba 60-140 o más series ejecutadas para un avanzado orientado a hipertrofia, y el plan calibrado salía a 128-135. El usuario lo rechaza por criterio de programación: **en la práctica un avanzado se mueve más cerca de 100 que de 140**, y prescribir 135 series porque el extremo de una horquilla poblacional lo permite produce un plan que nadie sostiene.

`TOTAL_SETS_RANGE` baja para el avanzado:

| | antes | ahora |
|---|---|---|
| Avanzado · hipertrofia | 60-140 | **60-120** |
| Avanzado · fuerza | 50-120 | **50-100** |

La fuerza baja también para que su techo siga por debajo del de hipertrofia, que es la relación que codifica el eje de objetivo. Estos rangos son **contenido**, y el criterio de quien programa manda sobre el extremo de una horquilla poblacional.

Se bajó el techo **además de** la fracción, no solo la fracción. Dejando el techo en 140 y el plan en 105, el plan habría quedado en el 56 % del rango y la invariante de "cerca del límite superior" habría dejado de significar nada: el techo declarado y el volumen prescrito describirían cosas distintas.

`NORMAL_RANGE_FRACTION` del avanzado pasa de 0,8 a **0,4**, la misma que el intermedio. Que compartan fracción no iguala su volumen: las referencias del avanzado están escaladas un 30 % más arriba, así que recibe más volumen por sus referencias y no por su fracción. El test que afirmaba lo contrario estaba escrito sobre un fixture de referencias compartidas y se ha corregido para comprobar la razón verdadera.

**Medido sobre 20 semillas por combinación, 120 ejecuciones, todas dentro de rango:**

| | ejecutadas | rango |
|---|---|---|
| Principiante · hipertrofia | 42-48 | 20-50 |
| Intermedio · hipertrofia | 82-88 | 40-90 |
| Avanzado · hipertrofia | 108-115 | 60-120 |
| Principiante · fuerza | 25-31 | 15-40 |
| Intermedio · fuerza | 56-64 | 30-70 |
| Avanzado · fuerza | 73-84 | 50-100 |

**Cerrado sin cambios por decisión del usuario:** priorizar tres regiones siendo principiante, y priorizar tres regiones activando además una nueva, quedan fuera de rango y el veredicto lo señala. Un principiante no debería priorizar nada, así que el aviso es la respuesta correcta y no hace falta una regla que lo bloquee.

**Verificación:** `tsc --noEmit` limpio · **430 tests, 20 suites, 100 % de líneas, ramas, funciones y sentencias**.

### 2026-09-24 — El techo de TIEMPO: capacidad real del atleta

Hueco de fondo señalado por el usuario. El volumen tiene **dos techos** y manda el más bajo:

- **RECUPERACIÓN** — el MRV y el rango de volumen total del nivel. Es lo único que modelaba el generador.
- **TIEMPO** — las sesiones que caben en la semana del atleta y los minutos de cada una.

El de tiempo suele ser el que limita de verdad, y por mucho. Un intermedio recupera 84 series por microciclo, pero en **tres sesiones de una hora le caben 39**: el hueco es de más de la mitad. Prescribirle el plan de recuperación produce una rutina que abandona a la tercera sesión, no porque no la recupere sino porque no le da tiempo a acabarla. Es un modo de fallo que ninguna comprobación anterior detectaba, porque todas miraban la recuperación.

#### Capacidad en el perfil del atleta

`sessionsPerMicrocycle` y `sessionLength`, este último en **bandas** (`SHORT` 30-45, `STANDARD` 45-60, `LONG` 60-75, `EXTENDED` 75-90). Bandas y no un número libre porque nadie sabe si dispone de 52 o de 58 minutos, y pedir una precisión falsa produce datos peores que pedir un intervalo.

**Se planifica con el extremo INFERIOR de la banda.** Quien dice "entre 45 y 60 minutos" tiene 45 garantizados y el resto es suerte; planificar con 60 produce sesiones que no termina.

#### Modelo de tiempo reutilizado, no nuevo

`trainingCapacity.ts` usa `WORK_SECONDS_PER_SET` de `sessionSummary.ts` y `restDurationFor` de `restTimer.ts`, que son **los mismos números con los que la app cronometra la sesión**. Un segundo modelo de tiempo acabaría contradiciendo al primero, y el atleta vería en la pantalla de sesión una estimación que no cuadra con la que usó el generador. Un test lo fija explícitamente.

Además del trabajo y los descansos se cuentan dos costes que no producen volumen pero sí consumen tiempo: `SESSION_OVERHEAD_MINUTES = 6` de calentamiento por sesión, y `EXERCISE_SETUP_SECONDS = 75` de montaje por aparición de cada ejercicio. No contarlos es la forma más fácil de prescribir una sesión que no cabe.

Calibración: con los descansos reales de la app (120 s aislamiento, 180 s multiarticular) **una hora da para 15-16 series**, unos 5-6 ejercicios. Coincide con la estimación del usuario ("como muchísimo para 6 ejercicios, o menos si son muy difíciles o pesados"), y se ha preferido mantener la coherencia con el cronómetro antes que ajustar los descansos para llegar a una cifra más redonda.

#### La escalera de recorte: dos tramos

`squeezedMeav` aplica el orden que describió el usuario, con `PROTECTED_REGIONS` = pecho, espalda, cuádriceps, isquios, glúteo:

| Recorte | Regiones protegidas | Las demás |
|---|---|---|
| 0 → 1 | bajan solo al **mínimo efectivo** | bajan al **mantenimiento** |
| 1 → 2 | bajan también al mantenimiento | ya están en mantenimiento |

Los grupos grandes conservan volumen de adaptación efectiva mientras haya algo más que recortar, y solo se tocan cuando no queda otra. Que todo acabe en mantenimiento es un resultado aceptable; que los grandes bajen antes que el aislamiento, no.

El recorte se busca por **bisección sobre la selección REAL**, no sobre una estimación: el coste en minutos depende de qué ejercicios salen, porque un multiarticular descansa 180 s y un aislamiento 120 s. Se busca el recorte MÍNIMO que cabe, así que se cede el volumen justo y no más: medido, el plan usa 215 de 216 minutos disponibles.

#### El aislamiento es lo primero que sobra, y es una REGLA

Tres intentos hasta dar con el criterio correcto, y los dos primeros están registrados porque el fallo es instructivo:

1. **Refuerzo plano a multiarticulares.** Insuficiente. Peor: el refuerzo normal se apaga cuando baja el volumen pendiente, así que un plan recortado elegía **más** aislamiento, exactamente al revés de lo que conviene.
2. **Ponderación por volumen atribuido por minuto.** Mejor criterio, pero probabilística: seguía produciendo un pecho con contractor y cruces como único trabajo y **sin ningún press**. Con tres horas semanales eso es un defecto visible.
   - Y destapó un culpable inesperado: **la penalización por diversidad de vectores estaba empujando hacia el aislamiento**. Sissy y extensión de cuádriceps ocupan `KNEE_EXTENSION`, un vector sin usar, mientras las sentadillas comparten `KNEE_DOMINANT` y se penalizan entre sí. Premiar la variedad de patrones favorecía justo lo que debía sobrar. Con el tiempo como techo la penalización baja de 0,6 a 0,15.
3. **Regla dura** (implementado): con el tiempo como techo, el aislamiento solo entra cuando **no queda ningún multiarticular** para ese músculo. Los músculos sin multiarticular en el catálogo (bíceps, deltoides lateral, gemelos, core) reciben su aislamiento igual, porque ahí no hay alternativa.

`attributedVolumePerMinute` se mantiene para ordenar **entre** multiarticulares: un remo con barra acredita 3 series en los mismos 220 s que una extensión de cuádriceps acredita 1.

**Consecuencia medible y bonita:** en el plan de 3×1 h, bíceps y tríceps **no reciben ningún ejercicio directo** y aun así cubren su objetivo de mantenimiento, con 5 y 4,5 series atribuidas procedentes de los remos y los presses. Con tres horas semanales es exactamente lo correcto. El factor de atribución sube de 1,60× a 1,98×.

#### `not-applicable`: un veredicto que faltaba

Un plan recortado por tiempo daba `FUERA de 40-90` con 39 series. Falso positivo del mismo tipo que el de la descarga: cuando manda el techo de tiempo, **el rango de recuperación no es la vara de medir**. Estar por debajo es la consecuencia de tener tres horas, no un defecto del plan.

`TotalVolumeVerdict` gana el valor `not-applicable`, que devuelven la descarga y los planes con `capacityCapped`. La vara de medir pasa a ser los minutos: `limitedBy` dice cuál de los dos techos manda, y son situaciones distintas que el atleta debe poder distinguir, porque **"no te da tiempo" se arregla con más sesiones y "no lo recuperarías" no**.

`limitedBy` tiene un tercer valor, `insufficient-time`: ni con todo en mantenimiento cabe el plan. Se devuelve el plan mínimo y se dice por qué, en lugar de recortar por debajo del mantenimiento, que ya no sería entrenar. El badge del script **nunca sale verde** en ese caso, aunque el veredicto de volumen sea `not-applicable`.

#### Gradiente medido, 20 combinaciones

| Sesiones × banda | ejecutadas | atribuidas | limita | recorte |
|---|---|---|---|---|
| 2 × 30-45 | 21 | 41,5 | **tiempo insuficiente** | 2,00 |
| 3 × 30-45 | 21 | 41,5 | **tiempo insuficiente** | 2,00 |
| 3 × 45-60 | 24 | 44 | tiempo | 1,75 |
| 3 × 60-75 | 39 | 75 | tiempo | 1,08 |
| 4 × 45-60 | 38 | 73 | tiempo | 1,10 |
| 4 × 60-75 | 55 | 100 | tiempo | 0,56 |
| 5 × 45-60 | 48 | 91,5 | tiempo | 0,72 |
| 5 × 75-90 | 84 | 134,5 | **recuperación** | — |
| 6 × 60-75 | 84 | 134,5 | **recuperación** | — |

Monótono, y con **meseta arriba**: a partir de cierta capacidad el techo vuelve a ser la recuperación y el volumen deja de crecer. Es la prueba de que los dos techos conviven y gana el más bajo.

#### Nuevos parámetros del script

```bash
npm run volume -- --sessions=3 --time=LONG       # el caso del usuario
npm run volume -- --sessions=4 --time=STANDARD
```

La línea de capacidad dice minutos usados de disponibles, cuál de los dos techos manda y el recorte aplicado.

#### Capa corregida

`SessionLengthBand` y `SESSION_LENGTH_MINUTES` viven en `src/models/athlete.ts` y no en el servicio. Se colocaron primero en `trainingCapacity.ts`, lo que obligaba al modelo a importar de `services` e invertía las capas.

**Verificación:** `tsc --noEmit` limpio · **477 tests, 22 suites, 100 % de líneas, ramas, funciones y sentencias**.

**Pendiente:** el reparto entre sesiones sigue sin implementar, así que `TYPICAL_SETS_PER_APPEARANCE = 3` es una aproximación para estimar cuántas veces se paga el montaje de cada ejercicio. Cuando exista el reparto real, ese número deja de ser una suposición y se calcula.

### 2026-09-24 — El tiempo por sesión lo escribe el atleta

Corrección del usuario, y simplifica el código en lugar de complicarlo.

**El error de interpretación.** Modelé `SessionLengthBand` como un intervalo (`STANDARD` = 45-60) y tuve que decidir con qué extremo planificar, eligiendo el inferior para no prescribir sesiones que no terminan. La lectura correcta del usuario es que una banda es un **techo**: "hasta 60 minutos". Con esa lectura la decisión de qué extremo tomar no existe, así que estaba resolviendo un problema que yo mismo había creado.

**Y la mejor solución es no tener bandas.** El atleta escribe los minutos. Al algoritmo le da igual la cifra, y el propio atleta es quien sabe si tiene 40 o 75 minutos. Eliminados `SessionLengthBand`, `SESSION_LENGTH_MINUTES` y `plannedMinutesPerSession`: un enum, una tabla de conversión, una función y una capa de interpretación menos. `AthleteTrainingProfile.minutesPerSession` y `TrainingCapacity.minutesPerSession` son ahora un número.

**Los extremos no se corrigen en silencio**, y esto no cuesta código extra: un tiempo absurdamente bajo produce `insufficient-time`, que es información útil; uno absurdamente alto queda acotado por el techo de recuperación, que es donde ya estaba el límite.

El script pasa a `--minutes=N`, y acepta cualquier valor: `--sessions=3 --minutes=52` da 32 series ejecutadas usando 131 de 138 minutos.

**Verificación:** `tsc --noEmit` limpio · **478 tests, 22 suites, 100 % de líneas, ramas, funciones y sentencias**.

**No implementado, señalado por el usuario en el mismo mensaje:** que una sesión corta implique además **intensidad más alta desde el principio del mesociclo**. Es coherente —con menos volumen se compensa con más proximidad al fallo— pero toca el motor de RIR (§3.4, `rirAutoregulation.ts`, `targetRIR()`), que tiene sus propias reglas de progresión, y no se ha tocado sin decisión explícita.

### 2026-09-24 — Split-aware session distribution and per-session time ceiling

The mesocycle generator now completes the step between exercise selection and a usable routine: every selected working set is assigned to one concrete session in the microcycle.

**Evidence boundary.** Split choice is treated as a logistical preference, not as a physiological optimisation claim. A 2024 systematic review and meta-analysis found no significant strength or hypertrophy difference between split and full-body routines when volume is equated ([Baz-Valle et al., 2024](https://pubmed.ncbi.nlm.nih.gov/38595233/)). The same volume-equated principle applies to frequency for hypertrophy ([Schoenfeld, Grgic & Krieger, 2019](https://pubmed.ncbi.nlm.nih.gov/30558493/)). Therefore, the generator preserves the selected microcycle volume; the split only determines which compatible session receives each exercise.

**Implementation.**

- `AthleteTrainingProfile.splitStructure` persists the athlete's selected structure.
- `sessionDistribution.ts` supports Full Body, Upper/Lower, Push/Pull/Legs, and PPL+Upper. The session-count mapping in this historical entry was superseded on 2026-09-28 by the canonical PPL/PPLU/PPLUL/PPLPPL rule documented below.
- Each exercise appearance was initially capped at three working sets; the current rule is the 3–4 set cap documented in the 2026-09-28 entry below.
- The least-loaded compatible session receives the next appearance. This preserves every selected set exactly once, produces stable output for the same input, and reports any unassigned work instead of dropping it silently.
- `planMesocycle` now validates the real duration of **each** distributed session, including exercise setup, work, and the same rest durations used by the session timer. The bisection squeeze is accepted only when every session fits. Aggregate microcycle minutes are retained for reporting but no longer hide an overloaded individual session.

**Validation (historical snapshot).** `tsc --noEmit` clean; 491 tests in 23 suites; 100% statements, branches, functions, and lines for covered business logic. The appearance cap and split mapping were subsequently revised in the 2026-09-28 entry.

### 2026-09-24 — Biomechanical session sequencing for every split

Session distribution now sequences work for **AUTO and every manual split**. The rule is not a fabricated calendar rule: Vigor models ordered sessions rather than days, so it does not claim that every athlete needs a fixed 24- or 48-hour interval. Instead, it avoids immediate consecutive planned exposures with a high biomechanical overlap whenever a compatible alternative session exists.

**Why this is a constraint, not an efficacy claim.** Evidence does not justify declaring one split universally superior at equal volume ([Ramos-Campo et al., 2024](https://pubmed.ncbi.nlm.nih.gov/38595233/)). It does support avoiding unnecessary fatigue before an exercise whose performance matters: strength gains are greatest for exercises placed at the beginning of a session, and multi-joint exercise strength favours multi-joint-before-single-joint order ([Nunes et al., 2021](https://pubmed.ncbi.nlm.nih.gov/32077380/)). Training to failure also produces greater acute fatigue and can extend recovery requirements ([Vieira et al., 2022](https://pubmed.ncbi.nlm.nih.gov/34881412/)). The new score is therefore deliberately conservative and transparent: it is a sequencing heuristic based on planned biomechanical overlap, not a diagnosis of recovery.

**Rule.** For every candidate session, `sessionDistribution.ts` scores work in the immediately previous and next sessions:

- shared primary and secondary muscles are weighted by their fractional volume credit;
- compound-primary work has the highest fatigue cost, compound-secondary follows, and isolation the lowest;
- sharing the same `MovementVector` adds a specific penalty.

The lowest-risk compatible slot wins; estimated duration breaks ties. Thus a planned barbell squat is placed away from a preceding heavy leg press when another compatible session exists. The same exercise is never duplicated in a session while another compatible slot exists, preserving the appearance cap (now 3–4 sets).

`DistributionInput.previousSession` and `MesocyclePlanInput.previousSession` accept the previous completed or planned session, allowing the caller that instantiates a later microcycle to carry real prior work into its sequence. The current mock-only UI has no routine instantiation flow yet, so it does not supply that value; the engine explicitly supports it rather than pretending to know execution data it has not received.

If a user-selected split makes the overlap unavoidable (for example one full-body session following another), the generator keeps the prescribed volume and returns a `SequencingWarning` with the involved sessions, shared muscles, vector overlap, and risk. This is intentionally not a silent volume cut or an automatic split override.

**Validation.** `tsc --noEmit` clean; 493 tests in 23 suites; 100% statements, branches, functions, and lines for covered business logic. Tests cover the squat-after-leg-press case, carry-over from a supplied prior session, unavoidable warnings, all split structures, time capacity, and volume conservation.

### 2026-09-24 — Reparto entre sesiones: estructura derivada del volumen y tope por músculo y sesión

Dos defectos medidos en el reparto anterior, más un requisito nuevo. El orden de decisiones queda invertido respecto a como estaba: **primero el volumen, después la estructura**.

#### Defecto 1: la frecuencia de cada enfoque salía de ciclar un patrón

`focusSequence` repetía el patrón del split con módulo, sin mirar cuánto trabajo debía absorber cada enfoque. Consecuencias medidas:

- **PPL con 5 sesiones** daba `PUSH:2 PULL:2 LEGS:1`. Todo el trabajo de pierna caía en una sesión, esa sesión saturaba su presupuesto de tiempo (66 de 69 min) y la bisección de capacidad recortaba **el plan entero** hasta que cupiera el cuello de botella: **38 series ejecutadas donde torso/pierna llegaba a 84** para el mismo atleta.
- **PPL+Upper con 6 sesiones** producía una **sesión vacía**.

Ninguno lo detectaba la cobertura, porque son propiedades de calidad y no ramas de código.

**Historical correction.** `buildFocusSequence` initially assigned extra sessions to the focus with the most current load. That fixed the first throttling defect, but its load-driven PPL variants were superseded on 2026-09-28 by the deterministic movement-family sequence documented below.

`SPLIT_VOCABULARY` recoge las estructuras que funcionaban en la primera versión y queda conservado como historial. La regla vigente es la secuencia canónica PPL/PPLU/PPLUL/PPLPPL de la entrada del 2026-09-28.

**Error corregido durante el desarrollo:** la primera fórmula de presión dividía por `asignadas + 1`, que mide la carga *después* de la decisión. Con 100 minutos de pierna y 40 de torso producía `UPPER, LOWER, LOWER, LOWER, LOWER`, donde el cuarto día de pierna cargaba 25 minutos frente a los 40 del de torso. Debe comparar la carga **actual** por sesión.

#### Defecto 2: sesiones vacías

Además de la estructura, hay una **reparación determinista**: si alguna sesión queda sin trabajo, se mueve una aparición desde la sesión más cargada que pueda cederla. Solo es imposible cuando hay menos apariciones que sesiones, y entonces se informa.

#### Los minutos son la unidad de equilibrio, no las series

Las sesiones deben llevar carga parecida, pero **no el mismo número de series**: una serie de multiarticular pesado cuesta unos 3,7 minutos y una de aislamiento unos 2,7. Igualar MINUTOS produce el resultado buscado por sí solo, con menos series en los días duros y más en los de aislamiento, sin una regla aparte.

#### Los splits son preferencias, no muros

La pertenencia a un enfoque pasa de veto a **coste**. Una sesión de empuje puede absorber parte del trabajo de pierna cuando la alternativa es un día de pierna saturado, que es lo que el usuario señaló de su propia rutina. El split sigue dando forma al plan porque el coste de desajuste domina siempre que una sesión bien emparejada tenga sitio.

La pieza que lo hace funcionar es que el distribuidor **conoce el tope de tiempo por sesión** (`maxWorkMinutesPerSession`). Sin él saturaba la única sesión que un enfoque poseía y la búsqueda de capacidad recortaba todo el plan. Con él, el desbordamiento se convierte en un desajuste de enfoque, que es el mejor intercambio disponible.

#### Requisito nuevo: tope de volumen por músculo y sesión

Dentro de una misma sesión la respuesta hipertrófica sigue una curva cóncava de rendimientos decrecientes: entre 1 y 4 series efectivas capturan la mayor parte del estímulo disponible, entre 6 y 10 capturan prácticamente toda la adaptación productiva, y 10-12 es el techo productivo de un atleta natural. Por encima, la fatiga central reduce el reclutamiento de unidades motoras de alto umbral a igual esfuerzo percibido, y el daño muscular desproporcionado desvía la síntesis proteica a reparación en lugar de supercompensación, alargando la recuperación más allá de 72-96 h y arruinando la frecuencia semanal del plan.

El distribuidor **no tenía ningún tope**: el peor caso medido eran **11 series directas de cuádriceps en una sesión** (PPL 3×90), justo en el borde, sin nada que lo impidiera.

Topes implementados:

| | tope por sesión |
|---|---|
| Músculo monoarticular o de fatiga rápida (bíceps, tríceps, deltoides, gemelos, core, lumbar, aductores, trapecio) | **8** |
| Músculo grande o complejo (pecho, dorsal, romboides, cuádriceps, isquios, glúteo) | **10** |
| Grande con **dos o más patrones de movimiento** distintos en la sesión | **12** |
| Techo absoluto de volumen basura | **12** |

**El presupuesto se mide en series EFECTIVAS**, contando el crédito indirecto: una serie directa cuenta 1 y un secundario 0,5. Así un solo número expresa las dos reglas — el tope de series directas y el hecho de que el press de banca ya da al tríceps media serie de estímulo por serie ejecutada, reduciendo su capacidad de tolerar series directas adicionales en la misma sesión.

**Cuando el volumen semanal excede lo que una sesión puede absorber, el coste de desbordamiento fuerza frecuencia 2 o 3**: dos sesiones de 8 en lugar de una de 16. No hay una regla de frecuencia aparte, porque esta la produce.

#### La frecuencia 2 ya la daba el tope de aparición

Registrado porque era un error mío: escribí una rama explícita para forzar frecuencia 2 y era **código muerto**. Con un tope de 3 series por aparición, cualquier músculo con 4 o más series se reparte en dos sesiones por sí solo; con 3 o menos, la única alternativa sería partir 2+1, y una aparición de una serie cuesta un montaje entero para casi nada. `TARGET_MUSCLE_FREQUENCY` solo define cuándo merece la pena **informar** de frecuencia 1, y los músculos desprioriorizados están exentos de ese aviso.

`appearanceSets` también se simplificó: reparto uniforme en lugar de llenar el tope primero, así que 4 series son 2+2 y no 3+1. El bucle de sobras anterior volcaba todo el exceso en la última aparición cuando había menos sesiones que apariciones necesarias; ahora el exceso inevitable se reparte.

#### Resultado sobre 20 combinaciones de split y capacidad

| caso | antes | ahora |
|---|---|---|
| AUTO 5 sesiones × 75 min | 38 | **84** |
| PPL 5 × 75 | 38 | **84** |
| PPL+Upper 4 × 60 | 32 | **46** |
| PPL+Upper 6 × 75 | 38 | **84** |
| Torso/pierna 3 × 60 | 32 | 38 |

**Cero sesiones vacías y cero violaciones del tope por músculo** en las 20 combinaciones; el peor caso queda exactamente en el tope (deltoides lateral 8/8, bíceps 8/8). Once de las veinte alcanzan ya el techo de recuperación. La carga por sesión pasa de `29/22/54/26` a `47/40/45/54`.

Los avisos de frecuencia 1 que quedan corresponden a splits que la fuerzan por estructura: PPL con 3 sesiones da frecuencia 1 a todo, y es la consecuencia correcta de elegir un split de tres vías para tres sesiones. Se informa, no se sustituye el split.

**Verificación:** `tsc --noEmit` limpio · **533 tests, 23 suites, 100 % de líneas, ramas, funciones y sentencias**.

#### Convención de idioma fijada

Todo el código, comentarios, identificadores, tests y mensajes de commit en **inglés**; `PRD.md` en **español**, porque es el documento de lectura del usuario. La entrada anterior del changelog quedó en inglés por seguir solo la mitad de la regla; queda pendiente traducirla y migrar los comentarios en español del resto de módulos.

### 2026-09-24 — Recalibración del modelo de tiempo: tres tramos de descanso

El usuario señaló que el modelo iba corto: en una hora entran unas 18 series sin apuro, y el planificador solo encajaba 15-16. Tenía razón, y el fallo es mío de forma registrada: en la entrada del 24 de septiembre sobre el techo de tiempo escribí que prefería *"mantener la coherencia con el cronómetro antes que ajustar los descansos"*. Mantuve la coherencia con un valor que debí cuestionar.

**La causa.** `restDurationFor` metía `COMPOUND_PRIMARY` y `COMPOUND_SECONDARY` en el mismo cajón a 180 s. Ese es un descanso de entrenamiento de fuerza, no de hipertrofia, y aplicarlo a una prensa guiada igual que a una sentadilla libre inflaba el coste de toda sesión con multiarticulares.

**Los valores se deducen del dato, no se tantean.** Una hora representativa son 6 ejercicios de 3 series, dos por perfil, más calentamiento y montajes:

```
6 min calentamiento + 6 montajes + 18 series de trabajo + descansos = 3600 s
```

De ahí salen **150 s primario, 120 s secundario, 90 s aislamiento** y montaje de **60 s** (antes 75): la cuenta da exactamente 60,0 minutos para 18 series. Un test lo fija, así que si alguien cambia un tramo de descanso el banco de pruebas avisa.

| | antes | ahora |
|---|---|---|
| Multiarticular primario | 180 s | **150 s** |
| Multiarticular secundario | 180 s | **120 s** |
| Aislamiento | 120 s | **90 s** |
| Montaje por aparición | 75 s | **60 s** |

Cambia el cronómetro de la app además del planificador, que es el objetivo: un solo modelo de tiempo. El atleta puede alargar cualquier descanso desde el temporizador; lo que importa es que la hipótesis de planificación coincida con lo que ocurre en el gimnasio.

**Capacidad resultante por sesión:** 45 min → 13 series · 60 min → 18 · 75 min → 23 · 90 min → 28.

#### Resultado sobre los casos del usuario

| caso | antes | ahora | límite |
|---|---|---|---|
| PPL+Upper 4×60, intermedio | 46 | **67** | tiempo |
| AUTO 4×60, intermedio | 48 | **69** | tiempo |
| AUTO 6×75, intermedio | 84 | **84** | recuperación |
| AUTO 6×75, **avanzado** | — | **109** | recuperación |

Series por sesión en PPL+Upper 4×60: **18/16/17/16**, con el tope de 18 alcanzado en la primera.

#### Dos discrepancias que quedan, declaradas

**PPL+Upper 4×60 da 67 y el techo teórico es 72** (4 sesiones × 18). El 7 % que falta no viene del modelo de tiempo sino de la estructura: la bisección busca el recorte mínimo con el que **todas** las sesiones caben, el volumen se recorta por regiones en series enteras, y los topes por músculo y sesión limitan dónde puede ir el trabajo. 93 % de aprovechamiento con esas restricciones simultáneas es razonable, y cerrarlo exigiría un reparto con reequilibrado posterior.

**6×75 no supera 110 para un intermedio: da 84, y el límite ya no es el tiempo sino la RECUPERACIÓN.** La capacidad temporal de 6×75 son unas 138 series, así que sobra tiempo. Los 84 salen del rango de volumen total del intermedio, que es 40-90 según la referencia que el usuario aportó. Un avanzado en la misma capacidad da **109**, coherente con su criterio anterior de que un avanzado está "más cerca de 100 que de 140".

Si un intermedio debe superar 110, lo que hay que cambiar es `TOTAL_SETS_RANGE` del intermedio, no el modelo de tiempo. Queda sin tocar porque contradiría el rango que el propio usuario fijó, y es una decisión suya.

#### Tests corregidos, no solo actualizados

Tres afirmaciones estaban sobreespecificadas y el cambio de tiempo las destapó:

- El test de separar sentadilla y prensa fijaba el **orden concreto** de las sesiones e incluso daba por buena una sesión vacía en medio. Ahora afirma la **separación**, que es lo que la regla promete.
- El test de equilibrio comparaba la dispersión con la media mediante un umbral ad hoc. Ahora afirma la propiedad real: a igual número de series, la sesión con más multiarticular tiene **menos series por minuto**. Medido: 9 series en 29 min con 6 de multiarticular, frente a 9 series en 26 min con 3.
- El test de "con el tiempo apretado no entra aislamiento" usaba 3×60, que con el modelo nuevo **ya no aprieta**. Movido a 3×45.

**Verificación:** `tsc --noEmit` limpio · **534 tests, 23 suites, 100 % de líneas, ramas, funciones y sentencias**.

### 2026-09-24 — Auditoría biomecánica del catálogo: de una nota a seis criterios

El usuario aportó la investigación delegada (113 ejercicios, 678 puntuaciones) junto con su metodología. Queda integrada, y **contradice tres de mis puntuaciones a mano**, que es exactamente para lo que se pidió.

#### El hallazgo principal no son las notas: es la confianza

| grado | puntuaciones | % |
|---|---|---|
| `programming-judgement` | 624 | **92,0 %** |
| `direct-evidence` | 44 | 6,5 % |
| `indirect-evidence` | 10 | 1,5 % |

**La base de evidencia a nivel de ejercicio concreto es fina**, y la investigación no inventó citas para rellenar el 92 %. Eso es el resultado honesto y ahora la app puede declararlo en lugar de disimularlo, que es la diferencia entre un criterio de programación y un hecho.

#### Una nota no podía expresar dos cosas

La puntuación única de efectividad se sustituye por **seis criterios de 1 a 5**: carga en posición alargada, recorrido útil, ajuste del perfil de resistencia, coste de estabilidad, progresabilidad de carga y coste de fatiga sistémica. En los dos últimos **5 es mejor**, así que todos se leen igual.

De ellos se derivan **dos magnitudes distintas**, que es el punto arquitectónico central de la auditoría:

- **`stimulusQuality`** — estímbulo por serie. Pondera el estiramiento por encima de todo (0,35), luego el perfil de resistencia (0,25), el recorrido (0,20), y progresión y estabilidad (0,10 cada uno). **La fatiga no entra: un coste no es un estímulo.** Es el peso de selección.
- **`fatigueCost`** — fatiga gastada por serie, de `systemicFatigueCost` (0,75) y `stabilityCost` (0,25) invertidos. Gobierna dónde se coloca el trabajo, no si se elige.

La sentadilla libre puntúa **5 en carga en estiramiento y 1 en fatiga sistémica**: es un estímulo excelente y carísimo a la vez, y una sola cifra no puede decir ambas cosas. Colapsarlas es lo que hace que un motor prescriba un mesociclo de trabajo axial con barra libre que degrada el rendimiento antes de terminar el bloque.

Ninguna de las dos se guarda en el JSON: se derivan al cargar, así que no pueden desincronizarse de los criterios.

#### Tres puntuaciones mías que estaban mal

| ejercicio | mi nota | la auditoría | por qué |
|---|---|---|---|
| **Elevación de gemelos sentado** | **e5**, la más alta | carga en estiramiento **1** | Insuficiencia activa del gastrocnemio con rodilla a 90°: **1,7 % de hipertrofia frente al 12,4 % de pie**. Lo tenía **invertido**. |
| **Aperturas con mancuernas** | e4 | perfil de resistencia **1** | El brazo de palanca pica en máxima abducción, donde el tejido es vulnerable, y la resistencia se anula al juntar arriba. |
| **Hip thrust** | **e5** | carga en estiramiento **2** | Herramienta de pico en acortamiento, no eje de un mesociclo. Mi nota venía de la amplitud EMG, que es justo de lo que la metodología manda desligarse. |

El caso de la elevación lateral con mancuernas ilustra lo que un número único no podía hacer. Dentro del mismo músculo y el mismo vector: máquina **4,4** ★, polea **4,2** ★, mancuerna inclinado **3,2**, mancuerna plano **1,7**. La variante plana no da tensión abajo, donde el deltoides está alargado, y pica arriba, donde está acortado. Yo la tenía en e5.

#### Un error de datos que la metodología destapó

`sentadilla-libre` acreditaba **ISQUIOS** como músculo secundario. La paradoja de Lombard lo desmiente: durante la sentadilla los isquios biarticulares se contraen casi isométricamente, transfiriendo momentos entre articulaciones sin variar su longitud sarcomérica, y la morfometría por resonancia no encuentra hipertrofia. Acreditarlos **inflaba el volumen atribuido de isquios** con series que no los hacen crecer. Corregido, con un test que lo fija.

#### La fatiga por perfil deja de ser un proxy

`sessionDistribution.ts` calculaba la fatiga de un ejercicio por su `profile`: 2 para primario, 1,5 para secundario, 0,5 para aislamiento. Era un proxy, y equivocado donde más importa: sentadilla libre y press de banca con mancuernas **comparten perfil** `COMPOUND_PRIMARY`, y la auditoría les da fatiga sistémica **1 y 4**. Ahora usa `fatigueCost` real por ejercicio, que es lo que hace que el motor aleje el trabajo axial pesado de una sesión adyacente.

#### Efecto medido en el plan

El top 10 por estímulo coincide con los ejemplos que la propia metodología nombra: curl femoral sentado (4,90), extensión de tríceps sobre la cabeza en polea (4,80), sentadilla hack (4,75), elevación de gemelos en prensa (4,75). **38 de 113** ejercicios cumplen la regla de primer nivel (estiramiento ≥4 **y** perfil de resistencia ≥4).

El reparto por material del plan de un intermedio a 4×60 queda equilibrado —barra 4, mancuerna 4, polea 5, máquina 2, peso corporal 1— así que no degenera en una rutina de máquinas. Por perfil se desplaza hacia multiarticulares guiados (8 secundarios frente a 2 primarios), que es literalmente lo que la metodología prescribe: derivar el volumen hacia variantes con soporte o cinemática guiada donde la estabilidad no limite el reclutamiento.

#### Dos ficheros, división deliberada

- `src/data/exercises.json` (v2) — el catálogo con los seis criterios. Lo consume el algoritmo, se edita a mano, sigue siendo tabular para pandas (`json_normalize` aplana `criteria`).
- `src/data/exercise-evidence.json` — confianza, citas y nota de cada criterio. **El algoritmo no lo lee.** Es el material para la explicabilidad del punto 5 del plan: poder decir "este ejercicio entra por X" y con cuánto respaldo.

Los ejercicios personalizados del usuario no llevan `criteria` y reciben un perfil neutro de 3 en todo: ni se asumen buenos ni malos.

**Verificación:** `tsc --noEmit` limpio · **561 tests, 23 suites, 100 % de líneas, ramas, funciones y sentencias**.

#### Pendiente

La investigación asignó ids derivados de los **nombres** en snake_case, no de los ids del catálogo, así que el emparejamiento se hizo por nombre normalizado: 113 de 113, pero es frágil. Si se amplía el catálogo, conviene que la siguiente tanda de investigación reciba los ids reales.

`src/data/README.md` queda en español por el mismo motivo que el PRD: es el documento con el que el usuario edita el catálogo. La convención fijada nombraba solo `PRD.md`, así que esto extiende su intención y queda señalado para poder corregirlo.

### 2026-09-24 — La fatiga es presupuesto, no criterio de selección

Corrección de criterio del usuario tras integrar la auditoría: **no se deja de hacer un patrón de sentadilla o de dominante de cadera porque sea fatigoso.** La fatiga acota cuánto trabajo cabe; no decide cuál se elige. Lo que hay que evitar es meter siempre extensiones de cuádriceps porque son "más baratas".

#### El problema era real y estaba medido

- **La extensión de cuádriceps (4,30) rankeaba por encima de la sentadilla libre (4,00)** y era tercera del grupo.
- **El patrón `KNEE_DOMINANT` faltaba por completo en 1 de cada 10 planes.**

#### Causa 1: el coste se contaba dos veces

`stabilityCost` pesaba 0,10 en `stimulusQuality` **y** 0,25 en `fatigueCost`. Además de duplicarse, dejaba que el coste decidiera la selección, y penalizaba sistemáticamente el peso libre: la sentadilla libre puntúa 2 en estabilidad y la hack 5, así que un motor que lo lee como "menos estímulo" deja de prescribir sentadillas sin que nadie lo decida.

Ahora **cada criterio pertenece a exactamente una magnitud**: cuatro al estímulo, dos a la fatiga, ninguno a las dos. Pesos del estímulo recalibrados a estiramiento 0,40, perfil de resistencia 0,28, recorrido 0,22 y progresión 0,10.

La sentadilla libre pasa de 4,00 a **4,22 y empata exactamente con la extensión**. El empate no se fuerza más allá: el perfil de resistencia 3 frente a 5 es una diferencia legítima de estímulo hipertrófico, y torcerla sería fingir. Un test fija el empate y añade el contrafactual: **con la estabilidad dentro, la sentadilla quedaría por debajo de la máquina en una puntuación de hipertrofia, que no es una afirmación de hipertrofia en absoluto.**

#### Causa 2: no había suelo de patrones

`FOUNDATIONAL_PATTERNS` obliga a incluir al menos un multiarticular de cada patrón fundamental cuando el plan entrena alguno de sus músculos: rodilla dominante, cadera dominante, empuje horizontal, tracción vertical y tracción horizontal.

El razonamiento es que **la auditoría mide estímulo hipertrófico por serie, y eso no es todo el valor de una sentadilla.** Coordinación intermuscular, carga axial, fuerza transferible y adaptación sistémica quedan fuera de esos seis criterios, así que un plan no debe dejarlos caer porque una máquina puntúe mejor en perfil de resistencia o cueste menos fatiga.

Se coloca en una **fase 0**, antes del reparto por volumen, por dos razones: el patrón no depende de ganar un sorteo ponderado, y el volumen que consume se descuenta del objetivo en lugar de sumarse encima.

Un patrón solo se exige si el plan entrena sus músculos, así que una rutina de brazos no se ve forzada a incluir una sentadilla. Cuando el material o los vetos no dejan ninguna opción, se declara en `missingFoundationalPatterns` en lugar de omitirse en silencio.

**Medido sobre 100 planes:** de 1 ausencia por cada 10 a **0 ausencias**, incluso con el plan recortado a 3×45.

#### Un presupuesto de fatiga NO hacía falta, y los números lo dicen

El usuario planteó el concepto. Antes de construirlo lo medí, y el motor no apila fatiga:

| | series | fatiga/serie | ejercicios de coste ≥4 |
|---|---|---|---|
| Intermedio 4×60 | 70 | 2,43 | 3 |
| Intermedio 6×75 | 84 | 2,28 | 4 |
| Avanzado 6×75 | 109 | 2,00 | 2 |
| Avanzado 6×90 | 109 | 2,00 | 2 |

La fatiga por serie se mueve entre 2,0 y 2,4 en todos los casos, con solo 2-4 ejercicios de coste alto por plan, y **baja** al subir de nivel porque el volumen extra entra como aislamiento. El escenario que un presupuesto evitaría —apilar sentadilla, frontal, búlgara, peso muerto y rumano todos pesados— no ocurre. Construirlo habría sido complejidad especulativa, así que no se construyó.

Lo que sí gobierna la fatiga, y sigue haciéndolo, es **dónde** se coloca el trabajo: `exerciseRisk` usa el `fatigueCost` auditado de cada ejercicio para alejar exposiciones solapadas en sesiones consecutivas.

#### Hueco de catálogo cerrado

Con solo mancuernas y peso corporal, `KNEE_DOMINANT` quedaba sin ninguna opción y el motor lo declaraba. La causa: la sentadilla goblet era el **único** ejercicio con kettlebell de los 113, y el goblet se hace con mancuerna en la inmensa mayoría de los casos. Reasignada a `DUMBBELL`, que cierra el hueco sin inventar un ejercicio sin auditar. La categoría `KETTLEBELL` queda a cero, y el informe del catálogo lo muestra.

**Verificación:** `tsc --noEmit` limpio · **571 tests, 23 suites, 100 % de líneas, ramas, funciones y sentencias**.

#### Decisión abierta: el patrón o el implemento

Sobre 30 planes de un intermedio a 4×60:

| | frecuencia |
|---|---|
| Patrón de rodilla con peso libre | **17/30** |
| Patrón de cadera con peso libre | 30/30 |
| Algún ejercicio con barra | 30/30 |

El suelo garantiza el **patrón**, no el implemento. La bisagra de cadera sale siempre con barra porque el catálogo apenas tiene alternativas guiadas, pero el patrón de rodilla se cubre con hack o prensa en 13 de 30 planes. Una sentadilla hack es un patrón de rodilla cargado y a recorrido completo, y la auditoría le da más estímulo que a la libre, así que el motor no está haciendo nada indebido.

Queda por decidir si "la sentadilla tiene otros muchos beneficios" se refiere al patrón, que ya está garantizado, o a la barra libre en concreto. Si es lo segundo, el suelo debe exigir además un multiarticular axial con peso libre. No se ha decidido por cuenta propia porque cambia lo que el motor prescribe a todos los usuarios.

### 2026-09-24 — `Routine` y persistencia: el motor deja de ser inalcanzable

Antes de esto había 17 módulos de lógica, 571 tests y **ninguna pantalla que usara nada**. La causa concreta no era falta de interfaz: era que `planMesocycle` devolvía un objeto en memoria sin ningún sitio donde guardarlo. Faltaba la distinción planificado/ejecutado.

#### La distinción que faltaba

`WorkoutSession` modela una sesión **ejecutada**: lleva `performedAt` y series con reps y peso reales. El generador produce algo distinto, una **prescripción**, y el modelo no tenía hueco para ella. `PlannedSession`, `PlannedExercise` y `PlannedSet` lo llenan, con reps y RIR como **objetivos** y no como hechos. Mantenerlos separados es lo que permite **medir** la adherencia en lugar de estimarla, y `WorkoutSession.plannedSessionIndex` es el enlace.

#### La prescripción vive en el MESOCICLO, no en cada microciclo

Se sigue de la decisión de volumen estático del §3: todos los microciclos de un mesociclo ejecutan los mismos ejercicios y las mismas series, y solo varía la intensidad, que `deriveSetRIRs` calcula. Guardarla por microciclo duplicaría datos idénticos e invitaría a que las copias divergieran.

La única excepción es la descarga, que se **deriva** con `deloadVolumePlan` en lugar de almacenarse dos veces.

Y va **embebida** en el documento del mesociclo, no en una colección aparte: está acotada por `sessionsPerMicrocycle`, mide unos pocos kilobytes, y cargar un mesociclo no debería necesitar una segunda ida y vuelta estando sin red. Medido: **5,5 KB** para un plan de 4 sesiones, frente al límite de 1 MB de Firestore.

#### `Routine` es plantilla, no etiqueta

El §3 fijó que para el atleta una rutina **es** el mesociclo. Pero un mesociclo termina, y el siguiente arranca normalmente con la misma intención: mismo split, mismas sesiones, mismas prioridades, mismos vetos. `Routine` guarda esa intención en `RoutineGenerationInput` más la identidad reconocible (nombre, icono, acento), y un `Mesocycle` es **una ejecución** de ella. Empezar un bloque nuevo no obliga a volver a responder la configuración.

**Se guarda la semilla, y es lo que convierte la plantilla en plantilla.** Sin ella, reabrir una rutina no podría mostrar el plan que de verdad produjo, y el botón de refrescar no tendría nada que recordar. Un test fija el invariante: los mismos inputs almacenados, reproducidos, devuelven la misma prescripción.

#### La línea entre lo que se persiste y lo que no

`routineMapper.ts` la traza explícitamente, en lugar de dejar que cada llamante decida y acaben persistiendo subconjuntos distintos.

**Se persiste:** las sesiones planificadas (ejercicios, series, reps y RIR objetivo) y el input de generación con su semilla.

**No se persiste:** referencias de volumen, volumen atribuido, el recorte, los avisos de secuenciación y estructura, los minutos disponibles. Todo recalculable, y todo **incorrecto** de congelar: una tabla de referencias que mejore debe mejorar también el diagnóstico de las rutinas viejas.

La excepción aparente es `estimatedWorkMinutes`, que **sí** se guarda. Depende del modelo de descansos y queda obsoleto cuando ese modelo cambia, como cambió hoy. Se guarda para que una tarjeta de sesión pueda mostrar una duración sin cargar el catálogo entero, y se etiqueta como estimación en todas partes. Recalcularlo al cargar queda como opción deliberadamente abierta.

Otro detalle heredado del mapeador de sesiones: un opcional ausente se **omite** en lugar de escribirse `undefined`, porque Firestore lo rechaza.

#### Capa corregida

`RoutineIconKey` vivía en `src/components/icons/RoutineIcons.tsx`, y su propio comentario decía que la clave es lo que se persiste. Un modelo que la importara invertiría las capas, igual que pasó con `SessionLengthBand`. Movida a `src/models/routine.ts`, y el componente ahora la reexporta y solo dibuja.

#### `isEdited`, para que regenerar no revierta una decisión

Cada `PlannedExercise` lleva la marca. Un atleta que sustituyó un ejercicio porque su máquina está siempre ocupada no debe encontrárselo de vuelta en el bloque siguiente. `editedExerciseIds` es lo que permitirá al generador respetarlo cuando exista el editor.

#### Persistencia

`routineRepository` sobre la colección `routines`, con `listByUser` para el acordeón de inicio, y `mesocycleRepository.listByRoutine` para comparar bloques entre sí. Regla de seguridad añadida siguiendo el patrón existente: propiedad por el **campo** `userId` y no solo por la ruta, así que un documento no puede escribirse a nombre de otro.

#### Cadena completa verificada

Generar → mapear → serializar: **63 series ejecutadas y 63 prescritas** (conservadas), documento de rutina de 468 bytes, de mesociclo 5,5 KB, y serialización sin pérdida.

**Verificación:** `tsc --noEmit` limpio · **601 tests, 24 suites, 100 % de líneas, ramas, funciones y sentencias** en el ámbito medido.

#### Dos cosas señaladas

**El 100 % tiene un hueco declarado.** `collectCoverageFrom` incluye `BaseRepository.ts` pero **no** `src/services/repositories/index.ts`, así que los repositorios concretos no se miden. La mayoría son delegaciones de una línea, pero `MesocycleRepository.getActive` decide cuál es el mesociclo activo y eso es lógica de negocio sin test. Es una decisión previa al cambio de hoy y no se ha tocado el ámbito por cuenta propia, porque ampliarlo destapa varios métodos a la vez.

**El derrame de enfoque se ve raro en un caso concreto.** En un plan PPL+Upper de 4 sesiones apareció un peso muerto a piernas rígidas en la sesión de **empuje**. Es el comportamiento aprobado —meter parte del volumen de pierna en push y pull antes que saturar el día de pierna— pero una bisagra con barra en día de empuje resulta chocante a la vista. Merece revisarse cuando exista la pantalla, donde se juzga mejor que en una tabla.

### 2026-09-24 — §8.8 Pantalla de generación: el motor deja de estar sin llamar

Primera pantalla que alcanza el motor. Hasta ahora `planMesocycle` no tenía ningún llamante fuera de los tests.

#### Un solo scroll, no un asistente

Siete grupos de entradas darían un asistente de siete pasos, que cuesta una máquina de estados, navegación hacia atrás y cromo de progreso para mostrar un control a la vez. Un scroll único muestra todo lo que se está decidiendo **y cómo interactúa**, que aquí importa: el número de sesiones y los minutos mueven juntos el presupuesto de series, y repartirlos entre pasos esconde justo eso.

#### Dos fases, y nada se escribe antes de ver el plan

Configurar y después previsualizar. Lo que el atleta acepta de verdad es la **selección generada**, no los ajustes, así que guardar antes de mostrarla sería pedir un consentimiento sobre algo invisible. El botón de otra combinación cambia la semilla y regenera sin tocar el resto del formulario.

#### La línea del factor limitante es lo que la pantalla destaca

`limitedBy` tiene la posición más prominente de la vista previa, por encima de la lista de ejercicios. *"Lo limita el tiempo"* y *"lo limita la recuperación"* tienen **remedios distintos**, y un generador que da un número sin decir cuál de los dos manda deja al atleta ajustando la palanca equivocada. `insufficient-time` va en rojo porque es lo único de los tres que es un error y no información.

#### La lectura de capacidad muestra DOS cifras, y por eso

Primero puse una sola y la etiqueta mentía: `approximateSetCapacity` devuelve el total del microciclo, no el de una sesión, así que "unas N series por sesión" daba 72 donde caben 18.

Ahora muestra ambas, y no por exhaustividad: **cada control mueve una cifra distinta**. Los minutos cambian lo que cabe en una sesión, el número de sesiones cambia el total. Con solo el total, el control de minutos parecería no hacer nada al subir sesiones a la vez.

Medido: 3×45 → 39 totales · 4×60 → 72 · 5×75 → 115 · 6×90 → 168, coherente con la calibración de 13/18/23/28 por sesión.

#### El presupuesto de plazas se impide, no se captura

`assertEmphasisLimits` **lanza**, y eso es correcto: llegar ahí con una combinación ilegal es un error de programa. Pero una pantalla no puede impedir un toque del que solo se entera capturando una excepción.

`emphasisSelection.ts` responde la pregunta que la interfaz hace de verdad: qué se puede seguir eligiendo y cuánto presupuesto queda. Nunca lanza. La regla sigue viviendo en un solo sitio y hay un test que fija que **ningún estado que este módulo permita es uno que el servicio rechace**, porque una pantalla que autorizara lo que el servicio veta reventaría al generar.

Tres estados por región en un solo control, y un detalle deliberado: cuando la prioridad no cabe, el ciclo **se la salta** en lugar de bloquearse, para que tocar una región cara todavía permita ponerla en mantenimiento.

#### Énfasis por REGIÓN, y un fallo que esto destapó

`VolumePlanInput` solo aceptaba `priorityMuscles`, y convertía a región dentro. La pantalla elige regiones, que es donde viven tanto el presupuesto de plazas como el de volumen, así que pasar por un músculo intermedio era un viaje de ida y vuelta.

Añadidos `priorityRegions` y `deprioritizedRegions`, que se unen con los derivados de músculos.

Al hacerlo salió un fallo de la tanda anterior: `RoutineGenerationInput` guardaba **músculos**, y la pantalla le pasaba listas vacías. La rutina almacenada **no habría reproducido su propio plan**, que es justo el invariante que se documentó ayer como la razón de guardar la semilla. Corregido a regiones, con el test actualizado.

Efecto medido de priorizar espalda y cuádriceps, a 4×60: espalda 13→18, cuádriceps 11→15, y pecho 11→10 y bíceps 9→7 bajan **solos**, que es el trade automático del §3.3 funcionando.

#### Detalles de implementación que responden a invariantes ya fijados

- Alturas de control **fijas y reservadas**, no derivadas del texto, para que una etiqueta larga en francés o un glifo ancho en japonés no reflujan la rejilla.
- `Chip` memoizado con callbacks estables: la rejilla de énfasis dibuja dieciséis y un toque cambia el objeto de estado que todos leen.
- Barra de acción fija: el formulario es largo y la acción principal no puede exigir llegar al final para encontrarla.
- Un fallo al guardar **conserva el plan en pantalla**. El atleta acaba de dedicar un minuto al formulario; perderlo por un error de escritura transitorio sería el peor momento posible para vaciarlo.

#### Entrada

Botón *Nueva rutina* en E1, junto al de entrenamiento vacío y con su mismo patrón. La ruta va dentro del stack anidado de la pestaña, así que la barra sigue visible (§8.6). Los tipos de ruta de expo-router se regeneran al arrancar Metro; se han añadido a mano para dejar `tsc` limpio ya y Metro produce lo mismo.

**Verificación:** `tsc --noEmit` limpio · **622 tests, 25 suites, 100 %** en el ámbito medido · **84 claves nuevas × 4 idiomas, paridad comprobada**.

#### Dos cosas señaladas

**Cerrado un descuadre de i18n preexistente y ajeno a esta tanda:** cinco claves de `train.` (los tramos extra) existían solo en español, incumpliendo la paridad de los cuatro idiomas. Traducidas. La comprobación de paridad ahora cubre las 190 claves y pasa entera; merece ser un test en lugar de una comprobación manual.

**La pantalla no se ha ejecutado.** El agente no puede compilar iOS, así que lo verificado es tipos, lógica y la cadena de datos, no el resultado en pantalla. Nada del aspecto, el espaciado ni el comportamiento táctil está comprobado. Los vetos de ejercicio tampoco tienen control todavía: el modelo los guarda y el generador los acepta, pero la pantalla envía la lista vacía.

### 2026-09-27 — Personal-first scope and short-term direction

#### Product intent

Vigor is being built first as a personal training app for its creator. Commercial launch, market validation, user interviews, and a public beta are not current project goals. The quality bar is whether the app fits the creator's real training, is understandable, and is useful enough to replace the current mix of tools and manual decisions. Sharing or commercializing it may be reconsidered later, but does not drive near-term architecture or scope.

The central training problem is generating an editable mesocycle from athlete inputs, then evaluating completed training and progress to inform future volume and intensity decisions. The intended distinction from basic workout logging is the complete loop: individual inputs → proposed block → editable sessions → recorded execution → progress/stall review → explained next-step adjustments.

#### Evidence boundary for volume landmarks

MEV/MAV/MRV remain programming landmarks used by the generator, not directly measured biological thresholds for an individual. Population research supports dose-response relationships, while evidence for classifying individual response and identifying precise personal thresholds remains heterogeneous and developing ([Cheng et al., 2024 systematic review](https://pubmed.ncbi.nlm.nih.gov/38708326/); [autoregulated versus standardized prescription meta-analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC8762534/)). The app must distinguish population-derived starting estimates, user-declared training history, observed performance/recovery data, and programming judgment. Any claim that the system has identified an athlete's personal MEV or MRV requires an explicit method and validation; until then the UI and documentation should call these estimates or working ranges.

#### Injury and rehabilitation scope

The intended secondary feature is personal tracking and scheduling: record an injury and its self-reported evolution, attach a rehabilitation routine that the athlete already has, set its requested weekly frequency, log completion, and make the routine available in the pre-workout flow. Vigor does not diagnose an injury, select treatment, prescribe rehabilitation exercises, or claim to determine recovery. Any future change that adds clinical recommendations requires a separate product and evidence decision.

#### Near-term implementation sequence

1. Run the existing generation screen in the iOS simulator/device and fix visible interaction/layout defects. Verify generate → preview → save and retain a failed-save plan for retry. Do not infer visual correctness from TypeScript or unit tests.
2. Make the saved routine reachable from E1 and the mesocycle view, then start a planned session from persisted data. Replace mocks only along this core path first; preserve unrelated mock screens until their replacement is in scope.
3. Add the user's essential editing controls, including exercise replacement, set changes, ordering, and exercise vetoes, then verify the edited routine survives reload and regeneration respects locked choices.
4. Connect planned and performed sessions. First report adherence, progress signals, and possible stalls with the source data visible; next-step changes to volume/intensity should be proposals the athlete can inspect and edit before automatic application is considered.
5. Add the rehabilitation tracker and recurring pre-workout routine flow described above, keeping its exercise prescription under the athlete's control.

Firestore rule deployment is infrastructure work and remains subject to the project's explicit-approval rule. Before any deployment, inspect the exact rules diff, test ownership and denial cases locally where possible, and present the proposed deployment for approval.

This entry records product intent and sequencing, not a claim that the current generator has scientifically identified individual volume landmarks. Every implementation step remains subject to the project's testing and changelog requirements.

### 2026-09-28 — Persisted execution, real mesocycle view, and history-derived loads

#### A workout execution is now anchored to its prescription

`/session` no longer opens the development mock when reached from the active routine. The home route carries three explicit coordinates: `mesocycleId`, `microcycleIndex`, and `plannedSessionIndex`, plus the routine goal needed to resolve the strength ramp. The runtime derives the exact microcycle prescription through `prescriptionForMicrocycle`, then resolves its catalogue exercises and editable set rows.

The workout document id is deterministic: `{mesocycleId}:m{microcycleIndex}:s{plannedSessionIndex}`. This makes reopening an unfinished workout restore the same document rather than create a duplicate. `WorkoutSession.plannedSessionIndex` is persisted in the mapper, so planned-versus-executed adherence is an explicit relation rather than a date/order guess. The virtual microcycle identity follows the same convention (`{mesocycleId}:m{microcycleIndex}`); it is an execution key, not a claim that a separate Firestore `Microcycle` document must exist.

Ending a workout persists `completedAt`. The persistence hook retains that timestamp through later debounced or unmount writes, preventing the old in-progress write from accidentally erasing completion. The home view joins completed workout sessions by the three coordinates and displays their real completion dates. It derives the first incomplete microcycle from that history, so it advances only after every planned session in the current microcycle is finished; finishing one session cannot skip its remaining sessions.

Opening a prescribed session alone does not create a history document: planned rows are not actual work. Persistence begins only after the athlete enters an actual set value (weight, reps, RIR, or a filled advanced-set segment), preserving the existing no-empty-workout invariant.

#### The mesocycle screen consumes the same real prescription

The mesocycle route now receives `mesocycleId` and reads the saved routine view rather than `mockActiveRoutine`. Its chart, projected microcycles, deload volume, strength RIR ramp, completed-session count, and exercise detail all come from the same persisted plan and completed session history used by Home and execution. The detail view does not apply `intensityAdjustmentRIR` a second time: its exercises are already the resolved microcycle prescription. Applying it twice would incorrectly steepen the strength RIR ramp.

#### e1RM is evidence from completed work, not from a target

Generation loads the athlete's completed `WorkoutSession` history and builds an exercise-specific map from actual weight and repetitions only. The map uses the best Epley estimate per exercise and accepts attempts from 1 to 12 repetitions; incomplete work, zero/invalid values, and higher-repetition extrapolations do not become kg prescriptions. This is a conservative guard against treating a planned value or a very high-rep extrapolation as a reliable max estimate. When no qualifying history exists, the plan remains RIR-led, as before. When it does exist, the existing strength mapper uses it to populate `targetWeightKg` and the microcycle resolver recalculates load as RIR changes or deloads.

This is an estimate for load selection, not a claim to have measured a true 1RM. The user may always edit the live set weight; completed actual work remains the only data eligible for the next estimate.

#### Icon asset

`assets/icon.png` is now an opaque, edge-to-edge 1024×1024 raster asset. It retains the lime V/lightning monogram on a dark textured background but deliberately contains no rounded tile, outer black canvas, or external glow. iOS supplies the app-icon mask itself, eliminating the previous nested-icon appearance. The asset was created with the built-in image-generation workflow using the supplied reference image as a visual reference.

**Verification:** `npx tsc --noEmit` clean · `npm test -- --runInBand`: **812 tests, 36 suites** passing at this point. Added pure-logic coverage for planned-session runtime identities/rows and the e1RM history eligibility rule, and extended session mapping coverage for the prescription link and no-empty planned sessions.

### 2026-09-27 — Generator parity, exercise-family diversity, session balance, and bottom actions

#### Capacity is permission, not an instruction to add junk volume

The 40–90 total-set reference for an intermediate remains a recovery sanity range, not a claim that every intermediate needs at least 80 sets. The product calibration is narrower: when an intermediate hypertrophy plan uses the default commercial-gym equipment and has five 65-minute sessions available, the unsqueezed proposal should use the upper part of that range. The regression contract is **80–90 performed sets across twenty deterministic seeds**, with at least ten sets in every session and no more than 25 minutes between the longest and shortest session. Measured after this change: **84–89 sets across the first twenty seeds**; a wider 100-seed audit produced **82–89**, at least 12 sets per session, and at most 22 minutes of session-load spread.

This is explicitly a scenario calibration, not a universal scientific minimum and not a rule to fill every available minute. When the recovery-derived plan is already complete, unused time remains unused rather than being padded with low-value work.

#### Near-duplicate compound variants are one programming family

Exercise identity is no longer enough to claim variety. Compound exercises with the same primary muscle and movement vector are treated as one biomechanical programming family, independent of equipment. Only one member of that family can be selected in a proposal. This prevents pairs such as barbell RDL plus dumbbell RDL, and back squat plus hack squat, while still allowing a distinct pattern such as a knee-flexion exercise to complement a hip hinge. Isolation variants have a cap of two per family because some high-volume regions need more than six direct sets; the distributor keeps equivalent variants in different sessions whenever the split provides another valid slot.

The rule is a programming constraint, not an efficacy ranking. It prevents redundant exposure and avoidable fatigue; it does not claim that one implement is biologically superior. Under time pressure, an isolation exercise may complement a non-redundant compound already selected for the muscle, but it cannot replace the foundational compound pattern.

#### Session assignment hierarchy

Distribution now follows this order:

1. Preserve every prescribed set and the current 3–4 set appearance cap.
2. Keep an exercise in a matching session focus while a matching session has time and productive per-muscle capacity.
3. Among valid matching sessions, use the least-loaded session; sequencing risk decides ties.
4. Keep equivalent exercise variants in different sessions when possible.
5. Use a mismatched focus only as an overflow valve when no matching session can accept the work.

This closes the observed failure in which one leg session held four hard variants while the other contained almost no leg work. It also prevents two appearances of the same exercise from being recombined in one session.

#### Harness parity with the generation screen

`scripts/volume-harness.ts` now accepts and prints the screen inputs that affect or identify a proposal: name, goal, level, sessions, minutes, split, equipment, priority regions, deprioritized regions, vetoes, and seed. The default equipment preset is shared with the screen rather than duplicated. A capacity run prints the resolved split and every session with its exercises, performed sets, estimated minutes, structural warnings, and sequencing warnings. This makes a screenshot reproducible and exposes distribution defects that a whole-plan total cannot show.

#### Floating navigation and fixed actions

Expo Router's JavaScript-tab guidance states that an absolutely positioned tab bar does not reserve content space automatically. Floating-tab geometry is now shared by the tab layout and the generation screen. The fixed Generate/Save action bar reserves the tab height, safe-area-aware bottom offset, and an additional visual gap, so the primary action sits above the capsule rather than underneath it. The bar now overrides React Navigation's logical `start`/`end` defaults rather than trying to center with physical `left`/`right`; the previous combination sized the capsule correctly but left it pinned to the leading edge.

**Visual verification:** iPhone 18 Pro simulator, iOS 27.0. The 5×65 AUTO case generated **88 sets**, the fixed Generate/Save action rendered fully above the floating tab capsule, and the capsule was centred horizontally.

**Verification:** `tsc --noEmit` clean · **629 tests, 26 suites passing** · **100% statements, branches, functions, and lines** in the measured scope.

### 2026-09-28 — Canonical PPL sequencing, productive set caps, and editable preview

#### Canonical PPL sequence

Manually selected PPL is a deterministic movement-family sequence. The requested
session count maps to `PPL` (3), `PPLU` (4), `PPLUL` (5), and `PPLPPL` (6). This
removes the accidental `PPLP` result that placed all direct biceps work in one pull
session. The labels are a sequencing contract, not a claim that a split is
physiologically superior.

`AUTO` deliberately does **not** inherit that fixed sequence. It selects a broad
base by session count (full body up to 3, upper/lower at 4, PPL+upper at 5, PPL at
6+) and assigns additional focuses according to the minutes of muscle volume that
still need a home. Session placement then applies time, productive per-muscle
capacity, and adjacent-session biomechanical-overlap costs. AUTO is therefore free
to produce structures such as PPLUP or PPLUL when the actual volume requires them.

Push and pull are movement families rather than torso-only buckets: quadriceps work
is eligible for a push session and hamstring/glute hip-extension work is eligible
for a pull session. The distributor still prefers a natural movement match, uses
time and productive per-muscle capacity, and reports unavoidable structural
warnings instead of deleting work.

#### Exercise-level volume and stimulus variety

Automatic selection now keeps each exercise appearance between **3 and 4 working
sets** (`maxSetsPerExercise = 4`, `MAX_SETS_PER_EXERCISE_APPEARANCE = 4`). When a
muscle needs more work, the selector adds a distinct audited variant rather than
prescribing six hard sets on one exercise. Up to four variants can represent a
muscle's weekly work when time allows, while the existing movement-family and
no-repeat rules prevent redundant variants. The total executed-set ceiling is still
enforced against the level/goal range, so variety cannot silently create excess
volume.

#### Preview editing before persistence

The generated preview is now a freely editable proposal. Sets and the lower and
upper repetition bounds use the same numeric input component as the live workout
screen; values are not restricted to the automatic 3–4 set prescription. Exercise
replacement opens a searchable modal with every equipment-compatible, unused
catalogue exercise ranked by the existing swap engine. This modal is the interaction
pattern intended for the in-session swap flow as well.

Edits are kept in a pure preview layer, marked `isEdited`, and passed to the saved
mesocycle; a failed save therefore retains exactly what the athlete reviewed. The
preview recalculates set totals, estimated session minutes, and attributed volume
per muscle (direct sets = 1, audited secondary exposure = 0.5). Free editing is not
silently vetoed: it remains saveable, but the screen warns when an edited session
exceeds the available time or when an uncapped plan moves outside the level/goal
total-volume reference range.

#### Emphasis and equipment controls

Emphasis controls use a fixed two-column grid. The section header shows the numeric
priority budget (`used/total`), while every muscle shows only its cost (`1` or `½`).
Priority and maintenance remain visible through control state and colour, with the
full state and cost exposed to accessibility labels. Any number of regions can be
deprioritised; tibialis remains available in the domain model but is not exposed in
the primary mesocycle emphasis grid.

Every supported equipment type is selected by default, including Smith machine,
kettlebell, and bands. The athlete can remove unavailable equipment before
generation, and swaps only show alternatives compatible with the resulting set.
The generator still refuses to run with an empty equipment selection.

**Verification:** `npx tsc --noEmit` clean · **668 tests, 28 suites passing** ·
**100% statements, branches, functions, and lines** in the measured business-logic
scope.

### 2026-09-28 — Functional muscle taxonomy and structured exercise discovery

#### Muscle taxonomy

Chest is one programming group (`CHEST`). Incline, flat and decline work remain
distinct exercise and stimulus variants, but they no longer receive independent
volume landmarks or appear as separate emphasis targets. This prevents angle
variety from being misrepresented as two independently recoverable muscles.

The legacy rhomboid and middle/lower-trapezius buckets are merged into
`MID_BACK`, the functional group used for horizontal-row and scapular-retraction
work. Upper-trapezius work and direct cervical work belong to the optional `NECK`
group. Accordingly, the back-region budget is distributed 55 % to lats and 45 %
to mid back; neck has its own low-recovery-cost region and remains disabled by
default.

Three explicit cervical movement vectors and three band exercises were added:
cervical flexion, extension and lateral flexion. They are `FALLBACK` automatic
choices because the evidence is not equally strong for every direction or loading
method. Resisted head extension has direct MRI evidence of cervical hypertrophy
after specific training (Conley et al., 1997, PMID 9189733), while broader reviews
find heterogeneous protocols and low-certainty evidence for performance or injury
outcomes (Elliott et al., 2021, PMID 34143411). Vigor therefore records them as
optional strength exercises, not treatment or injury-prevention advice.

#### Swap search and result hierarchy

Exercise search normalises case and diacritics and expands domain synonyms across
Spanish and English. Queries such as `delt`, `hombro`, `espalda`, `romboide`,
`trapecio`, `cuello`, `chest` and `lat` resolve through the primary and secondary
muscle mappings rather than requiring those words to appear in the exercise name.

Filtered candidates preserve the biomechanical ranking but render in two explicit
sections: same primary muscle first, followed by `Other exercises`. This makes the
recommended substitutions legible without hiding the complete manually available
catalogue.

#### Generator presentation

Emphasis pills keep their label geometrically centred and place the priority cost
in a bordered circular badge at the lower-right corner. A subtle elevation and
state tint adds hierarchy without changing the three-state interaction or its
accessibility label. The `Another combination` action now has a full section gap
above it, separating it from the attributed-volume card.

The app follows the system appearance because `userInterfaceStyle` is `automatic`
and `useTheme` subscribes to React Native's colour scheme. On the iOS Simulator,
`Command + Shift + A` toggles light/dark appearance while the app is open.

**Verification:** `npx tsc --noEmit` clean · **673 tests, 29 suites passing**.

### 2026-09-28 — Generation flow: two pages instead of one appended scroll

#### The problem the single scroll had

The generated plan was appended to the bottom of the configuration scroll, so the
primary action produced no visible movement on the one tap that matters most. The
athlete pressed *Generate plan* and the screen appeared inert.

The original single-scroll argument still holds for the seven **input** groups and
they still share one page: session count and minutes move the set budget together,
and splitting them across steps would hide that interaction. The plan is not an
eighth input group. It is the result of the other seven, so it becomes a page of its
own.

#### The flow

Two horizontally-paged views inside one route, sliding 260 ms in the direction of
travel so generating reads as a step forward and returning reads as a step back.

- **Configure → preview:** the primary action generates and advances.
- **Preview → configure:** the left action of the fixed bar becomes *Back*.
- **Regeneration is reachable from both pages.** *Another combination* sits directly
  under each page title, so it needs no scrolling on either side.

Both pages stay mounted. Going back to change a setting therefore keeps the
athlete's scroll position in the long form and keeps their preview edits.

#### Forward navigation distinguishes looking from changing

`generationPhase.ts` records the settings a plan was generated from and compares
them with the current ones, which decides what the forward action is:

| State | Primary action |
|---|---|
| No plan yet | *Generate plan* |
| Plan, settings untouched | *View plan* — returns forward, generates nothing |
| Plan, a setting moved | *Generate again* |
| On the preview page | *Save routine* |

*View plan* must not regenerate: regeneration resets the preview edit layer, so a
trip back to re-read a setting would silently discard the athlete's manual changes.
The configuration page states which case it is in, either the set count waiting on
the other page or a warning that the settings no longer describe it.

The signature sorts equipment and the two emphasis lists. That is not cosmetic: the
generator reads all three as membership tests, so two orderings of the same members
produce the same plan and toggling a chip off and on again must not read as a change.

#### Two smaller consequences

The swipe-back gesture is disabled while the preview is up. It would pop the whole
route and discard an unsaved plan together with its edits, and the explicit *Back*
action is in the fixed bar. This is a judgement call to confirm on device.

*Another combination* is a second entry point into the generator, so it is disabled
when the equipment selection is empty. Previously the disabled primary button was the
only way in, and an empty catalogue could not be reached.

Also fixed: `muscle.ADDUCTORS` existed in three locales and not in Japanese. Key
parity is back to 206 keys across `es`, `en`, `fr` and `ja`.

**Verification:** `npx tsc --noEmit` clean · **693 tests, 30 suites passing** ·
**100 % statements, branches, functions and lines** in the measured business-logic
scope. The flow itself has not been run on a device.

#### Save failures now name their cause

The save handler swallowed every error behind *could not save, try again*, which hides
the only distinction that matters: a rejected write needs a rules deployment and a
lost connection needs a retry. The handler now logs the error and shows its code,
e.g. `firestore/permission-denied`, under the generic line.

A regression test asserts that neither draft contains `undefined` anywhere in its
tree. Firestore rejects such a document outright, and the failure surfaces as an
opaque write error at the exact moment the athlete is saving work.

`firebase.json` was missing, so deploying rules required passing the configuration on
stdin. Deploying is now `firebase deploy --only firestore:rules --project vigor-5ddda`.
The `routines` collection has existed in `firestore.rules` since 24 September; under
the deny-by-default catch-all, every write to it is rejected until that deployment
happens.

### 2026-09-28 — Recommended capacity, and a crash in the distributor

#### The app decides how much and how often

A beginner who believes more is better sets five or six sessions, and the generator
obediently spreads a beginner's recoverable volume across six thin days. The volume
ceiling is set by what the athlete RECOVERS from, not by the time they are willing to
spend, so past that ceiling extra sessions add commitment and no adaptation. The
capacity section now has a control that decides both numbers.

`capacityRecommendation.ts` runs the real generator across a grid of capacities
(2 to 6 sessions × 45, 60 and 75 minutes) and reads its verdicts, instead of modelling
the engine a second time in a way that could disagree with it.

Three measurements shaped the criterion, and each of them rejected a simpler version:

- **Minimising total weekly minutes alone recommends two 90-minute days,** because the
  warm-up overhead is paid once per session. Session length is therefore capped at 75
  minutes for a recommendation; the athlete can still set 90 or 120 by hand.
- **Minimising structural warnings recommends six sessions,** because spreading volume
  almost always shaves one off. Warnings are a floor, not a maximum: a structure within
  one warning of the best available counts as equally sound, and among those the
  smallest commitment wins. `single-frequency` warnings never reach zero and should
  not, since a muscle whose weekly volume is three sets belongs in one session.
- **With a single seed the recommendation was not stable:** the same intermediate got
  6×60, 5×60 or 4×75 depending on the draw. Each capacity is now scored across a fixed
  sample of three seeds and ranked on the mean, which also matches what the answer is
  about: the capacity, not one selection.

A candidate must also deliver the level and goal's minimum recoverable volume.
`limitedBy === 'recovery'` alone was not enough: a bodyweight-only advanced plan of 37
sets reports `recovery` too, because the label says which ceiling bound the plan, not
that it reached the athlete's volume. When nothing qualifies, the equipment is the
binding constraint and the screen says so rather than presenting a thin plan as the
right answer.

What it recommends with a full gym:

| | hypertrophy | strength |
|---|---|---|
| Beginner | 3×60, 42 sets | 2×60, 26 sets |
| Intermediate | 4×75, 87 sets | 3×75, 56 sets |
| Advanced | 6×60, 115 sets | 6×45, 76 sets |

The search takes about 140 ms for 45 plans, so the control shows a busy state and
defers the work by a frame; otherwise the thread blocks before the spinner paints.

#### A crash in the distributor, found by the search

Scanning 684 level/goal/capacity combinations crashed **15** of them, `6×45` for an
intermediate among them, which is an ordinary thing for someone to pick.

The anchor-repair pass ran on every session with no anchor, and an EMPTY session has no
anchor, so it reached a pass whose comment says "a populated session". It then asserted
with `[0]!` that such a session had an isolation exercise to trade back. An empty one
does not, so `undefined` was spliced into the donor's exercise list and the next minute
count threw. `indexOf(undefined)` returning -1 corrupted a second session on the way.

The pass now runs on populated sessions only, and when a session has nothing comparable
to hand back — every entry a compound too short or too peripheral to anchor it — the
anchor moves one way instead of trading an entry that does not exist. All 684
combinations now plan.

#### Saving a routine: the rules, confirmed

The deployed ruleset is from **23 September at 16:53** and the `routines` block entered
`firestore.rules` on **24 September at 21:03**. Under the deny-by-default catch-all,
every write to `routines` is rejected until the file is deployed. Anonymous sign-in is
not the cause: the rules require `request.auth != null` and a matching `userId`, and an
anonymous user satisfies both.

**Verification:** `npx tsc --noEmit` clean · **710 tests, 31 suites passing** ·
**100 % statements, branches, functions and lines** in the measured business-logic
scope. Neither the control nor the two-page flow has been run on a device.

### 2026-09-28 — E1 reads saved routines; strength goal audited against the intermediate guidelines

#### Saved routines were invisible

Saving worked: `generate.tsx` writes the routine and its mesocycle, then pops back. The
home it pops back to rendered `mockRoutines` and never queried Firestore, so nothing
the athlete saved could appear. `routineView.ts` now joins each routine with its active
mesocycle and the catalogue, `useRoutines` reloads on every focus, and E1 renders the
result (§8.5). The mock types became aliases of the view types, so the cards did not
change.

#### Strength goal: measured gap (proposal, not implemented)

An intermediate on `STRENGTH` at 3×75 (seed 1) currently receives: front squat 3×3-5
once, RDL as the only hip hinge, close-grip and incline bench instead of the flat bench,
no overhead press, and an upright row counted as the vertical pull. Barbell primary
compounds are **24 %** of the sets. Every main pattern is trained **once** per
microcycle with 3-4 compound sets; primaries rest 150 s. Isolation work (pec deck,
lateral raises, cable crunch) follows hypertrophy selection. In short, strength today is
hypertrophy with lower rep ranges.

Root cause: selection weighs `stimulusQuality`, a hypertrophy criterion, for both goals.
Strength needs selection by specificity (the main lifts are fixed, not chosen), volume
counted per movement pattern rather than per muscle, 2-3 exposures per main lift,
3-5 min rests on main lifts, and a microcycle-by-microcycle RIR ramp.

Data defect found on the way: `remo-al-menton` is classified `PULL_VERTICAL`. An upright
row does not train the vertical pull, and it currently satisfies the foundational-pattern
floor for both goals.

The catalogue already holds the six main lifts; it has no specific variants (paused
squat, paused bench, deficit or block pull).

### 2026-09-28 — IMPLEMENTATION: strength program, one active routine, integer RIR

Approved by Fran with four decisions: main lifts plus variants at 60 % or more of the
sets, frequency 2-3 for the three main lifts and 1-2 for the complementary ones,
conventional deadlift by default, and a warning (not a block) without a barbell.

**Strength program (§3.7).** `strengthProgram.ts` replaces hypertrophy selection for the
strength goal. Measured on an intermediate at 4×75, seed 1: 46 sets, 61 % on main lifts
and variants, squat 2 / bench 3 / deadlift 2 exposures, knee 8, horizontal push 12 and
hinge 8 sets per microcycle. Across levels × 1-7 sessions × 45-120 min, every plan that
fits keeps the 60 % share, and no session repeats a main pattern. *Decide for me* now
recommends 3×60 (32 sets) for an intermediate, 2×75 (24) for a beginner and 5×60 (53)
for an advanced athlete.

A prefix search over priorities was tried first and rejected: at 3×60 it dropped a
complementary lift together with the variant that did not fit, although the lift alone
fitted. The fit is greedy by priority.

**Supporting changes.** `SelectedExercise`/`SessionExercise` carry an optional strength
prescription (role, rest, explicit exposures); the distributor places each exposure in a
different session and, for strength entries, prefers a mismatched session over the same
pattern twice. `exerciseMinutes` takes the prescribed rest. `summarizeSelection` is
extracted from `selectExercises`. `SetType.TOP_SINGLE` added. `remo-al-menton`
reclassified to `SHOULDER_ABDUCTION`. Four variants added to the catalogue and its
evidence file, all `programming-judgement` without citations.

**Home.** One active routine (`Routine.isActive`), activate with confirmation, rename,
delete with confirmation (§8.5). The name field moved to the preview page. The dashed
borders on the two creation buttons were removed.

**Integer RIR.** `clampSetRIR` rounded to half points, so a microcycle adjustment of 0.5
prescribed sets at RIR 2.5 in the mesocycle view. It now rounds to whole numbers, halves
toward more reserve.

**Fixed on the way.** `MesocycleRepository.listByRoutine` queried by `routineId` alone,
which the ownership rules reject; it now filters by `userId` too. It had no callers.

**Verification:** `npx tsc --noEmit` clean · **804 tests, 34 suites** · 100 %
statements, branches, functions and lines in the measured scope. Nothing on this list
has been run on a device.

### 2026-09-28 — Chest-supported row; routine names required and unique

Fran tested the strength flow on a device and confirmed it works.

**Row.** The complementary horizontal pull is now `remo-pecho-apoyado` instead of the
barbell row, at Fran's request. The reasoning holds up in a strength block: squat and
deadlift already spend the erectors' recovery, and a bent-over row is limited by the
same erectors, so it trains the lower back a third time and the upper back less. With
the pad, the load is set by the muscles the row is for. Without the machine the program
falls back to the best available horizontal pull.

**Names.** There is no default name any more. Saving without one scrolls back to the
field and says why, and a name the athlete already uses is rejected, both at creation
and when renaming. The placeholder reads as an example, not as a value.

**Verification:** `npx tsc --noEmit` clean · **807 tests, 34 suites** · 100 % in the
measured scope.

### 2026-09-28 — Free iOS Personal Team development signing

- Vigor's current sign-in screen supports Google and anonymous access; Apple sign-in is not exposed. Keep `ios.usesAppleSignIn` disabled while developing with a free Apple Personal Team.
- Expo SDK 57's installed `expo-apple-authentication` config plugin adds the Apple Sign-In entitlement whenever its package is present, even when `usesAppleSignIn` is false. A local config plugin now removes only `com.apple.developer.applesignin` from generated iOS entitlements so Xcode can provision development builds with a Personal Team.
- This preserves Google and anonymous authentication. Apple sign-in remains unavailable until Vigor intentionally enables that feature with an Apple Developer Program team.
- The local development configuration pins the user's Personal Team ID (`LL38NNFGB2`) so regenerated Xcode projects retain automatic signing.
- The iOS bundle identifier is `com.franciscobecerra.vigor`, because `com.vigor.app` is already registered to another Apple developer team and cannot be provisioned by this Personal Team. Firebase's existing iOS plist still names the old ID; validate and update Firebase/Google OAuth app registration if Google login fails under the new ID.
- Personal Team provisioning is for local testing on registered devices; Apple manages those profiles in Xcode and they expire periodically, requiring a rebuild/reinstall.

### 2026-09-28 — Editable generation, native tabs, and honest microcycle effort

- The generated-plan preview permits adding a catalogue exercise to a specific session. The picker respects available equipment and excludes exercises already used in the plan. Additions start with three goal/profile-specific sets, are freely editable, can be removed, and affect the displayed session duration and volume before the plan is saved. The preview header shows each session's actual set count.
- Emphasis chips display an explicit priority/depriority state as well as color; color alone must never convey the setting.
- The bottom navigator uses Expo Router native tabs. On iOS 26+, the system owns the Liquid Glass appearance; older iOS and Android use their native tab appearances. Do not draw a second glass capsule around the tab bar. The generation action row reserves explicit clearance above the native navigator because this route's action otherwise overlaps the tabs on device.
- Hypertrophy accumulation now projects a gradual *per-set* integer-RIR ramp. This is a transparent programming heuristic, not a claim that progressive proximity to failure is superior in all cases. The stored first microcycle remains the source; subsequent microcycles reduce one point on selected sets across the block and the last microcycle remains a deload. The UI renders the actual per-set targets and computes mean RIR from those sets, not from the final set of each exercise. Already-resolved microcycle sessions must never receive global volume/RIR deltas a second time.
- The 0.5 coefficient for secondary-muscle volume is an accounting heuristic, not a validated conversion from indirect work to direct hypertrophy sets. A 4×75-minute intermediate plan with back and triceps prioritized and quads deprioritized produced 73–81 working sets across ten seeds (seed 1: 79), while only 213 of 276 available working minutes were occupied. Recovery/landmark allocation, not clock time, limited the plan. Extra available time is not itself an indication to prescribe 90 sets. The observed seed also produced only one direct biceps exercise in one session; this frequency/selection defect remains to be addressed separately before claiming the generator is fully balanced.

### 2026-09-28 — Routine revisions, session overrides, duration and direct-work audit

- The native-tab generation action now uses the `react-native-screens` native `SafeAreaView` with its bottom edge enabled, as recommended by the Expo Router native-tabs guide, instead of an old floating-capsule height. The old fixed clearance double-counted the iOS tab area and wasted vertical space. Verify the final placement on an iPhone; emulator-independent tests cannot prove a native safe-area layout.
- Tapping a saved routine opens a full session/exercise overview. The separate chevron still expands its home card. From the overview the athlete may edit exercises, set counts and repetition ranges for the current and future block; prior microcycles remain unchanged. `Mesocycle.prescriptionRevisions` stores whole-plan revisions with the microcycle index where they take effect; a new revision supersedes any later revisions. A one-off `sessionOverrides` entry stores a session's prescription for one specific microcycle. Both the roadmap and actual workout launch resolve these persisted edits through the same pure service. Strength revisions retain the mesocycle's absolute intensity ramp rather than restarting at week one. Completed or skipped sessions cannot be edited retroactively; when the running microcycle has history, a whole-plan edit starts at the next one.
- In the mesocycle view, tapping an exercise opens per-set RIR/kg and working-set-count editing; a long press exposes edit/swap actions. Long-pressing or tapping the actions button on the current session exposes start/skip. Skips are recorded as timestamps in `Mesocycle.skippedSessions`, never as completed workouts, and are excluded when choosing the next pending session. One-off changes do not alter later microcycles.
- Duration is a **conservative estimate**, not a validated fixed conversion: `exerciseMinutes` now floors planned work at 3 min per working set, including normal transitions, and the session preview adds the 6-minute session overhead. Thus 18 sets require at least 60 min, and 24 sets cannot be displayed as 46 min. The rest timer itself remains profile-specific (150/120/90 s); the planning floor covers things a timer does not measure. Actual workout-duration observations should eventually replace this heuristic.
- Hypertrophy prescriptions keep per-set RIR 4+ only as an early option for demanding primary compounds; secondary compounds and isolation work now receive at most one extra point of reserve on earlier sets, and later microcycles cap at RIR 3. This is a programming judgment, not evidence for a universal RIR threshold or a need to reach failure repeatedly. The 2024 exploratory meta-regression found that closer proximity to failure may favor hypertrophy but could not identify an exact optimum; a 2023 meta-analysis did not establish superiority of momentary failure over non-failure. References: https://pubmed.ncbi.nlm.nih.gov/38970765/ and https://pubmed.ncbi.nlm.nih.gov/36334240/.
- The selector now protects a modest direct biceps/triceps floor (at least 6 direct sets for ordinary targets), instead of letting fractional indirect credit entirely replace direct work. Where at least four sessions and enough selected direct sets exist, distribution attempts to spread a muscle across two sessions, preferring a matching focus. The preview exposes direct and indirect set components separately. The 0.5 indirect accounting model is supported as a useful *aggregate model* in a 2025 meta-regression, but it does not prove an exact per-exercise equivalence; the direct floor remains a programming judgment. References: https://pubmed.ncbi.nlm.nih.gov/41343037/ and https://pubmed.ncbi.nlm.nih.gov/31268995/. Volume-equated frequency does not consistently change hypertrophy, so the two-session distribution is primarily about practicality and avoiding excessive single-session concentration: https://pubmed.ncbi.nlm.nih.gov/30558493/.
- The old claims in the distributor that 10-12 sets are a universal physiological ceiling and that excess work necessarily impairs motor-unit recruitment have been removed. Session caps are heuristics to be calibrated from actual adherence and recovery data.
- Verification: TypeScript clean, 823 tests across 37 suites passing. The 4×75-minute back/triceps-priority, quad-deprioritized intermediate harness produced 76–83 working sets over 30 seeds, with no repeated exercise, fallback exercise, or anchorless session. The native safe-area placement and Firestore edit flow still require on-device confirmation.

### 2026-09-28 — Session-first routine editing and quieter volume presentation

- The plan preview omits any zero-valued direct or indirect volume component instead of showing `0 direct` or `0 indirect`. Both nonzero components remain explicit so secondary-muscle credit is never mistaken for direct sets.
- The total-set summary retains its surface but uses body-scale, secondary-color typography and tighter padding rather than an accent headline. In a single-session detail it says simply `N sets`, not `N sets per microcycle`.
- The saved-routine overview exposes `View mesocycle` and `Edit routine` as separate top actions. Tapping anywhere on a session card opens that session's exercise and set summary. An active, pending current-microcycle session can be started directly; pending sessions of either active or inactive routines can be edited. Completed and skipped sessions remain inspectable but cannot launch or be changed retroactively.
- Session editing exposes exercise swaps/additions/removal, sets, repetition ranges, and per-working-set RIR. Changing prescribed RIR or target reps recalculates an existing suggested kilogram load through an e1RM-preserving approximation; it never fabricates kilograms when no estimate exists. Swapping an exercise clears the former exercise's suggested kg and manual RIR overrides rather than transferring them to a different movement. `manualRIRBySet` records only explicitly edited series: when the edit is propagated, those RIR targets remain fixed while other series retain their automated microcycle ramp; removing a set also removes its override, and the deload still overrides ordinary accumulation intensity. Saving asks whether to apply the edit only to the current microcycle or throughout the remaining mesocycle. The first choice writes one `sessionOverrides` entry. The second writes a prescription revision from the current microcycle when it has no history. When another session in the current microcycle is already completed/skipped, it writes a one-off override for the pending session and starts the revision at the following microcycle, preserving performed work. A session edit never silently changes unrelated sessions; a later whole-plan edit supersedes later plan revisions as already specified above.
- Verification: TypeScript clean and 833 tests across 37 suites passing, including zero-component volume labels, both session-save scopes, unrelated-session preservation, per-set RIR/load and rep/load edits, edited-set persistence during progression, and clearing stale load/RIR data after a swap. An iOS JavaScript export also bundled successfully. The native visual layout and Firestore flow still require device confirmation.

### 2026-09-29 — Session detail actions and source exercise index

- A saved session now has one shared detail route from the routine overview, today's session, and mesocycle progression. It shows target muscles, exercises, rep ranges and per-set RIR, with a pinned start action. Session and exercise actions use the app-styled in-app sheet; skipping requires an in-app confirmation and remains distinct from completing a workout. The editor exposes repetitions and RIR, not a suggested kilogram field. Saving can target the current microcycle or the remaining plan.
- The sixth-edition exercise guide contributes 337 page-indexed exercise entries. Pages that clearly describe an existing catalogue exercise link to that exercise instead of duplicating it. New guide entries retain their source page and use `MANUAL_ONLY`; a provisional biomechanical score does not by itself establish their programming role or indirect muscle-credit fractions.
- All 257 new guide entries have a primary implement inferred from the page title, description or figure. The 59 formerly unresolved pages were checked individually; the resulting set has zero `UNSPECIFIED` equipment values. Specific implements include safety bar, trap bar, landmine, Roman chair and stability ball. Equipment filters now apply to these entries. Forearm work remains its own muscle group without default volume landmarks or generation emphasis.
- The six guide criteria are reproducible, ordinal Vigor judgements from `guideScoringRubric.ts`, linked to each source page. The neutral score of 3 is retained when a feature cannot be distinguished. Observable support, balance demands and load increments drive stability/progression; compound axial loading informs fatigue; clearly length-biased positions may raise the stretch criterion; page-specific documented exceptions alter the neutral value. A machine never gets an automatic hypertrophy bonus just for being a machine. These scores are not measured effect sizes, clinical risk estimates, or proof that a named variation grows more muscle. Guide entries can be compared in manual selection but remain outside automatic programming until muscle attribution, stimulus tags, contraindication handling and selection-quality tests have been reviewed.
- The manual exercise picker exposes derived stimulus and fatigue-cost scores (both 1–5, with higher fatigue meaning more costly), alongside a provisional-guide label and source page. Custom exercises without criteria do not display invented scores. The score is descriptive and never overrides an athlete's tolerance or equipment constraints.
- The guide's descriptions are treated as practical hypotheses and classification context, not as comparative proof that one named variant produces more hypertrophy. Research supports choosing movements that fit the target anatomy and goal, while excessive or redundant rotation can be counterproductive; machine and free-weight training show similar average hypertrophy in current meta-analyses. Sources: https://pubmed.ncbi.nlm.nih.gov/34743671/, https://pubmed.ncbi.nlm.nih.gov/35438660/, https://pubmed.ncbi.nlm.nih.gov/37582807/.
- The remaining scientific work is a per-exercise audit of target muscle, movement vector, indirect credits, stimulus tags and programming suitability, checked against primary studies where available. Guide-derived entries stay manual-only until this audit and varied-seed generator tests pass. Existing catalogue scores also remain expert judgements; their stimulus weights were revised from 0.40/0.28/0.22/0.10 (stretch/profile/ROM/progression) to 0.35/0.15/0.27/0.23, reducing the unsupported dominance of resistance-curve matching. These exact weights are an explicit product preference pending prospective validation, not estimates from clinical trials. Source context: https://pubmed.ncbi.nlm.nih.gov/37582807/ and https://pubmed.ncbi.nlm.nih.gov/40570881/.
- Import result: 337 numbered pages indexed; 80 pages resolve to existing entries, and 257 distinct guide entries were added to the selectable catalogue. All 257 have inferred equipment and provisional six-criterion scores. Manual-only entries remain excluded from hypertrophy and strength automatic selection, but the scoring functions can now evaluate them.
- Verification after the rubric change: TypeScript clean; catalogue validation passes via `node --import tsx scripts/catalogue-report.ts --validate`; `git diff --check` clean; 840 tests across 38 suites pass. The standard `npm run catalogue` command is blocked in this sandbox because the `tsx` CLI cannot create its IPC pipe, so the equivalent script was run through Node's `tsx` import hook. Native-device appearance remains unverified.

### 2026-09-30 — Paired exercise-ranking audit and generator-quality gate

**Decision.** The six 1–5 exercise attributes are ordinal expert judgements, not measured effect sizes. A prototype comparator therefore treats adjacent one-point differences as ties, calls one candidate dominant only for a clear two-point stretch/ROM or practical-adequacy advantage, and keeps recovery cost outside the efficacy comparison. `rankingPolicy: 'ordinal'` remains available for reproducible experiments. The production default stays `legacy-weighted`: the ordinal prototype did **not** pass the whole-routine quality gate below. The swap picker no longer implies that an experimental ordinal front is a clinically or scientifically established “preferred” option; it may show a coarse systemic-cost category. Strength programming is unchanged.

**Paired design.** `scripts/evaluate-exercise-ranking.ts` runs 30 hypertrophy inputs—10 beginner, 10 intermediate, 10 advanced—varying 2–6 sessions, 45–90 minutes, AUTO/full-body/upper-lower/PPL, seeds, emphasis and equipment. Each input uses the same seed and catalogue under both policies. A separate intermediate strength case checks that its prescribed selection is unaffected. Run each level with `node --import tsx scripts/evaluate-exercise-ranking.ts --level=BEGINNER --legacy` and repeat for `INTERMEDIATE` and `ADVANCED`, then omit `--legacy` for the experimental policy. The baseline suite had 840 passing tests before the prototype; the final suite has 844 passing tests. These are **generator outputs**, not observed muscle-growth outcomes.

| Level (10 paired cases each) | Weighted: sets / structural alerts / adjacency alerts | Ordinal: sets / structural alerts / adjacency alerts |
|---|---:|---:|
| Beginner | 452 / 45 / 12 | 450 / 54 / 14 |
| Intermediate | 735 / 22 / 18 | 719 / 25 / 15 |
| Advanced | 876 / 25 / 21 | 853 / 21 / 21 |
| **Total** | **2063 / 92 / 51** | **2022 / 100 / 50** |

Neither policy produced a literally empty session. Weighted generated three sessions below 10 sets, ordinal also three; the ordinal policy additionally made case V's fifth session seven sets. Structural alerts include single-frequency, unbalanced-load and per-session-volume warnings. Adjacency alerts describe potential overlap **if the next planned session follows without enough recovery**; microcycles have no calendar schedule, so they cannot prove the athlete actually trained on consecutive days. The 41-set aggregate difference is a feasibility warning, not proof that more sets would necessarily produce more growth. Crucially, the ordinal variant lost 15 sets in V (74→59) and 29 in AB (107→78), while using the same time budget, and increased beginner structural alerts. It cannot be promoted on the strength of cleaner-looking exercise scores.

**Individual review.** Entries show weighted→ordinal. `S` means performed sets, `W` structural alerts, `Q` adjacency alerts. A lower alert count is desirable but does not by itself establish a better plan.

| Case | Input | Outcome and programming judgement |
|---|---|---|
| F | Beginner 3×60 full body | 50→49 S, 4→6 W. Removes sissy squat and good morning, but scatters more muscles into single exposures; mixed, no promotion. |
| K | Beginner 2×45 full body | 26→25 S, 5→5 W. Five muscles remain single-frequency; no material gain. |
| L | Beginner 3×45 full body, back priority | 31→31 S, 4→5 W, 1→0 Q. Supinated pull-ups replace a pulldown; this may be less scalable for a new lifter. |
| M | Beginner 3×75 AUTO, chest priority | 51→51 S, 5→5 W, 2→2 Q. Changes presses and vertical pulls, without solving dispersed frequency. |
| N | Beginner 4×55 upper/lower | 50→50 S, 3→6 W. Both policies make three upper sessions and one lower session; the ordinal version worsens frequency. Split resolution needs repair. |
| O | Beginner 4×70 AUTO, hamstrings priority | 51→51 S, 3→3 W. Both finish with a six-set, ~20-minute lower session despite 70 minutes available. Do not pad volume merely to fill time; recommend fewer sessions or rebalance. |
| P | Beginner 3×60 full body, free-weight equipment | 49→49 S, 5→4 W. Only a curl variant changes materially; practical tie. |
| Q | Beginner 4×45 PPL, biceps priority | 47→47 S, 4→7 W, 2→3 Q. More fragmented and overlapping; weighted wins. |
| R | Beginner 2×80 full body, chest deprioritized | 47→47 S, 4→4 W. Two 23–24-set days may be feasible but are dense; split frequency warnings need contextual interpretation at two sessions. |
| S | Beginner 5×50 AUTO, glutes priority | 50→50 S, 8→9 W, 1→2 Q; leg day falls 9→7 sets and conventional deadlift enters. Neither five-day prescription is compelling for this recovery budget. |
| A | Intermediate 4×75 AUTO, back/triceps priority | 77→76 S, 2→3 W. Both resolve to upper/lower/upper/upper; last two upper days have an overlap alert. |
| B | Same input as A, different seed | 78→76 S, 2→3 W. Confirms the split/frequency defect is not one unlucky draw. |
| C | Intermediate 5×65 AUTO | 88→89 S, 1→1 W, 2→2 Q. Similar quality; a sissy squat remains in the weighted plan. |
| D | Same input as C, different seed | 88→89 S, 1→1 W, 3→4 Q. One more adjacency risk offsets the extra set. |
| E | Intermediate 4×70 PPL, biceps priority | 73→73 S, 1→1 W, 2→2 Q. Exercise changes do not resolve core single-frequency. |
| I | Intermediate 4×60 AUTO, free-weight equipment | 63→63 S, 3→3 W, 2→1 Q. Similar selection; conventional deadlift, Nordic curl and good morning in the weighted plan require suitability review. |
| T | Intermediate 3×45 full body | 33→31 S, 3→4 W, 1→0 Q. Saves one adjacency warning at the expense of volume/frequency; not a clear win. |
| U | Intermediate 4×90 upper/lower, chest priority | 74→74 S, 2→2 W, 2→2 Q. Resolves to three upper days and one lower day; spare time does not justify unneeded extra sets. |
| V | Intermediate 5×55 PPL, quads priority | 74→59 S, 6→6 W, fifth day 16→7 sets. Major regression; ordinal selector fails feasibility. |
| W | Intermediate 6×60 AUTO, biceps deprioritized | 87→89 S, 1→1 W, 1→2 Q. Slightly more volume but more overlap; mixed. |
| G | Advanced 6×75 PPL | 116→116 S, 3→2 W. Both exceed per-session small-muscle caps in places; ordinal improves one alert but does not solve balance. |
| H | Advanced 5×70 upper/lower, hamstrings/lateral-delt priority | 74→74 S, 3→4 W, 0→2 Q. Adds conventional deadlift; worse sequence/frequency. |
| X | Advanced 3×60 full body | 45→48 S, 6→4 W. Ordinal is better on these proxies, but both distribute several muscles only once and are time constrained. |
| Y | Advanced 4×75 upper/lower, back priority | 80→82 S, 2→1 W, 3→3 Q. Modest ordinal gain; adjacent-session risks persist. |
| Z | Advanced 5×65 AUTO, triceps priority | 74→74 S, 4→3 W, 3→3 Q. Slight improvement, but split remains unbalanced. |
| AA | Advanced 6×45 PPL | 69→71 S, 2→2 W, 2→2 Q. Small gain, not meaningful evidence of a superior ranking. |
| AB | Advanced 4×90 AUTO, quads priority | 107→78 S, 1→2 W. Weighted has 26–27-set days near the duration ceiling; ordinal leaves large unused capacity and worsens balance. Neither should be called optimal without observed workout times. |
| AC | Advanced 5×80 upper/lower, biceps/lateral-delt priority | 109→109 S, 1→1 W, 0→0 Q. Practical tie. |
| AD | Advanced 6×60 AUTO, restricted free weights | 99→99 S, 2→1 W, 4→4 Q. One frequency improvement, but four adjacent-overlap alerts remain and the weighted plan contains bench dips. |
| AE | Advanced 5×75 PPL, chest deprioritized | 103→102 S, 1→1 W, 4→2 Q. Ordinal improves sequencing, while small-muscle concentration remains. |

**Exercise winners and catalogue limitation.** Across the 30 weighted plans, upright row appeared in 26, close-grip bench in 22, ab wheel in 21, cable curl and cable lateral raise in 19 each, and sissy squat in 13. With the ordinal prototype, upright row appeared in 28, ab wheel 22, cable lateral raise and close-grip bench 21 each, and conventional deadlift 10 versus 7 weighted. Pull-ups rose from 2→9 and supinated pull-ups 1→6, while unilateral pulldown fell 10→1 and sissy squat 13→7. Some substitutions are useful, but the method merely trades one overrepresented exercise for another. Only **14 of 117** auto-eligible catalogue exercises have explicit `stimulusTags`; for the other 103, novelty falls back to movement vector alone. Consequently, the purported angle/resistance-profile diversity is mostly unimplemented. This is a bigger limitation than decimal score precision.

**Required follow-up, in priority order.**

1. Make split resolution level/volume-aware: do not label a 3-upper/1-lower sequence “upper/lower” without an explicit reason; when the recoverable volume cannot support the requested number of meaningful sessions, offer a shorter schedule rather than manufacturing filler sets. Add regression cases N, O, S, A/B and U.
2. Treat a near-empty planned session (proposed product threshold: fewer than 8–10 working sets **or** much shorter than the user's available time, after considering level and goal) as a plan-quality failure requiring redistribution, another structure or an explicit “capacity exceeds useful volume” explanation. This is a usability threshold, not a physiological law. Add cases O, S and V. Do not maximize weekly sets solely because time exists.
3. Preserve microcycles defined by sessions, but show recovery-aware guidance between planned sessions using actual completion timestamps and high-overlap warnings. When possible, reorder a compatible session or recommend a rest day; allow the athlete to override. Do not claim fixed 48/72-hour recovery requirements without individual response data. Add adjacent-session tests, including the last session of one microcycle versus the first of the next.
4. Audit every auto-eligible exercise for primary-muscle attribution, stimulus tags, beginner suitability, setup cost and systemic cost. Specifically review why upright row and close-grip bench win so often, and whether sissy squat, good morning, conventional deadlift and bench dips should be standard hypertrophy draws at each level. Add angle/resistance-profile coverage tests before claiming real stimulus variety.
5. Re-evaluate the ordinal policy only after those independent faults are fixed; compare paired whole-routine outcomes and manual blinded quality judgements again. Never present score differences as direct evidence of exercise superiority. Exercise order matters more clearly for the exercise-specific strength outcome than for aggregate hypertrophy, and volume-equated split choice has no established universal winner: https://pubmed.ncbi.nlm.nih.gov/32077380/ and https://pubmed.ncbi.nlm.nih.gov/38595233/. The 0.5 indirect-set coefficient is useful aggregate bookkeeping, not a guarantee for any particular exercise: https://pubmed.ncbi.nlm.nih.gov/41343037/.

**Verification:** the original ten-case weighted outputs (including strength) remained byte-for-byte identical in session exercise IDs and performed-set totals under the explicit legacy policy. The strength control also matched across both policies at 46 sets. `npx tsc --noEmit`, `npm test -- --runInBand` (844 tests, 38 suites), and `git diff --check` all passed. No on-device or longitudinal training validation has been performed for this experiment.

### 2026-09-30 — Flexible session rebalance and visible 12-set quality floor

**Implemented scope.** A hypertrophy day's PUSH/PULL/UPPER/LOWER/LEGS label is a preferred movement family, not an absolute exercise veto. The initial placement still respects it when feasible. A late deterministic repair can then move or exchange **whole exercise appearances** across focus labels to (1) remove a small per-session time overflow before cutting the entire microcycle's volume, (2) lift an underfilled day toward 12 working sets, and (3) narrow a large residual between-day set spread. Moves preserve all performed sets, no-repeat exercise identity, an existing compound anchor, already achieved two-session direct-muscle frequency when at least six direct sets exist, per-muscle session caps, and the user's per-session time limit. They price focus mismatch and adjacent-session overlap rather than pretending those costs do not exist. A three-set Bulgarian split squat now qualifies as an anchor because it is a substantial multi-joint unilateral knee pattern.

`MIN_HYPERTROPHY_SESSION_SETS = 12` is a **product-quality flag**, not a scientifically established minimum effective dose for every athlete or session. It is applied to generated hypertrophy distributions and recalculated after preview edits. `underfilled-session` warnings include the affected session index; the preview highlights its set count and names the affected sessions. Strength plans are exempt because their specific prescriptions may legitimately use fewer sets. When total recoverable work is below `12 × selected session count`, or whole-exercise/time/recovery constraints prevent a feasible move, the generator must report the short day rather than inventing sets or silently changing the athlete's requested session count. The preview suggests fewer training sessions or manual editing, without blocking a deliberate override.

**Thirty paired-case regression audit against the 2026-09-30 weighted baseline** (same inputs and seeds; after change, catalogue suitability also differs as noted below):

| Metric across 30 hypertrophy plans / 126 sessions | Before | After |
|---|---:|---:|
| Sessions below 12 sets | 18 | 6 |
| Sessions below 10 sets | 3 | 2 |
| Unbalanced-load alerts | 2 | 0 |
| Adjacent-overlap alerts | 51 | 47 |
| Performed sets, aggregate | 2063 | 2066 |

The former six-set fourth day in beginner case O is now 12 sets; the 4×45 beginner PPL case Q is 12/12/13/13; intermediate case T is 12/12/12; advanced case G is 20/19/17/21/16/16 rather than a 23-set day beside a 12-set day. The remaining below-12 days occur **only** in beginner L (34 sets across three sessions, below the 36 needed) and S (50 across five, below the 60 needed). S still contains two nine-set sessions; it is flagged in the preview, not misrepresented as a satisfactory five-day prescription. The appropriate next product action is to offer a four-training-session alternative or an explicit rest slot, not to prescribe ten extra sets merely to meet a UI threshold. Twenty additional 5×65-minute intermediate seeds were checked by the test suite; all still produce at least 80 sets. The one-minute-overflow regression that previously cut seed 1 from 90 to 75 sets is repaired by a time-feasible exchange.

**Catalogue suitability decision.** Upright row and sissy squat are now `MANUAL_ONLY`, so the athlete can still choose them in preview or a workout but the automatic hypertrophy generator cannot make them frequent default winners. This is a programming/usability gate, **not** a claim of proven inferior hypertrophy. The upright row was selected in 26/30 baseline plans despite a lower catalogue stimulus judgement than cable/machine lateral raises; its compound/time-efficiency bonus and indirect credit explained the frequency. Surface EMG can show muscle activation but cannot establish a long-term hypertrophy ranking for upright row versus lateral raise. The sissy squat has low rated load-progressability and stability (2/5 each), whereas hack squat and leg extension are easier to standardize and load. There is no adequate head-to-head growth evidence justifying an exact biological ranking across all these variants. The tier change leaves all six ordinal attribute ratings unchanged. The selector also now compares suitability tier **before** applying its time-constrained compound preference, so a fallback compound cannot crowd out a standard isolation solely by being multi-joint. References for the limits of inference: https://pubmed.ncbi.nlm.nih.gov/22362088/ (upright-row EMG) and https://pubmed.ncbi.nlm.nih.gov/40692697/ (longitudinal cable versus dumbbell lateral raises, not upright row).

The auto-eligible catalogue now contains 115 exercises, only 14 with explicit stimulus tags; the broader angle/resistance-profile audit remains open. The manual-only tier must not be mistaken for an injury contraindication: athlete choice and tolerance still matter.

**Rest-day proposal, not yet implemented.** Optional `Rest Day`/`Descanso` markers between workout sessions could be checked or unchecked from the training home screen. A rest marker must not count as a prescribed workout, completed workout, or additional microcycle progression slot. Its state should record an actual day of rest (with a date) separately from skipped training; a tap alone cannot certify physiological recovery. Before implementation, resolve persistence, whether markers are preplanned or inserted dynamically after high-overlap work, and how a missed or moved rest day changes the next-session recommendation. Keep the existing session-based microcycle invariant and allow the athlete to override any guidance. No fixed 48/72-hour recovery rule should be presented as universal.

**Verification:** `node --import tsx scripts/catalogue-report.ts --validate` reports 378 valid exercises; `npx tsc --noEmit`, `git diff --check`, and `npm test -- --runInBand` (852 tests, 38 suites) pass. The 30-case audit and 20-seed 5×65-minute regression are generator simulations; native preview layout and real workout adherence still require on-device checks.

### 2026-09-30 — Reproducible generator quality contract, dated rest and duration feedback

This entry supersedes the preceding **not-yet-implemented rest-day proposal**. Full methods, individual base-case reviews and residual issues are recorded in `docs/audits/2026-09-30-review.md`; raw compressed prescriptions, inputs, catalogue/source fingerprints and paired results are retained beside it. This iteration implements the optimization plan's evaluation and functional foundations, not a claim of globally optimal routines or experimentally measured individual recovery.

**1–4. Quality contract and controlled evaluation.** `generatorQuality.ts` separates hard errors (empty sessions, unavailable exercises, duplicated hypertrophy exercise identities, time overflow, exercise set caps, unassigned work and non-conserved volume) from soft preferences (12-set session floor, volume targets, pattern coverage, balance and overlap). Session reports include named exercises, equipment, patterns, sets, minutes, volume share and direct/indirect muscle attribution. Undated plans explicitly report `calendar-required` recovery status and no fabricated weekly normalization. `scripts/evaluate-generator.ts` retains 30 hypertrophy scenarios plus the strength control and extends them to 55 configurations, ten seeds each and a five-minute sensitivity perturbation: 605 runs. Inputs and results are archived before/after; catalogue equality is part of comparison validity. Search repair, allocation extraction, priority repair, hinge repair and descriptive-tag experiments were evaluated separately. The original 129-case and expanded 605-case baselines are distinct and labelled in the report.

**5–6. Catalogue uncertainty and allocation phases.** Catalogue auditing reports missing descriptors instead of inventing numerical ratings, detects duplicate IDs/secondary-muscle attribution and checks criteria/tag validity. Secondary credit cannot count the primary muscle twice. A description-derived metadata registry records explicit geometry with provenance; resistance profile and minimum experience remain unverified/not established where unsupported. Its optional ranking experiment failed regression checks and is **not promoted**. The production catalogue remains 378 exercises, 115 auto-eligible, only 14 with original explicit stimulus tags. The remaining manual-only guide exercises require individual review. `allocateExerciseVolume` is now a separately testable phase operating on a cloned selected roster; this extraction alone preserved prescriptions. The weighted selector remains the default.

**7–8. Volume and flexible allocation.** Existing level, priorities, declared tolerable volume, available time and indirect-credit priors remain inputs; they are not measured MEV/MAV/MRV. Additional bounded feasibility probes account for non-monotonic discrete selection. A time squeeze no longer removes the existing prioritized-muscle exercise allowance indiscriminately. Flexible placement and whole-exercise swaps separate redundant hip-dominant appearances when feasible without losing performed sets, established frequency, compound anchors or time compliance. An underfilled schedule can propose a mathematically plausible smaller number of training days, but never silently changes the user's schedule or adds irrelevant filler. Empty eligible catalogues are reported as catalogue-limited and cannot save an empty routine.

**9. Optional dated calendar and rest entities.** `Mesocycle.trainingCalendar` optionally stores a map of workout entries (`kind`, civil `date`, `microcycleIndex`, `sessionIndex`) and rest entries (`kind`, civil `date`, `microcycleIndex`, `checked`). Workout keys are `microcycle:session`; rest keys are `rest:date`. A themed calendar card in training home and routine overview proposes a 1–28-day calendar, allows date moves, and checks/unchecks current or past rest dates. Available rest slots preferentially separate adjacent sessions sharing direct work; remaining slots are spaced. Occupied dates and checked rest destinations are protected. Moving a workout leaves an unchecked rest day on its former date. Firestore transactions merge against current state rather than overwriting concurrent calendar changes. Checkmarks never complete/skip a workout, advance a microcycle, or certify physiological recovery. Dated pending sessions influence order within the current microcycle; undated routines retain existing order. The user can still train intentionally outside the suggested dates.

Recovery reporting uses actual civil-day gaps, including boundaries between dated microcycles. At least three direct sets for a shared muscle on adjacent dates triggers review, not an injury prediction or mandatory 48/72-hour prohibition. A scheduled-range seven-day volume equivalent is displayed without silently scaling the session-based prescription. Calendar edits do not rewrite workout history.

**10. Duration model and observational calibration.** Generation and session summaries share work (40 seconds/set), prescribed rests, setup (60 seconds/appearance), warm-up allowance (6 minutes) and a conservative three-minute-per-set floor. These are transparent product assumptions, not universal measured durations. Exercise rest intervals are editable and persisted through existing edit scopes (finite 0–600 seconds). Comparable completed workouts must match exercise identities and performed dose; implausible timing ratios are filtered. After five samples the UI exposes the observed median ratio. A bounded suggested multiplier is calculated, but neither dose nor predicted time is automatically adapted in this iteration. Without samples the app must not claim empirical calibration.

**11–13. Case review, regression and sensitivity.** All 605 runs have per-case automated findings; 31 original base cases were manually inspected, not all 605 independently reviewed by a coach. There are 33 intentionally impossible empty-catalogue controls and 572 nonempty runs without checked hard failures. Priority ten-seed span falls 16→8 sets in the affected emphasis scenario. Expanded paired aggregate sets increase 35,722→35,892, volume-deficit flags fall 1,072→1,035, and hypertrophy sessions containing two hip-dominant entries fall 40→0. Under-12 sessions remain **435**, including deliberately restrictive stress cases: this limitation is not solved by passing tests. Undated overlap warnings increase **1,072→1,087**; no claim of globally improved recovery is justified. Case S still warrants fewer training days, and close-grip bench appears in 165/176 advanced hypertrophy runs, motivating a separate selection-concentration investigation.

**14. Evidence versus policy.** Twelve-set warnings, fractional indirect credit, technical suitability tiers, timing allowances, overlap thresholds and ranking attributes are programming heuristics/preferences. Stretch is not a measured sarcomere stimulus and systemic cost is not a CNS-fatigue measurement. Individual response must eventually refine volume priors; available time alone does not establish a useful dose. The cable/dumbbell lateral-raise trial (https://pubmed.ncbi.nlm.nih.gov/40692697/) cannot validate a global exercise hierarchy. Existing PRD evidence caveats on equal-volume splits, order and indirect credit remain in force. No supplementary descriptor, score or absence of warnings should be represented as a demonstrated biological advantage.

**15. Acceptance gate and verification.** `npm run audit:generator -- --extended --seeds=10` runs the expanded matrix. A paired baseline additionally rejects new hard failures, newly underfilled sessions, per-case volume losses above max(3 sets, 10%), seed spans above ten sets and losses above three sets with five extra minutes. These are engineering regression tolerances, not physiological cut-offs; impossible empty-catalogue controls remain explicit. The descriptive-tag experiment correctly fails and remains diagnostic. `npm test -- --runInBand` passes **873 tests / 43 suites**; TypeScript, 378-exercise catalogue validation and iOS export pass. Calendar transactions have repository tests, but real Firestore/device flows, signed native deployment and longitudinal duration/recovery validation have not been performed. No infrastructure, deployed security rules or user workouts were changed. Official references consulted: https://docs.expo.dev/versions/v57.0.0/ and https://firebase.google.com/docs/firestore/manage-data/transactions.

### 2026-09-30 — Design corrections and explicit remaining generator debt

`docs/generator-technical-debt.md` now records all fifteen original points with unresolved behavior, a concrete proposed fix, acceptance evidence and execution order. The following decisions supersede overly broad conclusions in the preceding audit:

1. **Rest slots exist independently of dates.** An undated plan should still propose a repeatable workout/rest structure. Civil dates are optional placement of that structure. The current `calendar-required` diagnostic and optional dated card do not complete this requirement. A workout/rest template with declared cycle length, movable rest slots and contextual overlap reporting is the proposed fix; it is not implemented yet.
2. **Muscle-volume targets precede exercise decisions.** The current `buildVolumePlan` already establishes targets first. The intended improvement is iterative joint selection/dose allocation, accounting for compound contribution, residual direct work, time and fatigue. Extracting a function must not imply choosing an immutable exercise roster before deciding volume. No universal hypertrophy compound/isolation percentage is adopted.
3. **RDL plus hip thrust is not inherently redundant.** Broad HIP_DOMINANT and same-vector compound checks are too coarse. A supported hip thrust can complement a torso hinge. The previous 40→0 broad-pattern count is not sufficient evidence of better programming. Replace those checks with explicit mechanical families and pairwise demand/near-duplicate assessment while preserving volume, time and athlete intent. This correction is accepted design; production distribution still requires the corresponding implementation and paired regression.

**Catalogue screening begun, individual scientific review still open.** `catalogueReview.ts` and `scripts/review-catalogue.ts` produce a per-entry ledger for all 378 exercises, including existing parameters, source pages, criterion provenance and biomechanical verification tasks. The output is explicitly screening, not 378 completed scientific reviews. It flags 257 generic guide-rubric entries, 116 compounds without secondary attribution, 364 entries without original stimulus descriptors, and 37 criterion notes containing neural-fatigue language needing verification. Citation labels are not treated as verified claim support. Complete source-page text confirms nine specific taxonomy/equipment/attribution findings on pages 120, 159, 277, 283, 305, 311, 317, 347 and 367, retained with proposed fixes. No default scores, automatic eligibility, classifications or user routines changed in this diagnostic iteration.

**Order of work:** source/catalogue corrections and family taxonomy; undated rest structure; volume-first coupled allocation; evaluated fewer-day alternatives; observed-history personalization; wider sensitivity and reviewed quality gates. Testing a standalone/offline iPhone build is deferred at the user's explicit request to focus on generator issues. No deployment is performed.

**First confirmed catalogue corrections.** Following full source-description checks, imported page 159 now uses shoulder extension (the described elbow remains fixed); page 277 requires a stability ball; pages 305/311 require bands; pages 347/367 use bodyweight rather than a machine. Existing guide-rubric scores recalculate with the corrected implement, without new bespoke ratings. These entries remain manual-only, so eligibility of the automatic generator is unchanged. Required sliding surfaces/GHD support, dynamic trunk rotation and rack-pull credit still require model work. A regression test checks all six classifications and their manual-only status. This is the first source-backed correction batch, not completion of the entire scientific catalogue review.

**Verification for this batch:** all 876 tests in 44 suites pass; TypeScript, 378-entry catalogue validation and diff whitespace checks pass. Screening logic tests preserve input data and keep unverified citation claims distinct from confirmed source facts. No native deployment or real-device validation was performed.

### 2026-09-30 — Mechanical hip families, undated rest templates and guarded volume-first allocation

This advances the approved execution order without closing the full 378-exercise scientific review or all 15 debt items. Detailed implementation, per-base-case programming review, rejected experiment and reproduction commands are in `docs/audits/2026-09-30-ordered-batches.md`. Paired inputs/prescriptions are retained as `2026-09-30-coupled-before.json.gz` and `2026-09-30-coupled-after.json.gz` in that directory.

**Mechanical families.** Same-vector hip extension is no longer a blanket same-session ban. Explicit name/identity-derived families distinguish torso hinges, floor pulls, supported thrusts and supported extensions; unknown mechanics are `UNVERIFIED`. RDL plus hip thrust can coexist when dose and time fit. RDL plus dumbbell RDL remains a near-duplicate, and demanding torso-hinge concentration is handled separately. These are programming judgements, not measured CNS-fatigue values or clinical contraindications. Non-hip families and imported apparatus/attribution faults remain open.

**Rest without dates.** `Mesocycle.scheduleTemplate?: { days: number; slots: ScheduleSlot[] }` stores ordered workout/rest slots separately from `trainingCalendar`. Workout slots reference existing session indexes. Defaults use seven days; explicit 1–28-day cycles must accommodate every session exactly once in order. The builder spreads rest before stacking days and prioritizes shared direct-muscle work among equally filled gaps. Preview displays the proposal; the expanded routine calendar card lets the athlete move rest earlier/later and change cycle length. Optional dates derive from the exact template, but template edits never move existing dates or advance completed-session progression. Transactional persistence validates the latest saved session indexes. Cyclic last-to-first checks and warmup exclusion apply; warnings are advisory. Seven-day equivalents are displayed from the selected cycle length without increasing prescribed sets. Older mesocycles derive a template when the field is absent.

**Volume-first allocation and promotion gate.** Muscle targets remain established before exercise selection. The new `volume-aware` candidate rewards only remaining muscle-target utility, with direct-arm floors, modeled minutes and ordinal systemic-cost considerations. Surplus indirect credit is not useful volume. No universal compound/isolation ratio is imposed. Secondary credit 0.5, systemic-cost coefficient 0.1 and comparison tolerances are explicit heuristics, not experimental effect sizes. Unconditional activation worsened short-session count (435→443) and was rejected. For hypertrophy only, production now compares the legacy and coupled candidates and promotes the latter only when it preserves performed sets, time feasibility, assignment, nonempty sessions, minimum session size, spread, underfilled count, foundational-pattern deficit count, undated overlap warnings, protected direct-arm coverage and bounded muscle attribution. It must reduce target shortfall, or tie shortfall with lower ordinal systemic cost. Explicit policies remain available for reproducible experiments; strength prescription is unchanged. This supersedes the earlier legacy-only production policy. It is not a global solver or measured personal recovery model.

**Evaluated alternatives.** Underfilled hypertrophy requests can receive a real lower-frequency proposal using identical minutes per session, seed, catalogue, priorities and volume inputs. Each candidate must pass hard checks, keep total performed sets, preserve comparable attributed volume and direct-arm floors, have every training day at least 12 sets and not add undated overlap warnings. The closest lower frequency is tried first. No feasible candidate means no proposal, not filler work. Preview acceptance is explicit; stale plans and manually edited previews are protected from replacement. Acceptance updates both the displayed prescription and the saved frequency input. Case S now offers four days at 13/12/13/12 instead of five at 10/12/9/10/9, preserving 50 sets.

**Results and limits.** All 605 paired cases retain identical athlete inputs and catalogue fingerprints. 104 prescriptions change. Short sessions decrease from 435 to 429 (beginner 241→235; intermediate 117 unchanged; advanced 77 unchanged). No unexpected crashes, new hard violations, large volume regressions, >10-set seed spans or >3-set losses under the +5-minute perturbation were detected. The 33 empty-catalogue cases remain expected infeasible results. 52 scenarios offer qualifying optional lower-frequency plans; this does not mean all short sessions are fixed. Close-grip bench appearances fall only from 431 to 418, so concentration remains unresolved. The nine changed base configurations have individual written reviews; automated checks are not 605 individual scientific/coaching reviews. Full catalogue evidence review, observed-history personalization and wider sensitivity remain active debt.

**Verification:** `npm test -- --runInBand` passes 892 tests in 47 suites; TypeScript and all 378 catalogue entries validate. Repository and calendar tests cover transactional field isolation, stale sequence rejection, rest conversion, non-seven-day cycles and exact case-S behavior. Native UI layout and device persistence have not been tested in this iteration. Expo SDK 57 and official Firestore transaction documentation were consulted; no deployment or infrastructure change was performed.

### 2026-09-30 — Audit interpretation and future guided-generation UX

**Underfilled-session interpretation.** The 429 figure counts nonempty hypertrophy sessions below the product's 12-set threshold across 605 simulated plans; it is not 429 distinct configurations or a population failure rate. Repeated seeds and +5-minute probes deliberately amplify stress inputs. Of these sessions, 198 occur in the explicit 6×30-minute stress scenarios (66 per level), 86 in four-day chest/back/arms-only requests, 50 in the beginner 5×50-minute glute-priority configuration, and 95 in the remaining configurations. Normal requests also contribute: beginner and intermediate 3×45-minute full-body configurations contribute 18 and 9 respectively across their variants. Twelve sets is a programming/product warning threshold, not a physiological minimum; many short-budget requests cannot simultaneously satisfy it and the conservative duration model. The six-session reduction occurs in three seed variants of the beginner 3×45-minute back-priority configuration (four fewer warnings) and one seed variant of the beginner 4×65-minute back/triceps-priority configuration (two fewer). Optional lower-frequency proposals are evaluated separately, not silently deducted from the original-plan metric.

**Close-grip bench diagnosis, no rating change.** It is classified as TRICEPS primary, CHEST/DELTS_FRONT secondary, COMPOUND_SECONDARY. Its current stability/progression assessments are 4/5 and 5/5, expert judgements rather than measured quantities. Legacy time-constrained selection first prefers available compounds within the suitability tier, so isolation alternatives may be excluded before their better stimulus score matters. Fixed secondary credit and volume-per-minute weighting further reward the exercise; the guarded coupled candidate can still fall back to this legacy outcome. Thus the diagnosis is a policy/catalogue interaction, not just primary/secondary labels. A muscle limiting an exercise is not inherently undesirable when that muscle is the intended target; lower absolute load is not evidence of poorer load progressability or hypertrophy. A primary study reported higher 6RM loads with medium/wide than narrow grip, but it did not establish a longitudinal hypertrophy ranking or justify numerical stability ratings: https://pubmed.ncbi.nlm.nih.gov/28713459/. Candidate future fixes are to remove blanket compound-only eligibility for triceps after foundational coverage, value only needed cross-muscle credit, and review exercise-specific progression/stability with explicit rationale. No exercise is downgraded or banned in this diagnostic iteration.

**Catalogue eligibility detail.** Close-grip bench is currently the only automatic-eligible compound with TRICEPS as primary muscle. The legacy compound-first triceps branch therefore provides it effectively exclusive eligibility while an unselected instance remains available. This explains why improving isolation scores alone would not correct its frequency.

**Planned UX, not implemented.** Future generation should use a fast step-by-step flow with several minimal screens and contextual recommendations. AUTO should always be presented as the recommended split, while athlete-selected splits remain available. This is a product default enabling flexible allocation, not a claim that AUTO is scientifically superior to all other splits. Preserve current inputs, manual edits and preview acceptance; do not silently override the athlete's choices. This records future intent only: the existing two-page generation UI is unchanged.

### 2026-09-30 — Muscle-task accessory preference and JM/Kaz source review

**Evidence-to-policy boundary.** Prefer a combination of foundational movement coverage and complementary targeted work, not a universal "small muscle = isolation" law. Brandão et al. (https://pubmed.ncbi.nlm.nih.gov/32149887/) found different adaptations across triceps heads for bench versus extensions/combinations, without overall triceps between-group differences. Mannarino et al. (https://pubmed.ncbi.nlm.nih.gov/31268995/) favored curls over unilateral rows for elbow-flexor growth in ten untrained men; Gentil et al. (https://pubmed.ncbi.nlm.nih.gov/26446291/) found no curl/pulldown between-group difference in a different untrained sample. Maeo et al. (https://pubmed.ncbi.nlm.nih.gov/35819335/) favored overhead versus neutral cable extensions, not JM/Kaz versus other presses. These findings justify considering direct task and shoulder position but do not establish fixed accessory proportions, Vigor's 0.5 indirect credit, a universal direct-set floor, or uniformly lower isolation fatigue.

**Implemented candidate.** For hypertrophy, `accessory-aware` first prefers non-accessory-primary alternatives for basic pattern coverage when present. During residual target completion, biceps/triceps and anterior/lateral/posterior deltoid roles prefer local tasks within the available suitability tier. Local elbow-extension/flexion hybrids can qualify even with a compound-secondary profile. Compounds remain available when localized choices are absent or exhausted; other muscles and strength specificity are unchanged. Marginal cross-muscle utility is capped by remaining targets, and modeled minutes/systemic ordinal cost remain separate. This removes compulsory compound eligibility from the corrected accessory branch, without changing close-grip bench ratings or banning it. The candidate is accepted only through the existing non-regression contract against the prior guarded incumbent. A `coupled-control` audit policy reproduces that incumbent. Fallback can still retain the older compound preference when the new candidate worsens constraints: this is a bounded improvement, not complete removal of every concentration issue.

**JM/Kaz correction, not duplicate addition.** Both already existed at guide pages 211/210. Full descriptions and rendered figures have now been inspected. Existing IDs `guide-211` and `guide-210` are retained; catalogue size stays 378. Names now identify the barbell JM and Smith Kaz/JM variants. Implements are confirmed; the dominant vector is corrected to ELBOW_EXTENSION with a hybrid compound-secondary accessory profile, not foundational horizontal-press coverage. Secondary chest/front-delt set credit remains unassigned rather than fabricated. Their generic numeric rubric is withdrawn: both are explicitly unscored and manual-only until attribute review supports promotion. They can be searched, swapped or added manually with editable prescriptions and no borrowed bench-load estimate. This does not claim superiority over close-grip bench. See `docs/audits/jm-kaz-catalogue-review.md`.

**Unscored handling.** Numeric stimulus requests for unscored manual exercises remain rejected. Catalogue reporting labels them UNRATED and excludes them from score means. If such an exercise appears in previous manually performed work, sequencing uses the conservative upper cost bound as an uncertainty fallback, not a stored/displayed exercise rating or a claim of high physiological fatigue. The UI does not show a fatigue rubric for absent criteria.

**Controlled results.** `2026-09-30-accessory-control.json.gz` reruns the prior algorithm against the corrected manual catalogue and reproduces all 605 previous prescriptions exactly. The paired `2026-09-30-accessory-after.json.gz` uses identical athlete inputs and that exact corrected catalogue. 99 prescriptions change; short sessions decrease 429→406 (beginner 235→213, intermediate 117→116, advanced 77 unchanged); close-grip bench appearances decrease 418→370. No unexpected crashes, new hard errors, large volume losses or existing seed/+5-minute sensitivity gate regressions were detected. Expected empty-catalogue infeasibilities remain. Written reviews of the twelve changed base configurations and remaining defects are in `docs/audits/2026-09-30-accessory-policy.md`; these are not claims of optimal routines. Beginner technique-demand suitability, focus-label consistency and remaining press concentration remain open.

**Verification:** 900 tests in 47 suites pass, including missing-local-equipment fallback, localized-hybrid roles, explicit strength behavior, unscored automatic exclusion, previous manual work, search and manual insertion. TypeScript and the 378-entry schema validate. No deployment, infrastructure change or real-device UI verification was performed.

### 2026-10-01 — Individual triceps mechanics, policy traces and content-correct session labels

This is a bounded advance on the four approved priorities, not completion of the catalogue audit or the fifteen-point optimization plan. Detailed dispositions and five changed-base-profile reviews are in `docs/audits/2026-10-01-source-trace-coherence.md`.

**Individual source review.** All 35 numbered triceps pages (197-231) were read in full and their rendered figures inspected. `tricepsSourceReview.ts` records default implement, shoulder posture, required support, laterality, local versus hybrid role, per-entry setup and contradictions. Five existing aliases and 30 imports are covered. V2/V3 pushdown and PJR now have hybrid compound-secondary roles while retaining dominant ELBOW_EXTENSION, not foundational-press credit. Tate descriptions explicitly preserve elbow-only execution despite the press name; its cable implement was already correct and is confirmed, not newly corrected. JM/Kaz keep their existing IDs and primary triceps hybrid roles. No arbitrary secondary-muscle credit is added.

**Uncertain aliases and ratings.** Page 212 describes shoulder flexion near 90 degrees while its drawing looks more overhead. It is no longer silently aliased to `extension-sobre-cabeza-polea`; disputed `guide-212` is manual-only, preserving the original saved ID. Catalogue count is now 379 (121 originals plus 258 imports), with 115 automatic-eligible entries unchanged. Page 201 title/instructions specify dumbbells despite a barbell drawing; the default follows instructions and retains the discrepancy. All 30 reviewed imports are unscored rather than carrying a generic 3-based rubric as if individually verified. Broad bands for five dimensions are recorded as expert hypotheses, not production ratings or confidence intervals; resistance-profile matching remains unknown, not neutral. Existing alias ratings, including the machine-extension 5/5 match, are retained but expressly unvalidated. Required benches, cable stations, pads and attachments are documented, not yet availability filters. Source-mechanics review does not imply automatic promotion or completion of every criterion. Close-grip execution-specific attribution, bench-dip classification and other muscle families remain open.

**Evidence boundary.** The source guide's posture descriptions do not validate its head-emphasis, discomfort or superiority claims. Maeo's overhead-versus-neutral cable-extension trial (https://pubmed.ncbi.nlm.nih.gov/35819335/) and Brandao's bench/extension combinations (https://pubmed.ncbi.nlm.nih.gov/32149887/) inform complementary programming without establishing a hierarchy across every guide variant or exact indirect-set fractions. Cable tension is not constant joint torque; generic machine identity cannot establish a force-curve match. A lack of comparative trials does not prevent qualified biomechanical inference, but unknown attributes must not acquire fabricated precision.

**Explainable preservation gate.** `MesocyclePlan.policyTrace?` is diagnostic only, not persisted prescriptions. Each evaluated policy records acceptance, all violated preservation constraints with subjects/values, and target-shortfall/ordinal-cost metrics. Codes include time, assignment, empty sessions, underfilled count, minimum load, spread, template-overlap count, performed volume, foundational coverage, muscle attribution, direct-accessory floors and no objective improvement. This refactors the same incumbent contract without loosening it. Explicit policy experiments and strength remain unchanged. It explains whole-candidate fallback; per-exercise shortlist/random-draw explanations remain debt.

**Session coherence and presentation.** New advisory diagnostics flag named focus without its requested basic task, beginner coaching needs for explicitly listed demanding techniques, and multiple unsupported rows. These are coaching/product review triggers, not clinical bans or demonstrated injury risk. `sessionPresentationFocus` corrects hypertrophy labels when a lower-labelled session contains upper but no lower work, or the converse; mixed sessions preserve the flexible intended focus. Preview and newly persisted plans share the corrected label through `routineMapper`. Exercise IDs, order, sets, reps, RIR, rests and durations are unchanged. Strength focus labels and existing saved routines are not migrated. A Push day without a press is observable but not solved by this label correction.

**Isolated comparisons.** `2026-10-01-catalogue-before.json.gz` versus `catalogue-after` is a changed-catalogue experiment; all 605 prescriptions remain exactly identical. `catalogue-after` versus `coherence-after` has identical catalogue/athlete inputs in all 605 pairs. Forty-seven sessions in 47 plans change only their focus labels. There are zero unexpected crashes, no new hard failures, no large volume losses and no existing seed/+5-minute gate regressions. The 33 empty-catalogue controls remain expected infeasibilities. Underfilled count remains 406 (beginner 213, intermediate 116, advanced 77), not improved by diagnostics. New warnings expose 76 focus-without-press, 46 focus-without-pull, 14 focus-without-lower-work, 104 beginner-technique-review and 2 unsupported-row-concentration occurrences, not independent users or necessarily invalid programming. The seed-12 back/triceps profile rejects an accessory candidate despite lower ordinal cost because it adds a template-overlap warning; local reassignment is the next fix to evaluate, not blanket gate relaxation.

**Audit lifecycle and remaining work.** The refreshed whole-catalogue screening ledger is dated `2026-10-01-catalogue-review.*` and distinguishes source mechanics from score approval. The script now supports an explicit output prefix and defaults to an undated latest artifact, avoiding silent replacement of dated evidence. Individual source tables are reproducible with `scripts/report-triceps-review.ts`. Remaining priorities are original triceps attribution/rating decisions, individual biceps/shoulder/back/leg reviews, support-aware availability, per-exercise explanations and constrained local repair of misleading task placement. No claims that all 379 exercises or all 605 routines have received individual coaching/scientific approval.

### 2026-10-01 — Independent quality axes and complete audit snapshots (checklist 1–2)

**Scope.** Evaluation/tooling change only. Production selection, distribution, prescriptions, UI and persisted routine schemas are unchanged. All six subitems of checklist points 1 and 2 are implemented; the checked acceptance ledger and reproduction commands are in `docs/audits/2026-10-01-quality-contract-battery.md`.

**Quality contract 2.0.0.** `evaluateGeneratorQuality` now returns `assessment.feasibility`, `assessment.programming` and `assessment.confidence` independently. Compatibility `valid` means feasibility only, never whole-plan endorsement. Programming findings retain code/session/subject, explanation, magnitude and heuristic provenance; hard constraints retain a product-constraint basis. Passing total volume/time cannot erase session focus/task contradictions, short sessions, original target deficits or estimated overlap. A 12-set nonempty hypertrophy review floor is a product heuristic, not a physiological minimum; empty sessions are infeasible and not double-counted as short. Strength repetition, main-lift-share review and substitutions remain goal-specific. Demanding torso-hinge concentration excludes supported hip-thrust plus RDL as a blanket duplicate. Invalid doses/durations/indices/session counts fail feasibility explicitly.

**Compromises and epistemic limits.** Reports retain pre-cap and adjusted muscle targets, attributed volume and original shortfall. A `recovery` limiter is labelled a population-informed budget, not measured personal recovery. Confidence is heuristic-limited when exercises exist, otherwise not-assessable; selected IDs, missing scores/tags, unverified resistance profiles and individually source-reviewed mechanics remain visible. Fixed 0.5 indirect attribution, expert ordinal scores, volume landmarks, time and rest-template models must not become effect sizes, clinical risk, personal MEV/MRV measurements or a fabricated confidence percentage. No aggregate quality score is introduced.

**Reproducibility schema 2.** Audit artifacts preserve complete planner settings and seeds, full deduplicated per-case exercise snapshots, all prescriptions/sessions/diagnostics/alternatives/policy traces, source/model/data/audit code contents and hashes, package/lock/config contents, Node/tsx versions and matrix/quality-contract versions. Canonical object hashing ignores key insertion order while retaining array order. Replay by case ID verifies input, catalogue and source-manifest integrity and requires matching current source/runtime by default; archived code is never executed automatically. `--allow-version-drift` is an explicitly marked current-engine experiment. ID-only schema-1 artifacts are comparison-only, with their weaker global catalogue evidence labelled.

**Paired acceptance.** Identical athlete inputs and identical per-case catalogues support fixed-input comparisons. Ranking-policy changes are intentionally allowed in such experiments. Changed exercise parameters or added/removed catalogue IDs produce a catalogue experiment, not a different athlete-input comparison. Those experiments require explicit review and cannot be automatically promoted by a fixed-input gate. Changed athlete settings are unpaired, removed case coverage fails, added coverage is reported, and quality-contract changes are not silently treated as equivalent measurements. CLI exits are 0 for no triggered mechanical gate (not programming/scientific approval), 1 for expectation/regression/sensitivity failure, and 2 for explicit experiment/unpaired-input review.

**Coverage and results.** The default full battery includes 270 crossed base configurations (2 goals × 3 levels × 5 splits × 3 emphases × 3 material profiles) plus 55 legacy/edge cases, each with 10 seeds and a +5-minute probe: 3,575 runs, comprising 2,046 hypertrophy and 1,529 strength results. Complete dated references, a catalogue experiment and an exact replay are retained. A second full run has identical normalized outcome hashes for all 3,575 cases. The paired legacy before/after run preserves all 605 prescriptions and all 406 short-session findings. Expanded coverage finds zero crashes/unexpected infeasibility, 33 expected empty-catalogue controls and 887 short nonempty hypertrophy sessions; this is a changed sampling frame, not an allocation regression. One advanced full-equipment 5×75 PPL back/triceps configuration spans 111→99 sets across seeds, so the sensitivity gate deliberately remains red. The description-tag experiment changes 140 prescriptions, increases short sessions 406→408 and is not promoted. These discovered programming defects belong to subsequent allocator work, not a claim that the new evaluator improves prescriptions.

**Validation.** 967 tests / 52 suites, TypeScript and 379-entry catalogue validation pass. Focused affected evaluator/contract/audit protocol/matrix coverage reaches 100% statements/functions/lines and 98% branches. No deployment, native rebuild, commit or infrastructure change is part of this iteration.

### 2026-10-01 — Native visual QA and development-target diagnosis

For future UI changes, complement automated tests with native visual/interaction checks on an explicitly identified simulator or connected device whenever access is available. Check the affected flow, bottom actions/native-tab clearance and relevant appearance modes; retain screenshots and distinguish static inspection from exercised behavior. A passing Jest suite is not proof of correct native layout. Report unavailable control or untested flows instead of claiming device validation. Device Hub access is not assumed merely because an iPhone appears in Apple's device list.

Read-only diagnosis of the reported Expo startup failure found the booted iPhone 18 Pro simulator (`DB12E945-C223-44BE-B5BE-0885FE77B895`) still has the old `com.vigor.app` installation, while current Expo/Xcode configuration requests `com.franciscobecerra.vigor`. Metro is already listening on port 8081. The connected iPhone 13 has the new bundle identifier installed; this alone does not establish its build configuration or launcher compatibility. Expo CLI's installed-app check explains the simulator error without implying a failure of the JavaScript server. Target selection must be explicit before a native rebuild/install. No clean prebuild, removal of iOS files, reinstall on the phone or signing change is needed just to diagnose this mismatch. Subsequent TypeScript-only development uses Metro/Fast Refresh once a compatible native development build is installed; changes to native dependencies/configuration require reevaluating the native build.

**Verification:** 923 tests in 50 suites pass; TypeScript, all 379 catalogue entries and whitespace checks pass. Official Expo SDK 57 documentation was consulted. No deployment, infrastructure change, commit or real-device UI validation was performed.

### 2026-10-01 — Triceps closure and minimal time-squeeze fix

**Catalogue (checklist 5.1).** Six original triceps entries were corrected after their citations were checked against the PubMed abstracts. Resistance match 5→4 for the overhead cable and machine extensions, because neither has a measured profile and a cam does not prove a match. Rope progression 3→4 and bar ROM 3→4, because both use the same stack and the same elbow excursion. Close-grip bench stretch 4→2 and bench dips 4→2, because the extended shoulder shortens the long head. Bench dips are now COMPOUND_SECONDARY, since the shoulder and the elbow both move. Three misattributed citations were removed. Direct evidence now appears only where Maeo 2023 measured it: position-dependent growth. `TRICEPS_ELIGIBILITY` gives every triceps-primary entry an individual automatic-programming decision with a reason, enforced by a test: 7 originals automatic (bench dips as fallback), all 30 imports manual-only, including JM/Kaz. Page 212 stays a separate disputed entry. guide-199 received individual scores, but its promotion experiment was rejected and the entry stays manual.

**Planner.** When one session overshot by a few minutes, the planner switched to time-efficiency selection under a near-zero squeeze and discarded far more volume than the overshoot. It now also tries the ordinary selector under a minimal squeeze, and keeps it only if it leaves less unmet target volume with no extra structural defects. One recommendation for an intermediate athlete now takes about 2x as long (1.8→3.7 s on the development Mac).

**Result on the 605-case battery.** Short sessions 406→392, close-grip appearances 370→306, unmet target volume 9121.5→8194 sets. ADVANCED-short-seed-5 loses 6 sets and is recorded as open. Full dispositions, the E1 ablation and the rejected E2 are in `docs/audits/2026-10-01-triceps-closure.md`. 970 tests / 52 suites pass.
