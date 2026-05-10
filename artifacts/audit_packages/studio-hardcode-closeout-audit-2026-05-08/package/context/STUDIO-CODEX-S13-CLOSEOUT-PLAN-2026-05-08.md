# SMX Studio — Plan de cierre absoluto (S13)

> **Audiencia:** Codex actuando como senior frontend en `apps/studio`.
> **Contexto:** S1–S11 completados, S12 closeout cerró las 3 deudas críticas y los 6 hallazgos secundarios del audit. Quedan 5 polish items NO bloqueantes que el último audit dejó como "observaciones residuales". Este sprint los cierra todos.
> **Estimado total:** **3-4 horas** de trabajo. Un sprint corto, un solo PR.
> **Modo de trabajo:** un PR por todo S13. Tras cada ticket: tests OK. Antes de mergear: validación visual manual.

---

## 0. Reglas (mismas que sprints anteriores)

1. No tocar contratos del dominio salvo extensiones additivas explícitas en este plan.
2. Backwards compat absoluto. Tests `architecture/*` y `smoke/*` deben pasar idénticos.
3. Sin nuevas dependencias UI runtime (lucide y los primitivos propios alcanzan).
4. **Cero regresión en stylelint.** Si `lint:css` falla, parar y arreglar antes de continuar.
5. Cada ticket trae su acceptance check.

---

## 1. Roadmap (orden recomendado)

```
S13-T1  [60-90min]  Migrar 8 whitelists widget.type residuales en UI a capabilities
S13-T2  [60-75min]  Backfill thumbnails de los 22 widgets faltantes
S13-T3  [30-45min]  Lazy-load condicional de video-core
S13-T4  [15min]     Endurecer stylelint: tokenizar z-index 0/1/2
S13-T5  [30min]     Validación visual manual + checklist
```

---

## S13-T1 — Whitelists `widget.type` residuales en UI → capabilities

### Contexto

El audit S12 dejó residuales en 4 archivos de UI/runtime. El plan original declaró export como "zona protegida" — esos NO se tocan. Pero estos sí son UI/state y deben usar capabilities para mantener el principio "agregar widget = solo tocar `*.definition.ts`".

### Inventario exacto

| Archivo | Línea | Whitelist actual | Acción |
|---|---|---|---|
| `src/app/shell/left-rail/LayersSection.tsx` | 41 | `item.widget.type === 'group' && item.children.length > 0` | Migrar a capability |
| `src/timeline/timeline-utils.ts` | 58 | `widget.type === 'group'` | Migrar a capability |
| `src/core/store/reducers/widgets/widget-structure-reducer.ts` | 39 | `getSelectedWidgets(state).filter((widget) => widget.type === 'group')` | Migrar a capability |
| `src/inspector/sections/document/VideoAnalyticsSection.tsx` | 242 | `widget.type === 'interactive-video'` | Migrar a capability |
| `src/inspector/sections/VariantsSection.tsx` | 23 | `widget.type === 'text' \|\| widget.type === 'cta'` | Migrar a capability |
| `src/widgets/modules/gallery-assets-inspector.tsx` | 143 | `widget.type === 'image-carousel'` | Migrar a capability (o ignorar si solo aplica a este módulo) |
| `src/app/shell/topbar/world-cup-starter.ts` | 528 | `widget.type === 'drop-zone'` | **NO MIGRAR** — es lookup específico del seed del World Cup, no UI generalizada |
| `src/domain/document/export-validation.ts` | 24 | `widget.type === 'cta'` | **NO MIGRAR** — zona export, plan declarada protegida |

**Total a migrar:** 6 ubicaciones reales de UI/state.

### Acción

1. **Extender `WidgetCapabilities`** en `src/widgets/registry/widget-definition.ts`:

