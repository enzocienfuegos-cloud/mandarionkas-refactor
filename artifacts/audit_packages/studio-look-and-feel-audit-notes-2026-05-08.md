# Studio Look & Feel Audit Notes — 2026-05-08

## Objetivo

Este paquete está preparado para auditar el look and feel completo de `apps/studio`, con foco en:

- tokens y semántica visual
- estilos compartidos
- primitives UI
- shell/layout del editor
- consistencia de iconografía, thumbnails y affordances
- detección de hardcodes visuales residuales

No es sólo un dump del source: intenta separar claramente qué deuda visual ya quedó cerrada y qué literales siguen existiendo por diseño, por runtime o por export/rendering específico.

## Scope incluido en el ZIP

- `apps/studio/` completo
- `package-lock.json`
- `artifacts/studio_front_audit_2026-05-07.md`
- `STUDIO-CODEX-IMPLEMENTATION-PLAN-2026-05-08.md`
- `STUDIO-UX-AUDIT-2026-05-08.md`
- `CODEX-DELIVERABLE-AUDIT-2026-05-08.md`
- `STUDIO-CODEX-S13-CLOSEOUT-PLAN-2026-05-08.md`
- este documento

## Resumen ejecutivo

La base visual compartida de Studio quedó fuertemente sistematizada:

- `src/shared/styles` ya no tiene literales directos `hex` o `rgba`
- `src/shared/styles` ya no tiene `z-index` numéricos
- la shell principal, timeline, stage, inspector, topbar, asset library y left rail consumen tokens/aliases desde `src/shared/theme.css`
- existe una capa de primitives compartidas en `src/shared/ui`
- los affordances principales migraron a `Tooltip`, `Toast`, icon system y thumbnails declarativos
- el `Widget Library` ya no depende de placeholders genéricos para los widgets cubiertos por S13
- el bundle inicial quedó más liviano y `video-core` ya no se descarga eager en el entry principal

Al mismo tiempo, el source total de Studio todavía contiene hardcodes visuales y `style={{...}}` fuera de la capa compartida. Eso no está oculto: quedó concentrado sobre todo en renderers de widgets, previews SVG, defaults de definiciones y rutas de export/runtime específicas.

## Qué quedó implementado

### 1. Design tokens y semántica visual

Archivo central:

- `apps/studio/src/shared/theme.css`

Estado:

- se amplió la capa de tokens base y tokens semánticos
- se consolidaron overlays, surfaces, focus states, dividers, shadows y gradientes reutilizables
- se agregaron aliases locales para `z-index`
- se evitó depender de literales directos en la capa de estilos compartidos

Resultado práctico:

- la mayoría del look and feel del editor ya no está “pegado” a componentes puntuales
- el cambio de tono visual del producto pasa por el theme y no por CSS de dominio suelto

### 2. Split de estilos compartidos

Directorio:

- `apps/studio/src/shared/styles/`

Estado:

- `layout.css` quedó como shim
- la capa se separó por dominios (`shell`, `timeline`, `stage`, `inspector`, `asset-library`, `left-rail`, `topbar`, `components`, `utilities`)
- `stylelint` quedó endurecido para evitar regresiones

Resultado práctico:

- la UI del editor usa una base compartida auditable
- los cambios de estilo del shell ya no viven en archivos monolíticos con deuda acumulada

### 3. Primitives UI

Componentes nuevos o consolidados:

- `Button.tsx`
- `IconButton.tsx`
- `Tabs.tsx`
- `Tile.tsx`
- `SegmentedControl.tsx`
- `Tooltip.tsx`
- `ToastProvider.tsx`
- `icons.tsx`

Resultado práctico:

- se redujo la repetición de botones y affordances
- los tooltips/toasts pasaron a un sistema compartido
- el topbar, el shell y el inspector consumen piezas más consistentes

### 4. Shell y layout

Áreas principales tocadas:

- `src/app/shell/*`
- `src/platform/*`
- `src/inspector/*`
- `src/timeline/*`
- `src/canvas/stage/*`

Mejoras relevantes:

- persistencia del layout del shell
- rail izquierdo e inspector derecho resizables
- topbar rearmado en tres zonas
- stage con wireframe mode persistido
- story flow canvas
- layers outline funcional
- inspector de documento registry-driven

