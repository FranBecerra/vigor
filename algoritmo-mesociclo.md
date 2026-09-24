# Volumen Estático y Sobrecarga Progresiva en Hipertrofia (Consenso 2024–2026)

## Resumen Ejecutivo

La tendencia predominante durante la década de 2010 fue utilizar mesociclos con incremento progresivo del volumen, añadiendo series semana tras semana hasta alcanzar un pico de fatiga seguido de una descarga.

Sin embargo, la literatura más reciente y las interpretaciones prácticas de investigadores y divulgadores basados en evidencia (Schoenfeld, Pak, Wolf, Minor, entre otros) están desplazando el foco desde la progresión del volumen hacia la progresión del rendimiento.

La idea central es simple:

> La hipertrofia parece responder mejor a aumentos progresivos de tensión mecánica (más carga, más repeticiones, mayor e1RM) que a incrementos continuos de volumen.

El volumen sigue siendo importante, pero actualmente se considera más una variable de calibración entre mesociclos que una variable que deba aumentar sistemáticamente dentro de cada mesociclo.

---

# 1. Volumen Creciente vs Volumen Estático

## Modelo clásico: Volumen Creciente

Ejemplo:

| Semana | Series |
|----------|----------|
| 1 | 10 |
| 2 | 12 |
| 3 | 14 |
| 4 | 16 |
| 5 | Deload |

### Hipótesis

Cada semana se aumenta el estímulo mediante más series.

### Ventajas

- Fácil de programar.
- Garantiza aumento progresivo de estrés.
- Compatible con modelos tradicionales de periodización.

### Problemas

El problema principal es que:

> El volumen genera simultáneamente estímulo y fatiga.

Cuando se añaden series semanalmente:

- aumenta el estímulo,
- pero también aumenta el coste de recuperación.

La evidencia reciente muestra que la relación volumen-hipertrofia presenta retornos decrecientes.

Pasar de:

- 5 → 10 series

produce mucho beneficio.

Pasar de:

- 15 → 20 series

produce muy poco beneficio adicional mientras incrementa significativamente la fatiga.

Por tanto, aumentar volumen cada semana puede desplazar al atleta fuera de su zona óptima de recuperación antes de que exista necesidad real.

---

## Modelo moderno: Volumen Estático

Ejemplo:

| Semana | Series |
|----------|----------|
| 1 | 12 |
| 2 | 12 |
| 3 | 12 |
| 4 | 12 |
| 5 | 12 |
| 6 | Deload |

La progresión ocurre mediante:

- más carga,
- más repeticiones,
- mayor e1RM,
- menor RIR con misma carga.

### Ventajas

- Fatiga más predecible.
- Mejor control de recuperación.
- Más fácil identificar si el volumen es insuficiente o excesivo.
- Mejor alineado con la evidencia sobre tensión mecánica.

### Principio operativo

El volumen debe ser:

> El mínimo volumen capaz de seguir produciendo adaptación.

No el máximo volumen tolerable.

---

# 2. Concepto de MEAV

Tradicionalmente se hablaba de:

- MEV (Minimum Effective Volume)
- MAV (Maximum Adaptive Volume)
- MRV (Maximum Recoverable Volume)

En una aplicación automatizada resulta más útil trabajar con:

## MEAV

**Minimum Effective Adaptive Volume**

Definición:

> La menor cantidad de series que sigue generando progreso medible.

Porque:

- el coste de añadir volumen es elevado,
- los beneficios marginales son pequeños,
- la recuperación es un recurso limitado.

El objetivo del algoritmo es encontrar y mantener el MEAV individual.

---

# 3. Arquitectura del Mesociclo

## Duración variable

No se define:

```text
4 semanas + deload
```

Se define:

```text
Acumulación → Deload cuando sea necesario
```

La duración real depende de:

- progreso,
- recuperación,
- fatiga acumulada.

### Duraciones típicas

| Perfil | Duración |
|----------|----------|
| Baja tolerancia a fatiga | 4 semanas |
| Promedio | 5-6 semanas |
| Alta capacidad de recuperación | 7-8 semanas |

No existe una duración fija universal.

---

# 4. Variables Monitorizadas

La aplicación debe registrar semanalmente:

## Rendimiento

Mediante e1RM de ejercicios clave.

Ejemplos:

- Sentadilla
- Press banca
- Peso muerto
- Dominadas lastradas
- Press militar

Clasificación:

```text
UP
FLAT
DOWN
```

---

## Recuperación subjetiva

Promedio semanal de:

- calidad del sueño,
- energía,
- motivación,
- sensación de recuperación.

Escala:

```text
1-10
```

