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