### 5. Capabilities, registry y desacople

Archivos clave:

- `src/widgets/registry/widget-definition.ts`
- `src/widgets/modules/module-definition-factory.ts`
- `src/inspector/document-inspector-registry.ts`
- `src/inspector/register-document-inspector.tsx`

Estado:

- varias whitelists de `widget.type` en UI/state migraron a capabilities
- el document inspector ya no depende tanto de condicionales hardcodeados
- se agregaron capabilities para contenedores, analytics, variantes y galerías

Resultado práctico:

- agregar widgets nuevos requiere menos tocar consumidores de UI
- baja el riesgo de reglas visuales duplicadas o divergentes

### 6. Iconografía y thumbnails

Archivos clave:

- `src/shared/ui/icons.tsx`
- `src/widgets/registry/widget-thumbnails.tsx`

Estado:

- shell, toolbar, stage e inspector usan icon system unificado
- S13 completó el backfill de thumbnails faltantes en la widget library

Resultado práctico:

- mejor escaneabilidad del catálogo
- menos placeholders ambiguos

### 7. Bundle y carga diferida

Archivos clave:

- `src/widgets/video/VideoWidgetRenderer.tsx`
- `src/platform/services.ts`
- `vite.config.ts`

Estado:

- `video-core` quedó lazy-loaded
- desapareció el warning de import mixto de `workspace-service`
- el chunk inicial bajó fuerte frente a estados anteriores

Resultado práctico:

- proyectos que no usan video no pagan eager el costo de `video.js`

## Evidencia automática para auditar hardcodes

Comandos corridos sobre `apps/studio`:

```bash
cd /Users/enzocienfuegos/Documents/MandaRion/apps/studio

printf 'shared styles hex/rgba: '
rg -o "#[0-9A-Fa-f]{3,8}|rgba?\\(" src/shared/styles | wc -l

printf 'all src hex/rgba: '
rg -o "#[0-9A-Fa-f]{3,8}|rgba?\\(" src | wc -l

printf 'shared styles numeric z-index: '
rg -n "z-index:\\s*[0-9]" src/shared/styles | wc -l

printf 'all src style={{ count: '
rg -n "style=\\{\\{" src | wc -l

printf 'ui/state widget.type whitelists: '
rg -n "widget\\.type\\s*(===|!==)\\s*'" src \
  | grep -vE "test|\\.definition\\.ts|export/|widget-registry|module-definition-factory|world-cup-starter|export-validation" \
  | wc -l
```

Resultado observado:

- `shared styles hex/rgba: 0`
- `all src hex/rgba: 1474`
- `shared styles numeric z-index: 0`
- `all src style={{ count: 481`
- `ui/state widget.type whitelists: 0`

## Cómo interpretar esos números

### Lo que sí quedó limpio

- la capa compartida de estilos del editor
- la semántica de `z-index` en estilos compartidos
- las whitelists residuales de `widget.type` en UI/state

### Lo que todavía NO está en cero

#### `all src hex/rgba: 1474`

Eso incluye varias categorías distintas:

1. `src/shared/theme.css`
   - contiene los literales fuente del sistema de tokens
   - esto es esperado, no es deuda

2. `src/widgets/registry/widget-thumbnails.tsx`
   - thumbnails SVG declarativos
   - usan color literal porque son previews visuales autocontenidos

3. `src/widgets/**/*.definition.ts`
   - defaults visuales de widgets
   - parte de esto es intencional: un widget necesita arrancar con un aspecto inicial

4. `src/widgets/**/*renderer*.tsx`
   - renderers ricos con estilos runtime, previews y overlays
   - acá sigue existiendo deuda visual real si la meta fuera “cero literales en todo Studio”

5. `src/export/*`
   - pipeline de export/render portable
   - está fuera de la capa de shell/look-and-feel del editor, pero sí forma parte del source del producto

#### `all src style={{ count: 481`

Tampoco significa automáticamente deuda mala. Hay varias clases:

- posicionamiento y geometría runtime del stage/timeline
- renderers de widgets con visuales declarativas inline
- previews de inspector
- SVG/layout interno de módulos interactivos
- integraciones de video y overlays

Si el objetivo del audit es “no quiero inline styles salvo runtime dinámico”, este número todavía merece una pasada adicional fuera del scope principal del roadmap ya cerrado.

