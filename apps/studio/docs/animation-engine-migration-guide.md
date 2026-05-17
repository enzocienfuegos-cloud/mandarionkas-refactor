# Animation Engine Migration Guide

## Qué migra automáticamente

Al cargar un banner legacy, `normalizeStudioState(...)` hace estas conversiones:

- `motion = { templateId, config }` se convierte a `motion.enter` con `trigger: 'timeline'`.
- `hoverMotion` legacy se normaliza al shape formal actual.
- Managed keyframes creados por motion (`managedBy: "motion:*"`) se eliminan del timeline normalizado.
- El resto de keyframes del usuario se preserva.

## Qué cambia para banners nuevos

- Aplicar un preset nuevo ya no escribe keyframes administrados en `widget.timeline.keyframes`.
- El preset entra por `motion.enter` con `trigger: 'load'` por default.
- Si un banner necesita comportamiento relativo a scratch o escena, el trigger debe elegirse explícitamente.

## Qué conviene revisar manualmente al migrar

- Widgets que antes dependían implícitamente del timeline absoluto pero deberían arrancar al cargar.
- Widgets debajo de scratch groups que ahora usan `trigger: 'reveal'` o `trigger: 'scratch-complete'`.
- Escenas con `exit` motion, para confirmar la ventana antes del swap.
- Widgets con interacciones repetidas (`click`) que dependan de `restart`, `ignore` o `queue`.
- Hover presets en piezas donde el comportamiento anterior se apoyaba en paths inline del editor.

## Casos que siguen siendo legacy-compatible

- Banners que ya vienen guardados con keyframes manuales o motion legacy timeline-based.
- Exports que todavía cargan widgets con `timeline.keyframes` no administrados por motion.

## Casos que requieren intervención manual

- Cuando el banner esperaba autodetección de scratch para el preset. Eso ya no existe: el trigger debe ser explícito.
- Cuando un motion slot viejo necesita separarse en `enter`, `idle` y `exit`.
- Cuando se quiera cambiar semántica de replay de interacciones repetidas.

## Cómo validar una migración

1. Cargar el documento y confirmar que el widget legacy aparece con slots formales.
2. Revisar que no queden keyframes `managedBy: "motion:*"` en el timeline normalizado.
3. Ejecutar preview/editor y export/public preview.
4. Si hay scratch, verificar reveal visual, timing local y ausencia de `display: none` en `data-scratch-mask-target`.
5. Si hay transiciones de escena, verificar `scene-exit` antes del cambio de escena.

## Evidencia automatizada disponible

- Unit: `src/testing/unit/motion/legacy-migration.test.ts`
- Visual: `tests/visual/animation-engine.spec.ts`
- Integration: `src/testing/integration/animation-engine-e2e.test.ts`
