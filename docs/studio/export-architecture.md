# Export Architecture

## North Star

Editor stage, export HTML, and portable project data should describe the same widget semantics.

When those surfaces diverge, we treat it as a bug rather than a normal tradeoff.

## Layers

### 1. Document and widget state

Source of truth:

```txt
apps/studio/src/domain/document/
```

### 2. Stage renderer

Used in the editor canvas:

```txt
apps/studio/src/canvas/stage/
apps/studio/src/widgets/**/**/*.renderer.tsx
```

### 3. Export renderer registry

Primary route for widget HTML export:

```txt
apps/studio/src/widgets/modules/export-registry.ts
apps/studio/src/export/html.ts
```

### 4. Portable export

Structured project representation for downstream tooling:

```txt
apps/studio/src/export/portable.ts
```

## Preferred Pattern

For any widget with non-trivial styling:

1. move derived logic into a pure helper
2. let stage consume it
3. let export consume it
4. lock behavior with parity coverage

That is why the codebase now leans on:

- `view-model`
- `style-recipe`
- export manifests
- parity fixtures

## Legacy Vs Preferred

Avoid expanding:

```txt
apps/studio/src/widgets/modules/export-renderers.ts
```

Prefer:

```txt
apps/studio/src/widgets/<widget>/<widget>.export.ts
apps/studio/src/widgets/modules/<widget>.export.ts
apps/studio/src/widgets/modules/export-registry.ts
```

## Verification Stack

- unit tests for pure helpers
- parity tests for stage/export equivalence
- visual Playwright baselines for product surfaces
- package preflight and readiness checks for release channels
