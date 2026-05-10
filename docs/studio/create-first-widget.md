# Create First Widget

## Outcome

A junior developer should be able to add a small widget without touching shell internals or export plumbing by accident.

## Pick The Right Shape

Use a simple widget folder when the widget is mostly static content:

```txt
apps/studio/src/widgets/<name>/
```

Use a module widget when it has richer inspector logic, export-specific behavior, or likely future growth:

```txt
apps/studio/src/widgets/modules/
```

## Step By Step

1. Copy the template set in:

```txt
apps/studio/src/widgets/modules/_example/
```

2. Rename the example files and remove the `.txt` suffix.

3. Implement a `definition` first.

4. Wire a minimal stage renderer.

5. Add export output through the export registry.

6. Register inspector fields only for the smallest useful editing surface.

7. Add one unit test for pure logic and one visual or parity test when the widget is visually custom.

## Smallest Viable Definition

Use this checklist:

- unique `type`
- human `label`
- `category`
- stable `defaults`
- `inspectorSections`
- `renderLabel`
- `renderStage`

If export is required for release channels, do not merge without `renderExport` or a registry manifest.

## Common Mistakes

- Adding platform-specific seed content inside the shell instead of `templates/library`.
- Growing `export-renderers.ts` instead of registering the widget in the registry.
- Duplicating stage and export style logic when a `view-model` helper should own it.
- Introducing inline styles into shared editor surfaces when a recipe or CSS token already exists.

## First Tests To Add

For a simple widget:

```txt
apps/studio/src/testing/unit/widgets/<widget>.test.ts
apps/studio/src/testing/parity/<widget>.fixture.ts
```

You do not need a huge suite on day one. One good pure test and one good visual/parity contract is better than five shallow tests.
