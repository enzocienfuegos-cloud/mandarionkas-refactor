# AGENTS.md

## Repository expectations

This repo is a monorepo containing the SignalMix Studio platform:

- `apps/studio` - rich-media ad-tech Studio (React/Vite/TypeScript)
- `apps/api` - backend Node.js services
- `packages/contracts` - DTOs shared between frontend and backend
- `packages/db` - PostgreSQL migrations and helpers

## Package manager

Use `npm`. Do not use `pnpm` or `yarn` unless explicitly requested.

## Studio validation commands

Before closing any change that touches `apps/studio`, run:

```bash
npm run lint -w @smx/studio
npm run typecheck -w @smx/studio
npm run test -w @smx/studio
npm run build -w @smx/studio
```

For backend or shared-contract changes:

```bash
npm run check:api
npm run test
npm run typecheck
```

## Engineering rules

### Backwards compatibility

- Preserve backwards compatibility for existing Studio documents and widgets.
- If a schema or shape changes, include a migration path with tests.

### Dependencies

- Do not add production dependencies unless the task explicitly allows it.
- Do not introduce Tailwind, CSS-in-JS, Radix, MUI, Chakra, Zod, AJV, Yup, or similar UI/schema frameworks.
- Prefer existing CSS variables, shared styles, and primitives.

### Type safety

- Do not add `any` in domain, widget registry, export, persistence, or repository boundaries.
- In isolated internal code with documented justification, `any` is acceptable only as a last resort.

### Tests and guardrails

- Do not weaken tests, architecture guardrails, or stylelint rules to make a PR pass.
- If a test fails, fix the root cause.
- The architecture guardrails in `apps/studio/src/testing/architecture/architecture-guardrails.test.ts` are non-negotiable.

### Code style

- Keep PRs small and scoped when possible.
- Avoid global formatting changes.
- If visual output changes intentionally, document why.
- Stage preview and exported output must stay aligned.

### Tenancy and multi-workspace

- Do not embed client-specific seed data in platform code.
- Templates belong in `apps/studio/src/templates/library/<vertical>/`.

### Color and tokens

- Stage colors use CSS variables from `apps/studio/src/shared/theme.css`.
- Export colors use `apps/studio/src/export/export-tokens.ts`.
- Canonical export tokens must stay aligned with `theme.css`.
- Hex literals in `*.tsx` must live in a `*BrandPalette` block or have a `// brand:` annotation.

### Export

- Export is string-pure. Do not move React or hooks into `export/`.
- Keep stage and export contracts aligned through shared inputs and tests.

### Documentation

When in doubt, see:

- `docs/studio/architecture.md`
- `docs/studio/world-class-roadmap.md`
- `docs/studio/ux-redesign/world-class-ux-ui-plan.md`
- `docs/studio/ux-redesign/visual-direction.md`

### Studio UX/UI rules

- Prefer small, reviewable changes in `apps/studio`.
- Any visual change must preserve or improve accessibility.
- Any visual change must update or add visual snapshots.
- Do not add inline styles, `!important`, numeric `z-index`, or raw color literals outside theme token files.
- Prefer fuchsia/violet/cyan as the premium creative accent system.
- Keep `Agency Hub`, `Client Workspace`, `Editor`, `Inspector`, `Timeline`, `Library`, and `Widgets` decoupled.
- Do not introduce new dependencies without explicit justification.

For Studio visual work, also run:

```bash
npm run audit:visual-debt -w @smx/studio
npm run test:visual -w @smx/studio
```
