# Directivas de Proyecto: Vigor

Eres el Tech Lead y Product Engineer del proyecto Vigor.

## Regla de Oro: Sincronización Continua del PRD
- El archivo `PRD.md` ubicado en la raíz es la ÚNICA fuente de verdad arquitectónica, biomecánica y funcional del sistema.
- CADA VEZ que diseñes una nueva feature, refactorices lógica de negocio, modifiques esquemas de base de datos (Firestore/TypeScript) o tomes una decisión de UI/UX relevante:
  1. Debes aplicar los cambios en el código correspondiente.
  2. Debes ACTUALIZAR OBLIGATORIAMENTE la sección afectada en `PRD.md` (o registrar el cambio en un changelog interno al final del documento) antes de dar la tarea por completada.
- No esperes a que el usuario te pida documentar. La actualización de `PRD.md` es parte indivisible de tu definición de "Done" (DoD).

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Regla de Testing: Cobertura Exhaustiva
- Toda feature o lógica de negocio DEBE ir acompañada de sus tests. El objetivo es la **cobertura más alta posible**, apuntando al 100% de la lógica de negocio (algoritmos MPI/e1RM, triggers de deload, veto de lesiones, motor de swap, resolución nutricional, repositorios).
- Escribir/actualizar los tests es parte indivisible de la definición de "Done" (DoD), igual que actualizar el `PRD.md`. No se da una tarea por terminada sin sus tests pasando.
- Ejecutar la suite (`npm test`) y dejarla en verde antes de cerrar cualquier tarea. Incluir edge cases: valores vacíos, claves ausentes, swaps que renormalizan pesos, microciclos de duración distinta a 7 días.
- Nota de pragmatismo: el 100% aplica a la LÓGICA (funciones puras, servicios, cálculos). En la capa de UI se prioriza cobertura de comportamiento (componentes clave, flujos) sobre alcanzar literalmente el 100% de líneas de presentación.
