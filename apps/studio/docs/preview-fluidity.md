# Preview Fluidity

## Principio

React es para estructura. DOM y GSAP son para playback.

El Stage de Studio ya no debe re-renderizar por cada tick del playhead. El clock
live vive en `playbackEngine`, en `subscribeDom(...)`, y en `usePlayheadRef()`.

## Como funciona

1. `playbackEngine.setCurrentMs(ms)` actualiza el playhead global.
2. Los subscribers DOM-side reaccionan al tick sin pasar por `useState` del Stage.
3. `StageSurface` aplica visibilidad, frame y opacity a widgets ya montados.
4. Los widgets que necesitan tiempo live se suscriben de forma localizada, en vez
   de invalidar el arbol entero del editor.

## APIs a usar

- `usePlayheadRef()`
  - para handlers, effects y logica que necesita el playhead actual sin
    causar re-render
- `playbackEngine.subscribeDom(callback)`
  - para mutaciones DOM o syncs de playback
- `usePlaybackMsThrottled()`
  - solo para timeline UI, inspectors y herramientas no criticas a 60fps

## Anti-patterns prohibidos

- usar `usePlaybackMsLive()` en codigo de produccion
- pasar `playheadMs` como prop a `StageSurface`
- usar `useEffect([ctx, ...])` en renderers que se montan dentro del Stage
- depender de `ctx.playheadMs` para invalidar el Stage entero

## Checklist para widgets que necesitan playback

1. si el widget puede vivir por DOM sync, usar `subscribeDom(...)`
2. si necesita un subtree React propio, aislar su suscripcion dentro del widget
3. no resuscribirse por `ctx` completo ni por callbacks inline
4. usar `useLatestRef()` para leer valores actuales desde effects estables

## Debug de stutter

- React DevTools Profiler:
  - el Stage no deberia commitear continuamente durante playback
- Chrome Performance:
  - buscar long tasks > 50ms
  - revisar scripting por frame
  - verificar que la mayoria del trabajo quede en compositor, no en reconciliation

## Pending migrations

- `widgets/video/*`
  - sigue fuera del alcance de este sprint, salvo regresion puntual
  - si algun renderer de video vuelve a depender de `ctx.playheadMs` o `ctx` en
    deps de effects, migrarlo con las mismas reglas DOM-side del resto del stage

## Editor Fluidity (S53)

- `useStudioStoreRef()` ya no es reactivo por debajo; ahora usa `studioStore.subscribe(...)`
  y sirve de verdad como ref viva para handlers/effects.
- `useStudioStoreSnapshot()` reemplaza los `useStudioStore((s) => s)` que solo
  necesitaban leer el state del render actual.
- `useWidgetPlayheadMs` se elimino del codigo productivo.
- Los widgets que antes se suscribian al playhead live desde React ahora usan
  `usePlaybackMsThrottled()` o `playbackEngine.getCurrentMs()` segun el caso.
- Durante playback, el store deja de recibir `SET_PLAYHEAD` periodico; el clock
  vive en `playbackEngine` y el store se sincroniza al pausar, al terminar escena
  o al cambiar de escena.

## Editor Fluidity (S54): Playhead-Coupled Snapshots

S53 saco las suscripciones amplias de identidad y el playback live-reactive del
stage, pero todavia quedaban dos patrones que hacian stutter en el editor:

- snapshots compartidos con `playheadMs` adentro
- `useStudioStore(...)` que retornaban objetos literales sin `shallowEqual`

### Snapshots compartidos con playhead

El top bar y parte del inspector armaban snapshots compuestos con `shallowEqual`
pero incluyendo `playheadMs`. Eso parecia seguro, pero igual acoplaba esos
consumidores al ciclo de playback y los hacia commitear cada 250ms.

S54 introduce `selectDocumentStructuralSnapshot`, que modela exactamente la
parte estructural del documento/editor y deja el playhead afuera. Cuando un
consumidor realmente necesita tiempo, lo lee aparte con
`usePlaybackMsThrottled(...)`.

### Object selectors sin shallowEqual

Left rail, timeline, canvas variant strip y algunos panels retornaban objetos
literales sin segundo argumento. Con el `Object.is` default eso implica un
objeto nuevo por selector run, asi que el componente se invalida con cualquier
dispatch aunque la data real no haya cambiado.

S54 normaliza esos casos a:

- selector estrecho
- `shallowEqual`
- derivaciones como `reverse()` o mappings fuera del selector, via `useMemo`

### Guardrails nuevos

- `lint:broad-store` ahora tambien detecta object selectors sin `shallowEqual`
- el mismo lint detecta snapshots con `playheadMs` dentro de bloques con
  `shallowEqual`
- tests unitarios cubren ambos patrones para evitar regresiones

## Browser compositor optimization (Sprint S55)

S52-S54 cerraron la arquitectura React. Aun asi el editor no se sentia "Final Cut
smooth" porque habia patrones de CSS y DOM mutation que forzaban layout/paint del
browser por frame.

### Regla 1: nunca animar left/top/width/height

`left`, `top`, `width` y `height` causan layout reflow del browser. Solo se anima
`transform` y `opacity`.