## Hotspots actuales para auditar manualmente

### Literales de color más concentrados

Top archivos por ocurrencias `hex/rgba`:

1. `src/shared/theme.css` — esperado, fuente del token system
2. `src/widgets/registry/widget-thumbnails.tsx` — esperado, previews SVG
3. `src/widgets/modules/export-renderers.ts` — export/runtime
4. `src/widgets/modules/dynamic-map.renderer.tsx`
5. `src/widgets/modules/tiktok-video.renderer.tsx`
6. `src/widgets/modules/four-faces.inspector.tsx`
7. `src/widgets/modules/four-faces.renderer.tsx`
8. `src/inspector/sections/document/VideoAnalyticsSection.tsx`
9. `src/widgets/modules/vertical-accordion.renderer.tsx`
10. `src/widgets/modules/teads-layout1.renderer.tsx`

### Inline styles más concentrados

Top archivos por cantidad de `style={{...}}`:

1. `src/widgets/modules/dynamic-map.renderer.tsx`
2. `src/widgets/modules/tiktok-video.renderer.tsx`
3. `src/widgets/modules/meta-carousel.renderer.tsx`
4. `src/widgets/modules/four-faces.renderer.tsx`
5. `src/widgets/modules/speed-test.renderer.tsx`
6. `src/widgets/modules/vertical-accordion.renderer.tsx`
7. `src/widgets/modules/teads-layout1.renderer.tsx`
8. `src/widgets/modules/interactive-video.renderer.tsx`
9. `src/widgets/modules/dynamic-map.inspector.tsx`
10. `src/widgets/modules/teads-layout2.renderer.tsx`

## Lectura honesta del estado actual

Si la auditoría se limita a “editor shell / design system / look and feel compartido”, la base quedó muy bien cerrada.

Si la auditoría exige “cero hardcodes visuales en todo `apps/studio`, incluyendo renderers de widgets, exporters, thumbnails y defaults”, eso todavía no está completamente en cero. El paquete está pensado justamente para que puedas revisar esa segunda capa con precisión, no para esconderla.

## Validación técnica corrida

Se dejó validado:

```bash
npm run lint:css -w @smx/studio
npm run typecheck -w @smx/studio
npm run test -w @smx/studio
npm run build -w @smx/studio
```

Estado observado al cierre:

- `lint:css` OK
- `typecheck` OK
- `test` OK
- `build` OK
- build sin warnings
- main chunk alrededor de `195.74 KB`
- `video-core` separado en chunk diferido

## Qué revisar manualmente en la auditoría

### Checklist principal

1. Revisar `src/shared/theme.css` como source of truth de color, motion, radius, shadows y z-index.
2. Revisar `src/shared/styles/*` para confirmar que la shell del editor depende de tokens y no de literales.
3. Revisar `src/shared/ui/*` para confirmar que primitives comunes no reintroducen affordances ad hoc.
4. Revisar `src/app/shell/*`, `src/inspector/*`, `src/timeline/*` y `src/canvas/stage/*` para validar coherencia visual del editor.
5. Revisar `src/widgets/registry/widget-thumbnails.tsx` y `src/shared/ui/icons.tsx` como layer de reconocimiento visual.
6. Revisar hotspots de renderers si el estándar de auditoría exige llevar más runtime styling a helpers o tokens.

### Si querés auditar “hardcode cero” de manera agresiva

Empezar por:

- `src/widgets/modules/dynamic-map.renderer.tsx`
- `src/widgets/modules/tiktok-video.renderer.tsx`
- `src/widgets/modules/four-faces.renderer.tsx`
- `src/widgets/modules/speed-test.renderer.tsx`
- `src/widgets/modules/vertical-accordion.renderer.tsx`
- `src/widgets/modules/teads-layout1.renderer.tsx`
- `src/widgets/modules/teads-layout2.renderer.tsx`
- `src/widgets/modules/interactive-video.renderer.tsx`
- `src/widgets/modules/shoppable-sidebar.renderer.tsx`

## Conclusión

La refactorización ya dejó la experiencia principal de Studio en una base de design system real y bastante auditable. La parte que queda más “hardcodeada” está hoy concentrada, localizada y visible sobre todo en renderers de widgets y previews específicas, no dispersa por todo el shell del editor como al inicio del roadmap.