```ts
export type WidgetCapabilities = {
  acceptsImageAsset?: boolean;
  acceptsVideoAsset?: boolean;
  acceptsFontAsset?: boolean;
  acceptsAssetSwap?: boolean;
  hasFill?: boolean;
  hasAccentColor?: boolean;
  isMedia?: boolean;
  isInteractive?: boolean;
  exposesActions?: boolean;
  // === nuevas en S13 ===
  isContainer?: boolean;          // agrupa otros widgets (group, ...)
  hasVideoAnalytics?: boolean;    // contribuye a video analytics (interactive-video, video-hero opcional)
  hasTextVariant?: boolean;       // variants modifica `text`
  hasTitleVariant?: boolean;      // variants modifica `title`
  isAssetGallery?: boolean;       // image-carousel, interactive-gallery, shoppable-sidebar (si aplica)
};
```

2. **Backfill capabilities** en los `*.definition.ts` afectados:

```ts
// src/widgets/group/group.definition.ts
capabilities: { isContainer: true, ... },

// src/widgets/text/text.definition.ts
capabilities: { hasTextVariant: true, hasFill: true, ... },

// src/widgets/cta/cta.definition.ts
capabilities: { hasTextVariant: true, exposesActions: true, ... },

// otros widgets sin hasTextVariant tienen hasTitleVariant: true por defecto.
// Para minimizar el cambio, en VariantsSection:
//   const editsText = getCapability(def, 'hasTextVariant');
//   editsText ? { text: ev.target.value } : { title: ev.target.value }

// src/widgets/modules/definitions/interactive-video.definition.ts
capabilities: { acceptsVideoAsset: true, hasVideoAnalytics: true, ... },

// src/widgets/modules/definitions/image-carousel.definition.ts
capabilities: { acceptsImageAsset: true, isAssetGallery: true, ... },
// Idem para interactive-gallery, shoppable-sidebar si aplica.
```

3. **Reemplazar los call sites:**

```diff
// LayersSection.tsx:41
- const isGroup = item.widget.type === 'group' && item.children.length > 0;
+ const definition = getWidgetDefinition(item.widget.type);
+ const isGroup = Boolean(getCapability(definition, 'isContainer')) && item.children.length > 0;

// timeline-utils.ts:58
- const isGroup = widget.type === 'group';
+ const isGroup = Boolean(getCapability(getWidgetDefinition(widget.type), 'isContainer'));

// widget-structure-reducer.ts:39
- const selectedGroups = getSelectedWidgets(state).filter((widget) => widget.type === 'group');
+ const selectedGroups = getSelectedWidgets(state).filter(
+   (widget) => getCapability(getWidgetDefinition(widget.type), 'isContainer'),
+ );

// VideoAnalyticsSection.tsx:242
- .filter((widget) => widget.type === 'interactive-video')
+ .filter((widget) => getCapability(getWidgetDefinition(widget.type), 'hasVideoAnalytics'))

// VariantsSection.tsx:23
- widget.type === 'text' || widget.type === 'cta' ? { text: ... } : { title: ... }
+ getCapability(getWidgetDefinition(widget.type), 'hasTextVariant')
+   ? { text: event.target.value }
+   : { title: event.target.value }

// gallery-assets-inspector.tsx:143
- {widget.type === 'image-carousel' ? (
+ {getCapability(getWidgetDefinition(widget.type), 'isAssetGallery') ? (
```

### Acceptance check

```bash
# Cero whitelists de UI/state restantes (excepto export/world-cup-starter)
grep -rnE "widget\.type\s*===\s*'" src/ \
  | grep -vE "test|\.definition\.ts|export/|widget-registry|module-definition-factory|world-cup-starter|export-validation"
# → 0 matches
```

Tests deben pasar idénticos. El reducer de widget-structure es el más sensible — verificar que `groupSelected` / `ungroupSelected` siguen funcionando.

---

## S13-T2 — Backfill thumbnails para 22 widgets faltantes

### Contexto

Sprint 7 entregó 11 thumbnails (top-list). Quedan 22 widgets usando `PlaceholderThumb`. Funciona, pero un usuario rich media merece poder identificar visualmente cada módulo.

### Inventario faltante (verificado vía grep)

**Top-level (3):**
- `badge` · `group` · `shape`

