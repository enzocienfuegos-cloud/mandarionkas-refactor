# Studio Architecture

## Scope

Studio is a product surface composed of:

- `apps/studio` for the authoring application
- `apps/api` for auth, workspaces, projects, and assets
- `packages/contracts` for shared DTOs
- `packages/db` for persistence and migrations

## Layer map

```txt
shared/                  <- UI primitives, no domain knowledge
  ^
domain/                  <- Types and pure business logic
  ^
core/                    <- Store, reducers, history
  ^
widgets/ inspector/      <- Definitions and editing surfaces
canvas/ timeline/        <- Stage orchestration and sequencing UI
export/                  <- Compilers and adapters (no React)
  ^
app/ platform/           <- Shell, workflows, integrations
repositories/            <- Transport adapters
```

## Stage and export flow

```txt
                  WidgetNode
        (props/style/theme/document/channel)
                       |
                       v
            +------------------------+
            |  Module View Model     |
            |  pure, no React/DOM    |
            +-----------+------------+
                        |
             +----------+-----------+
             |                      |
             v                      v
     +---------------+      +----------------+
     | Stage Renderer|      | Export Renderer|
     | React runtime |      | string HTML    |
     +-------+-------+      +--------+-------+
             |                       |
             +-----------+-----------+
                         v
              +----------------------+
              | Parity tests and QA  |
              +----------------------+
```

## Import rules

- `domain/` must not import from `export/`, `app/`, `platform/`, or `repositories/`.
- `widgets/` must not import from shell-only product layers unless explicitly justified.
- `export/` must stay React-free and hook-free.
- `repositories/` must not import UI or store singletons directly.
- UI must reach repository behavior through hooks and actions, not direct singleton access.

## Active guardrails

The architecture suite currently enforces:

1. UI layers stay off raw repositories, raw persistence, and store singletons.
2. Repositories stay off platform store singletons.
3. Raw browser storage access stays inside approved adapters.
4. Raw `fetch()` stays inside approved network adapters.
5. Interactive editor controls avoid raw `title=` attributes.
6. Declared layer boundaries remain respected across source imports.

See [apps/studio/src/testing/architecture/architecture-guardrails.test.ts](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/testing/architecture/architecture-guardrails.test.ts) for the executable contract.