Genera:

```text
Recovery Score
```

---

## Fatiga

Indicadores:

- RPE superior al esperado,
- RIR inferior al esperado,
- pérdida de repeticiones,
- necesidad de reducir carga,
- molestias articulares crecientes.

Genera:

```text
Fatigue Score
```

---

# 5. Algoritmo Semanal

## Continuar el mesociclo

Si:

```text
e1RM ↑ o estable
AND
Recovery Score ≥ 7
AND
Fatigue baja
```

Entonces:

```text
Continue Mesocycle
```

---

## Zona gris

Si:

```text
e1RM estable
AND
Recovery Score entre 5 y 7
AND
Fatiga moderada
```

Entonces:

```text
Continue and Reevaluate Next Week
```

No se descarga todavía.

Una semana plana no implica necesariamente estancamiento.

---

## Finalizar mesociclo

Si durante dos semanas consecutivas:

```text
e1RM no mejora
```

y además:

```text
Recovery Score < 5
```

o

```text
Fatigue alta
```

Entonces:

```text
End Mesocycle
```

---

# 6. Deload

Una vez terminado el mesociclo:

```text
Volume = 50% habitual
Load = 85-90% habitual
RIR = +3/+4
Duration = 5-7 days
```

Objetivo:

- disipar fatiga,
- mantener adaptaciones,
- preparar el siguiente bloque.

---

# 7. Finalización Manual

La aplicación debe permitir:

```text
Finish Mesocycle
```

en cualquier momento.

Motivos posibles:

- vacaciones,
- enfermedad,
- lesión,
- hospitalización,
- cambios laborales,
- falta de tiempo.

Estado:

```text
Mesocycle Outcome = Interrupted
```

Los datos obtenidos siguen utilizándose para recalcular el siguiente bloque.

No se descartan.

---

# 8. Reglas para Diseñar el Siguiente Mesociclo

El volumen nunca se modifica dentro del mesociclo.

Únicamente se recalcula al inicio del siguiente.

---

## Aumentar volumen

Condiciones:

```text
e1RM ↑ de forma consistente
AND
Recovery Score ≥ 8
AND
Fatigue baja
AND
Mesocycle completado sin necesidad de descarga temprana
```

Acción:

```text
Volume +5-10%
```

Ejemplos:

```text
10 → 11
12 → 13
14 → 15
```

Incrementos pequeños.

---

## Mantener volumen

Condiciones:

```text
e1RM ↑
AND
Fatiga moderada
```

o

```text
e1RM ↑ ligeramente
AND
Recuperación aceptable
```

Acción:

```text
Volume = Igual
```

Esta debería ser la decisión más frecuente.

Probablemente entre el 60 y el 80% de los casos.

---

## Reducir volumen

Condiciones:

```text
e1RM plano o ↓
AND
Recovery Score < 5
```

o

```text
Necesidad recurrente de descarga temprana
(<4 semanas)
```

o

```text
Fatigue Score alto
durante gran parte del bloque
```

Acción:

```text
Volume -10% a -20%
```

---

# 9. Pseudocódigo de Alto Nivel

```python
while mesocycle_active:

    update_e1RM()
    update_recovery_score()
    update_fatigue_score()

    if (
        e1RM_trend in ["UP", "FLAT"]
        and recovery_score >= 7
        and fatigue_score == "LOW"
    ):
        continue_mesocycle()

    elif (
        e1RM_trend == "FLAT"
        and recovery_score >= 5
        and fatigue_score == "MODERATE"
    ):
        continue_mesocycle()
        reevaluate_next_week()

    elif (
        no_e1RM_improvement_for_2_weeks
        and (
            recovery_score < 5
            or fatigue_score == "HIGH"
        )
    ):
        end_mesocycle()
```

---

# 10. Conclusión

La interpretación más sólida del consenso práctico 2024-2026 es:

1. La sobrecarga progresiva debe producirse principalmente mediante mejoras de rendimiento (carga, repeticiones o e1RM).
2. El volumen no necesita aumentar sistemáticamente dentro del mesociclo.
3. El volumen debe permanecer estable mientras exista progreso.
4. La duración del mesociclo debe depender del estado del atleta, no del calendario.
5. El volumen debe ajustarse únicamente entre mesociclos.
6. El objetivo óptimo no es alcanzar el máximo volumen recuperable (MRV), sino encontrar el menor volumen que siga produciendo adaptación (MEAV).

En términos de software, esto implica un sistema de autorregulación donde el rendimiento dirige la progresión y el volumen actúa como una variable de ajuste lenta entre bloques, no como el principal mecanismo de sobrecarga.