**Modules (19):**
- `add-to-calendar` · `buttons` · `countdown` · `drag-token-pool` · `drop-zone` · `form` · `four-faces` · `gen-ai-image` · `interactive-gallery` · `interactive-hotspot` · `interactive-video` · `particle-halo` · `qr-code` · `range-slider` · `scratch-reveal` · `shoppable-sidebar` · `slider` · `speed-test` · `step-indicator` · `tiktok-video` · `timer-bar` · `travel-deal` · `vertical-accordion` · `weather-conditions`

### Acción

1. **Crear thumbnails en `src/widgets/registry/widget-thumbnails.tsx`** siguiendo el patrón existente (`ThumbFrame` de 160×100 SVG, palette por categoría).

   No hay que ser detallado — son **iconográficos**, no fotorrealistas. Cada thumb debe sugerir el módulo en 3-4 elementos SVG. Patrones recomendados:

   | Widget | Idea visual mínima |
   |---|---|
   | `badge` | rect pequeño con check / star / texto pill |
   | `group` | dos rects superpuestos con outline grueso |
   | `shape` | círculo + cuadrado + triángulo apilados |
   | `countdown` | dos rects con `:` digital + dígitos |
   | `qr-code` | grid 6×6 con módulos cuadrados aleatorios pero estables (semilla fija) |
   | `form` | 3 input lines + botón debajo |
   | `buttons` | 2-3 pills horizontales |
   | `step-indicator` | 3 círculos conectados con línea, primero filled |
   | `slider` | track horizontal + thumb circular |
   | `range-slider` | track + 2 thumbs |
   | `timer-bar` | rect outline + fill parcial |
   | `interactive-video` | rect con play triangle grande |
   | `tiktok-video` | rect 9:16 con play triangle + heart icon esquina |
   | `four-faces` | 4 rects con dot bajo el activo |
   | `vertical-accordion` | 4 rows horizontales, una expandida |
   | `interactive-gallery` | grid 2×2 de rects |
   | `interactive-hotspot` | rect background + círculo pulsante con `+` |
   | `drop-zone` | rect dashed con flecha down |
   | `drag-token-pool` | 3 chips redondeadas en línea |
   | `scratch-reveal` | rect con patrón rayado parcial |
   | `shoppable-sidebar` | rect grande izq + columna derecha de mini-cards |
   | `gen-ai-image` | rect con sparkles ✨ + frame |
   | `add-to-calendar` | mini-calendario con día destacado |
   | `weather-conditions` | sol + nube |
   | `particle-halo` | círculo central + puntos alrededor |
   | `speed-test` | gauge semicircular con aguja |
   | `travel-deal` | avión iconográfico + price tag |

2. **Wire en cada `*.definition.ts`:**

```ts
import { CountdownThumb } from '../../registry/widget-thumbnails';
// ...
export const CountdownDefinition = createModuleDefinition({
  // ...
  thumbnail: () => <CountdownThumb />,
  // ...
});
```

3. **Reglas para mantener consistencia:**
   - Mismo `ThumbFrame` viewBox 160×100 con `rx="18"` y palette por categoría.
   - Stroke uniforme (`strokeWidth="1.5"` o `2"`).
   - Sin texto literal en SVG (los thumbs no llevan label, el card lo pone aparte).
   - Solo 2-4 colores por thumb. Usar la palette del `PlaceholderThumb` original como guía:
     - content: bg `#1f2937`, accent `#f59e0b`
     - media: bg `#0f172a`, accent `#38bdf8`
     - interactive: bg `#172033`, accent `#22c55e`
     - layout: bg `#241b34`, accent `#a78bfa`

### Acceptance check

```bash
# Cada definition tiene thumbnail
for f in src/widgets/*/[a-z]*.definition.ts src/widgets/modules/definitions/*.definition.ts; do
  grep -L "thumbnail" "$f"
done
# → 0 archivos listados
```

Visual: abrir Widget Library, todos los thumbnails se ven coherentes y reconocibles.

---

## S13-T3 — Lazy-load condicional de `video-core`

### Contexto

