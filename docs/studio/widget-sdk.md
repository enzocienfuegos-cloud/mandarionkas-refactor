# Widget SDK

## Purpose

Studio widgets are contract-driven. A widget is not just a React component; it is a small product surface with four responsibilities:

1. `definition`
   Describes defaults, capabilities, inspector tabs, and labels.
2. `stage renderer`
   Renders the widget inside the editor canvas.
3. `export renderer`
   Produces the HTML/runtime representation for packaged exports.
4. `portable/export metadata`
   Optionally adds structured data for downstream exporters, parity, or compliance.

The current SDK direction is intentionally biased toward:

- discoverable registration
- small files with explicit ownership
- stage/export parity by default
- pure helpers before UI coupling

## Where Things Live

### Simple widgets

Use the leaf widget folders under:

```txt
apps/studio/src/widgets/<widget-name>/
```

Typical files:

```txt
text.definition.ts
text.renderer.tsx
text.export.ts
```

### Rich modules

Use:

```txt
apps/studio/src/widgets/modules/
```

Typical files:

```txt
definitions/<widget>.definition.ts
<widget>.renderer.tsx
<widget>.export.ts
<widget>.view-model.ts
<widget>.style-recipe.ts
<widget>.inspector.tsx
```

Not every module needs every file on day one, but new work should prefer this split over monolithic renderers.

## Core Contracts

### Widget definition

Definitions are typed with `WidgetDefinition` in:

```txt
apps/studio/src/widgets/registry/widget-definition.ts
```

Minimum useful contract:

```ts
{
  type,
  label,
  category,
  defaults,
  inspectorSections,
  renderLabel,
  renderStage,
}
```

### Export registry

Export renderers are routed through:

```txt
apps/studio/src/widgets/modules/export-registry.ts
```

New widgets should prefer manifest-style export registration instead of growing legacy switch files.

### Module factory

For module-style widgets, prefer:

```txt
apps/studio/src/widgets/modules/module-definition-factory.ts
```

That factory already normalizes:

- default inspector tabs
- baseline capabilities
- portable export defaults
- fallback export renderer behavior

## Recommended Build Order

1. Start with the `definition`.
2. Get a minimal `renderStage` working.
3. Add export output through the export registry.
4. Add inspector fields only after stage/export behavior is stable.
5. Add parity coverage when the widget has custom visual logic.

## Guardrails

- Keep widget-specific business rules out of shell controllers.
- Prefer pure `view-model` helpers when stage and export derive the same visual state.
- If a widget needs runtime networking, declare that capability in the definition.
- If a widget behaves differently in MRAID or strict ad hosts, declare compatibility explicitly.
- Avoid reintroducing giant renderer files. Split early when a widget starts growing.

## Commands That Matter

Run these before shipping widget work:

```bash
npm run test -w @smx/studio
npm run build -w @smx/studio
npm run audit:visual-debt -w @smx/studio
npm run test:visual -w @smx/studio
```
