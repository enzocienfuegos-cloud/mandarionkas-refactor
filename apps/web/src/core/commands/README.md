# core/commands/

Define el tipo discriminado `StudioCommand` — el contrato exhaustivo de todas las
intenciones del usuario que pueden mutar el estado del editor.

## Archivo principal

`types.ts` — union type de todos los comandos. Cada comando es un objeto `{ type: string; ...payload }`.

## Convención

- Nombre en SCREAMING_SNAKE_CASE: `UPDATE_WIDGET_FRAME`, `SELECT_SCENE`, etc.
- Los comandos son **intenciones**, no efectos. Un comando `DELETE_SELECTED_WIDGETS` no
  sabe si hay algo seleccionado — eso lo resuelve el reducer.
- Los comandos de solo UI (zoom, playhead, hover) se excluyen del historial undo/redo en
  `core/store/studio-store.ts` → `shouldRecordHistory()`.

## Agregar un comando nuevo

1. Agregar el caso al union type en `types.ts`.
2. Manejar el caso en el reducer de slice correspondiente en `core/store/reducers/`.
3. Si tiene efectos secundarios (navegación, analytics), registrarlo en `actions/action-effects.ts`.