Bundle splitting de S12 dejó `video-core` aislado en 566 KB. Está fuera del main bundle (bien), pero todo proyecto que NO use video lo descarga igual cuando entra al editor (porque `video.js` se importa eager desde algún widget renderer).

### Diagnóstico previo

Codex debe correr primero:

```bash
# Identificar qué archivos importan video.js eagerly
grep -rnE "from ['\"]video\.js" src/ | head -20
```

Esperado: archivos como `interactive-video.renderer.tsx`, `video-hero.renderer.tsx`. Estos cargan el chunk en boot del editor incluso si la escena no tiene videos.

### Acción

**Opción A — `React.lazy` + `Suspense`** (recomendada, menor blast radius):

1. Convertir los renderers de video a lazy:

```tsx
// src/widgets/video-hero/VideoHeroPlayer.lazy.tsx (nuevo archivo)
import { lazy } from 'react';
export const LazyVideoHeroPlayer = lazy(() => import('./VideoHeroPlayer'));
```

2. En el renderer:

```tsx
// video-hero.renderer.tsx
import { Suspense } from 'react';
import { LazyVideoHeroPlayer } from './VideoHeroPlayer.lazy';

export function renderVideoHeroStage(node, ctx) {
  return (
    <Suspense fallback={<div className="widget-video-loading">Loading video…</div>}>
      <LazyVideoHeroPlayer node={node} ctx={ctx} />
    </Suspense>
  );
}
```

3. Idem para `interactive-video`. Cualquier otro consumidor directo de `video.js`.

**Opción B — Dynamic import en demand** (si hay constraints de Suspense con el stage actual):

Crear un hook `useVideoJs()` que hace `import()` la primera vez que se monta un widget de video, y memoiza la promesa.

### Acceptance check

1. Build:
```bash
pnpm build -w @smx/studio
```

2. Verificar que `video-core` ya NO aparece en el waterfall inicial al abrir un proyecto sin video. Abrir el editor con un proyecto solo de imágenes/text/cta y verificar en Network tab que `video-core-*.js` NO se descarga.

3. Abrir un proyecto con `video-hero` o `interactive-video`: el chunk se carga on-demand. Loader fallback aparece brevemente. Reproducción funciona normal.

4. Tests:
```bash
pnpm test -w @smx/studio
# 213/213 passing
```

### Si el ticket es problemático

Lazy-loading + Suspense puede romper SSR-like contracts del stage o tests que esperan render sincrónico. Si Codex encuentra fricción >1 hora, **parar y reportar.** No es deuda crítica — es optimización. Mover a backlog.

---

## S13-T4 — Endurecer stylelint: tokenizar z-index 0/1/2

### Contexto

S12 dejó `'0', '1', '2'` en `ignoreValues` del stylelint config como compromiso pragmático. Funciona, pero deja una rendija conceptual. Cerrar ortodoxamente es trivial.

### Inventario actual

```
src/shared/styles/timeline.css:226  z-index: 2;
src/shared/styles/timeline.css:437  z-index: 1;
src/shared/styles/timeline.css:464  z-index: 2;
src/shared/styles/inspector.css:183 z-index: 1;
src/shared/styles/stage.css:53      z-index: 1;
src/shared/styles/stage.css:68      z-index: 1;
src/shared/styles/stage.css:282     z-index: 0;
src/shared/styles/stage.css:295     z-index: 0;
```

8 ocurrencias, todos apilamiento local.

### Acción

1. **Añadir tokens locales** en `theme.css` (debajo de la escala canónica):

```css
/* Local stacking — para componentes con apilamiento interno trivial.
   NO usar para nada que dependa del shell global. */
--z-local-base: 0;
--z-local-1: 1;
--z-local-2: 2;
```

2. **Reemplazar las 8 ocurrencias** por `var(--z-local-*)`.

3. **Quitar `'0', '1', '2'` del `ignoreValues`** de `.stylelintrc.cjs`:

```diff
ignoreValues: [
  'inherit', 'transparent', 'currentColor', 'none',
- '0', '1', '2',
  '100%', 'auto', 'initial', 'unset',
],
```

