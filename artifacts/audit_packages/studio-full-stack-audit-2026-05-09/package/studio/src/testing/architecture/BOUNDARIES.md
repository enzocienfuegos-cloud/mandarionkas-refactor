# Architecture Boundaries

This project enforces non-negotiable rules between layers. The goal is to stop regressions before they become new monoliths.

## Global rules

- UI layers (`app`, `canvas`, `inspector`, `timeline`, `widgets`) must not import raw persistence, the platform store singleton, or the low-level studio store singleton.
- Repositories must not import the platform store singleton directly.
- Only approved adapters may touch `fetch`, `localStorage`, or `sessionStorage`.
- `domain/` must stay independent from `app/`, `export/`, `platform/`, and `repositories/`.

## Layer dependency map

These are the allowed cross-layer dependencies enforced by `architecture-guardrails.test.ts`.

- `actions` -> `domain`, `shared`, `types`
- `app` -> `assets`, `canvas`, `core`, `domain`, `export`, `hooks`, `inspector`, `platform`, `repositories`, `shared`, `timeline`, `types`, `widgets`
- `assets` -> `shared`, `types`
- `canvas` -> `actions`, `core`, `domain`, `hooks`, `shared`, `types`, `widgets`
- `core` -> `actions`, `domain`, `shared`, `types`, `widgets`
- `domain` -> `shared`, `types`
- `export` -> `domain`, `shared`, `types`, `widgets`
- `hooks` -> `core`, `domain`, `shared`, `types`
- `inspector` -> `assets`, `core`, `domain`, `export`, `hooks`, `platform`, `repositories`, `shared`, `types`, `widgets`
- `integrations` -> `shared`, `types`
- `persistence` -> `core`, `hooks`, `repositories`, `shared`, `types`
- `platform` -> `app`, `shared`, `types`
- `repositories` -> `assets`, `domain`, `platform`, `shared`, `types`
- `shared` -> `types`
- `timeline` -> `core`, `hooks`, `shared`, `types`, `widgets`
- `types` -> none
- `widgets` -> `canvas`, `domain`, `hooks`, `inspector`, `shared`, `types`

## How to use it

- Run `npm run check:layers` before merging architectural work.
- Run `npm run check` before cutting a release candidate.
- If you need to break a boundary, update the layer rules intentionally first rather than sneaking the import in.
