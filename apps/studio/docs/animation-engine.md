# Animation Engine

## Objetivo

Studio ahora usa un único `AnimationEngine` basado en GSAP para editor preview, client preview y public/export runtime. El refactor elimina la dependencia de presets que escribían managed keyframes al timeline absoluto para animaciones nuevas y mueve los disparos a un bus real de eventos consumido por editor y runtime.

## Modelo final

`WidgetMotion` quedó normalizado en tres slots opcionales:

- `enter`: animaciones de entrada. Los presets nuevos se aplican con `trigger: 'load'` por default.
- `idle`: loops persistentes como `float` y `pulse`.
- `exit`: salidas como `fade-out`, incluidas las disparadas por `scene-exit`.

Cada slot expone:

- `templateId`
- `config`
- `trigger`
- `replayPolicy`

Triggers soportados por el engine:

- `timeline`
- `load`
- `scene-enter`
- `scene-exit`
- `reveal`
- `scratch-complete`
- `click`
- `hover-enter`
- `hover-exit`

Replay policies soportadas:

- `restart`
- `ignore`
- `queue`

## Flujo

El editor y el runtime comparten las mismas piezas de planeación y clocks:

- `motion/animation-engine/plan.ts` deriva `AnimationPlan[]` para el editor.
- `export/runtime/plan-runtime.ts` replica la derivación para widgets exportados.
- `motion/animation-engine/clock.ts` distingue clocks absolutos de escena y clocks locales a evento.
- `motion/animation-engine/gsap-engine.ts` y `export/runtime/runtime-engine.ts` ejecutan timelines GSAP con la misma semántica de replay.

Eventos reales ya consumidos por el engine:

- `load` y `scene-enter` al montar o entrar a escena
- `scene-exit` coordinado antes de cambiar escena
- `reveal` y `scratch-complete` desde scratch runtime
- `click`, `hover-enter` y `hover-exit` desde editor/runtime

## Estado del timeline

- Los presets nuevos ya no inyectan managed keyframes en `widget.timeline.keyframes`.
- Los banners legacy con managed keyframes siguen siendo soportados por el path de normalización/migración.
- El scrubbing del editor ya no resetea interacciones implícitamente; el reset quedó explícito en el toolbar.

## Verificación automatizada

Cobertura agregada o reforzada en esta migración:

- Unit: engine, derivación de planes, replay policy, legacy migration, scene transitions, stage motion y clocks.
- Integration/JSDOM: boot del bundle compilado y paridad básica de scene-exit.
- Playwright visual: `tests/visual/animation-engine.spec.ts` con 10 escenarios mínimos y snapshots a `+0ms`, `+200ms` y `+700ms`.

Los snapshots aprobados viven en:

- `tests/visual/animation-engine.spec.ts-snapshots/`

## Verificación manual

La verificación manual pedida por el MD todavía no quedó cerrada dentro de este workspace. Los visual baselines y tests automatizados ya existen, pero sigue pendiente reproducir manualmente el caso BocaDeli/WC 2026 y documentar screenshots manuales del flujo final.

## Bundle baseline

- Baseline histórico tipo “BocaDeli 320x480” no está disponible como fixture versionado en este workspace.
- Runtime bundle compilado actual (`src/export/__generated__/runtime.iife.js`): `134550` bytes raw, `42624` bytes gzip.
- Wrapper TypeScript comiteado (`src/export/runtime-bundle.generated.ts`): `137614` bytes raw.
- `compileRuntime(...)` ya bootstrapea el runtime desde `runtime-bundle.generated.ts`.