### Acceptance check

```bash
# Lint debe seguir pasando
pnpm lint:css -w @smx/studio
# → 0 errors

# Cero z-index numéricos
grep -rE "z-index:\s*[0-9]" src/shared/styles/ | grep -v "var(--z-"
# → 0 matches
```

---

## S13-T5 — Validación visual manual

### Contexto

Codex declaró honestamente en su nota: *"I did not perform a final manual browser smoke pass in this last turn."*

Es la única deuda real que queda. NO se puede validar por código.

### Checklist obligatorio (~30 min con un proyecto Bocadeli o Lay's existente)

#### Shell + persistencia
- [ ] Abrir el editor. TopBar muestra 3 zonas: izquierda (back+project+dirty dot), centro (scene switcher + canvas pill + breadcrumb), derecha (Preview, Export, Share, Publish, Save, status).
- [ ] Resize del LeftRail funciona (rango 200-520 px). Soltar y refrescar la página → mantiene el ancho.
- [ ] Resize del Inspector funciona (rango 280-520 px). Persiste tras refresh.
- [ ] Resize de la Timeline funciona (rango 160-520 px). Persiste tras refresh.
- [ ] Colapsar cada panel desde el chevron + reabrir desde la pestaña colapsada. Estado persiste.

#### Canvas + edit-mode
- [ ] Drag de un widget desde la Widget Library al canvas → suelta y queda posicionado.
- [ ] Selección con marquee de varios widgets → toolbar de selección aparece, mueve, duplica, borra.
- [ ] Atajo `W` → toggle wireframe. En wireframe: cada widget muestra solo label + dimensiones, NO el contenido renderizado. Los videos NO cargan en wireframe (verificar Network tab).
- [ ] Atajo `W` de nuevo → vuelve a render normal. Estado persiste tras refresh.
- [ ] Selección de un widget single → StageSelectionToolbar flotante con SVG icons (no glyphs).

#### Inspector + Tabs
- [ ] Sin selección: inspector muestra Tabs Overview/Data/Collab. Navegación con flechas izq/der funciona. `aria-selected` en DevTools accessibility tree.
- [ ] Selección de widget single: tabs Basics/Behavior/Data. Cambiar tab carga sus paneles.
- [ ] PositionSection muestra X, Y, W, H, Opacity, Rotation. Toggle "Lock aspect ratio" → cambiar W también ajusta H proporcional.

#### Timeline
- [ ] Play/Pause con icon (no glyph). Snap toggle, zoom in/out, duración editable.
- [ ] Drag de widget bar para mover. Trim bordes para ajustar entrada/salida. Snap funciona.

#### Layers (left rail)
- [ ] Tab Layers muestra outline jerárquico de scenes → widgets → grupos.
- [ ] Click en layer → selecciona en canvas.
- [ ] Drag-to-reorder funciona.
- [ ] Toggle visibility / lock por layer.
- [ ] ArrowLeft/Right colapsa/expande grupos.

#### Story Flow
- [ ] Tab Story Flow tiene SegmentedControl `list` / `canvas`.
- [ ] Modo `canvas`: nodos arrastrables, edges bezier dibujados, drag persiste posición.
- [ ] Doble-click en node → selecciona scene activa.

#### Widget Library (left rail)
- [ ] Cada widget tiene thumbnail (después de S13-T2). Sin placeholders genéricos.
- [ ] Search filter funciona. Category chips filtran.
- [ ] Drag desde card al canvas funciona.

#### Save / Export / Toasts
- [ ] Save → toast "Saved" verde aparece, dismiss manual con icon-button funciona, auto-dismiss tras ~4s.
- [ ] Export ZIP → toast informativo. ZIP descargado abre y tiene la estructura esperada.
- [ ] Share, Publish: toasts correspondientes.
- [ ] Forzar error (network offline antes de Save) → toast danger.

#### Tooltips
- [ ] Hover sobre IconButton de la stage toolbar → tooltip aparece tras delay.
- [ ] Tab del IconButton → tooltip aparece al focus.
- [ ] Inspeccionar el accessibility tree del IconButton → `aria-describedby` apunta al tooltip.