Donde antes habia `element.style.left = ...` por frame, ahora hay
`element.style.transform = translate3d(...)`.

Donde antes habia CSS con `left: var(--x); will-change: left`, ahora hay
`transform: translate3d(var(--x), 0, 0); will-change: transform`.

### Regla 2: contain en cada elemento animable

Cada `.stage-widget`, `.timeline-playhead` y `.playhead-overlay` usa
`contain: layout paint`. Esto aísla rendering y evita que cambios dentro del
stage o timeline invaliden el resto del editor.

### Regla 3: will-change: transform en hot paths

Cada elemento que se anima durante playback usa `will-change: transform` para
promover una layer GPU dedicada.

### Regla 4: transitions solo sobre transform y opacity

Transitions sobre `background-color`, `border-color`, `box-shadow` o `filter`
fuerzan paint por frame. En el hot path del stage y timeline se limitaron a
`transform` y `opacity`.

### Lints nuevos

`lint:layout-thrashing` detecta:
- `element.style.left/top = ...` dentro de archivos con `subscribeDom`
- CSS con `will-change: left/top/width/height`
- transitions no compositeables en los archivos calientes de stage/timeline

## Stop fighting GSAP (Sprint S56)

S52-S55 cerraron React, snapshots, compositor y CSS caliente. El editor seguia
por debajo del target porque todavia habia dos patrones caros:

- `engine.seekScene(ms)` se disparaba en cada frame del playback automatico
- `usePlaybackMsVisual` seguia re-renderizando React a 60Hz en `group` y
  `scratch-reveal`

### Regla: `seekScene` solo en eventos discretos

`engine.seekScene(ms)` se usa exclusivamente para:

- scrub manual de timeline
- pausa / rewind
- cambio de escena
- sincronizacion inicial al entrar a playback

Durante playback automatico el stage ya no hace `seekScene` por frame. En su
lugar usa `engine.syncScenePlayhead(ms)`, que solo actualiza el playhead interno
del engine sin tocar timelines.

### Regla: distinguir tick vs scrub

`playbackEngine.setCurrentMs(ms, source)` ahora acepta:

- `'tick'` para el rAF del runtime controller
- `'scrub'` para drag/click manual del playhead
- `'seek'` para rewinds, resets y cambios programaticos

Los subscribers de `subscribeDom` reciben el `source` como segundo argumento.

### `usePlaybackMsVisual` queda deprecado

`usePlaybackMsVisual` era funcionalmente playback live-reactive a 60Hz.

Reemplazos:
- `usePlaybackDerivedValue` para valores derivados discretos
- `playbackEngine.getCurrentMs()` dentro de handlers
- `playbackEngine.subscribeDom(...)` + mutacion DOM cuando hace falta sync visual

`scratch-reveal` y `group` ya no dependen de ese hook.

### Loop del StageSurface optimizado

`StageSurface` ahora:

- pre-computa parent chains por cambio estructural
- identifica widgets timeline-reactive vs widgets estaticos
- skipea widgets estaticos despues de su frame inicial aplicado

Eso baja el trabajo del loop en escenas donde la mayoria de widgets no tienen
keyframes ni ventanas de visibilidad especiales.

## The MotionLayer JSON.stringify trap (Sprint S58)

El re-analisis fino del trace de Chrome mostro que el cuello mas caro ya no
estaba en GSAP ni en el scratch, sino en `MotionLayer.tsx`:

```tsx
const motionSignature = useMemo(() => JSON.stringify(plans), [plans]);
```

`MotionLayer` se monta por widget y por scratch cover child. Eso hacia que
`JSON.stringify(plans)` corriera miles de veces durante playback y re-render,
pagando walk completo del grafo + encode interno de strings en V8.

La correccion fue reemplazar ese hash caro por `buildMotionSignature(plans)`,
una firma corta basada solo en campos estables:

- `plan.id`
- `plan.trigger`
- `plan.durationMs`
- `plan.delayMs`
- `plan.iterations`

Con eso el effect que monta GSAP sigue re-montando cuando cambia la lista de
planes, pero sin el costo explosivo de `JSON.stringify(...)`.

### Regla

- Nunca usar `JSON.stringify(...)` dentro de `useMemo`, `useCallback` o render
  para producir firmas reactivas.
- En hot paths de React usar firmas cortas basadas en IDs/campos estables.
- `lint:json-stringify` bloquea nuevas regresiones de este patron.

## Scratch masks cross-browser after S57

S57 elimino el `toDataURL(...)` sincronico del hot path, pero dejo un path
Safari-only via `document.getCSSCanvasContext` y `-webkit-canvas(...)`.

En S58 el scratch queda cross-browser otra vez:

- editor/runtime image scratch: canvas DOM normal, visible, mutado in-place
- scratch group con cover DOM: mascara estandar via `mask-image: url(blob:...)`
  generada desde canvas con `toBlob(...)`

Eso mantiene el cover real del scratch group, evita `-webkit-canvas(...)`, y
preserva la regla principal:

- nunca volver a `canvas.toDataURL(...)` en hot paths interactivos
