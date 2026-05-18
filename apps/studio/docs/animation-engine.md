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

## Cleanup post-migracion (Sprint S51)

Cerrado el residual WAAPI declarado pendiente en `animation-engine-followups.md`:

- `widgets/modules/scratch-reveal.renderer.tsx`: `runScratchRevealRevealAnimation` migrado de `Element.animate(...)` a `gsap.fromTo(...)` con `immediateRender: true` equivalente a `fill: 'backwards'`.
- `motion/react/use-motion-preview.ts`: hook del `MotionTemplateGallery` migrado a GSAP con scrub via `timeline.seek(...)`.
- `motion/react/use-compositor-motion.ts`: eliminado como dead code sin consumidores.
- `widgets/modules/drag-token-pool.renderer.tsx` y `widgets/modules/drop-zone.renderer.tsx`: drag del template BocaDeli/WC 2026 refactorizado para sacar React state del hot path, mover el ghost con `transform: translate3d(...)`, cachear rects de drop-zones y reemplazar feedback no-compositeable por overlay con `opacity`.

Tras este cleanup, `grep -rn "\\.animate(" apps/studio/src --include="*.ts" --include="*.tsx" | grep -v test | grep -v __generated__` no debe devolver resultados en codigo de produccion.

## Preview fluidity architecture (Sprint S52)

Despues del cleanup WAAPI -> GSAP, el siguiente problema de fluidez del editor
quedo en como el playhead se propagaba a traves de React. La solucion:

Principio rector: React es para estructura, DOM es para playback.

- React re-renderiza solo en cambios estructurales: mount/unmount de widgets,
  seleccion, hover, zoom, cambio de escena y edicion.
- El playhead durante playback no atraviesa el arbol React del Stage.
- Componentes que necesitan reaccionar al playhead leen
  `playbackEngine.subscribeDom(...)` o `usePlayheadRef()` y aplican cambios
  directo al DOM o a subtrees puntuales.
- `usePlaybackMsThrottled()` sigue reservado para timeline UI e inspectors.
- `usePlaybackMsLive()` queda prohibido en codigo productivo por
  `npm run lint:playback-live -w @smx/studio`.

APIs nuevas:

- `canvas/stage/playhead-ref-context.tsx`
  - `PlayheadRefProvider`
  - `usePlayheadRef()`
- `shared/hooks/use-latest-ref.ts`
  - helper para handlers y effects estables sin resuscribir por valores calientes

Hot path actual:

- `useStageController` ya no consume `usePlaybackMsLive()`.
- `selectStageDocument(...)` y `selectStageUi(...)` separan datos frios del
  document y estado transient de UI.
- `StageSurface` ya no recibe `playheadMs` como prop y sincroniza playback via
  `subscribeDom(...)`, aplicando visibilidad, frame y opacity al DOM de cada
  widget por `data-stage-widget-id`.
- `StageWidget` ya no fuerza rerenders playback-reactive por tipo; el contexto
  de render usa un getter de `playheadMs` apoyado en `usePlayheadRef()`.