#### Export funcional
- [ ] Tomar un proyecto existente (idealmente uno ya exportado pre-refactor).
- [ ] Exportar ZIP. Desempaquetar.
- [ ] Comparar `index.html` y archivos JS contra un export pre-refactor del mismo proyecto. Diff aceptable solo en:
  - Asset paths si se cambiaron URLs.
  - Whitespace/comments.
  - Nada de cambios funcionales en el runtime del banner.

#### Performance
- [ ] DevTools Network al cargar un proyecto sin video: `video-core-*.js` NO descargado (después de S13-T3).
- [ ] DevTools Network al cargar un proyecto con video-hero: `video-core-*.js` descargado on-demand.
- [ ] Tiempo desde click "Open project" hasta canvas interactivo: medir con un cronómetro. Comparar contra pre-refactor si tienes baseline.

### Documentar

Cualquier hallazgo durante la validación → ticket aparte. NO arreglarlo en este PR si toca código fuera del scope de S13.

---

## Anexo A — Validación pre-merge

Ejecutar en orden:

```bash
pnpm lint:css -w @smx/studio    # 0 errores
pnpm typecheck -w @smx/studio   # 0 errores
pnpm test -w @smx/studio        # 213/213 (o 213+ si S13-T1 agrega tests)
pnpm build -w @smx/studio       # OK, sin warnings de chunks
```

Todos verde → proceder a S13-T5 (manual). S13-T5 OK → mergear.

---

## Anexo B — Métricas objetivo al final de S13

| Métrica | Estado tras S12 | **Objetivo S13** |
|---|---|---|
| Whitelists `widget.type` en UI/state | 6 residuales | **0** (excluyendo export + world-cup-starter) |
| Widgets con thumbnail propio | 11 / 33 | **33 / 33** |
| Lazy-load video-core | No | **Sí** (Suspense o dynamic import) |
| `z-index` literales en CSS | 8 (con ignore stylelint) | **0** (con strict stylelint) |
| Validación visual manual | No realizada | **Hecha + checklist firmado** |
| Tests | 213/213 | **213+/213+** |
| Main bundle size | ~196 KB | **~196 KB** (no regresión) |

---

## Anexo C — Lo que NO se hace en S13

Reservado para sprints posteriores si surge:

- Migrar las whitelists residuales de `export/portable.ts`, `channel-compliance.ts`, `mraid-compatibility.ts`. **Zona protegida** — el plan original lo declaró así.
- Crear UIPlayground / Storybook ad-hoc.
- Migrar hash routing a React Router.
- Internacionalización (i18n).
- Cambios en autosave / persistencia / repos.
- Cambios en exporters runtime de los banners.

---

## Anexo D — Checklist final del PR

```markdown
## S13 — Closeout absoluto

### Tickets cerrados
- [ ] S13-T1 Whitelists widget.type → capabilities (6 sites migrados)
- [ ] S13-T2 22 thumbnails de widgets backfilled
- [ ] S13-T3 Lazy-load video-core con Suspense
- [ ] S13-T4 z-index 0/1/2 tokenizados, stylelint sin ignoreValues numéricos
- [ ] S13-T5 Validación visual manual completada (checklist adjunto)

### Validación automatizada
- [ ] `pnpm lint:css` OK
- [ ] `pnpm typecheck` OK
- [ ] `pnpm test` 213+/213+
- [ ] `pnpm build` sin warnings

### Métricas
- [ ] Whitelists UI: 0
- [ ] Thumbnails: 33/33
- [ ] z-index literals: 0
- [ ] video-core lazy: confirmado en Network tab
- [ ] Bundle size: ≤ 200 KB main chunk
```

---

**Fin del plan. S13 cierra el último 2-3% del refactor de Studio. Después de mergear, el editor está formalmente al nivel Celtra/CreativeStudio en su capa de presentación, blindado contra regresión, y con la base preparada para la siguiente ronda de features (módulos de banner nuevos, interactividad avanzada, etc.).**
