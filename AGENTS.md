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

## Regla de Diseño: Opciones Visuales Antes de Implementar
- Antes de implementar cualquier decisión que afecte a la estética de la app (pantallas o ventanas nuevas, opciones o menús nuevos, la interfaz de una feature nueva), presenta al menos 3 opciones distintas en imágenes. El usuario elige una y solo entonces se implementa.
- Las opciones deben diferir en estructura o interacción, no solo en colores o espaciados, y usar los tokens del tema de la app en modo claro.
- Las opciones solo varían la parte nueva. El resto de la pantalla se conserva tal como está en la app (diagramas de split, botones de énfasis con dibujo, tarjetas de elección), capturado de la pantalla real. No se sustituyen controles existentes por texto, filas o pastillas simples.
- Los arreglos de fallos visuales que no cambian el diseño (solapes, recortes, espaciados rotos) no necesitan opciones.

## Regla de Verificación: Device Hub
- Verifica en el simulador con Device Hub (`xcrun mcpbridge`, herramientas `DeviceInteraction*`) cada cambio que afecte a la interfaz o a un flujo, antes de darlo por terminado. Captura la pantalla y la jerarquía antes y después de cada interacción.
- Cierra siempre la sesión de dispositivo al terminar (`DeviceInteractionEndSession`).

## Design collaboration protocol
- Explain the current behavior, the proposed change and its tradeoffs before implementation.
- Present at least three distinct image proposals for aesthetic decisions and wait for the athlete's explicit choice. Approval of one surface is not approval to redesign other controls or menus.
- Record the chosen direction in PRD.md. Bug repairs that restore the existing interaction may proceed without redesign approval.

- Visual proposals must be detailed, app-scale renderings using Vigor product tokens and existing controls. Generic high-level AI image boards do not satisfy design approval. Compare the same screen/content across variants and keep unrelated UI intact.
