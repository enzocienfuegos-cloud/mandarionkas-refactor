# core/

Núcleo del editor — contiene la maquinaria que no depende de React ni de la UI.

## Subdirectorios

| Directorio    | Responsabilidad                                                                 |
|---------------|---------------------------------------------------------------------------------|
| `commands/`   | Tipo discriminado `StudioCommand` — define todas las intenciones del usuario.   |
| `history/`    | `HistoryManager<T>` — pila undo/redo desacoplada de cualquier framework.        |
| `persistence/`| Utilidades de snapshot: serialización de estado para persistencia en servidor.  |
| `store/`      | `studioStore` — store central (custom `useSyncExternalStore`), reducers por slice, selectors. |

## Reglas de dependencia

- `core/` **nunca** importa de `app/`, `canvas/`, `inspector/`, `timeline/`, ni de React directamente.
- `core/store/` puede importar de `core/commands/`, `core/history/`, `core/persistence/`, y `domain/`.
- Los componentes React acceden al store exclusivamente a través de `core/store/use-studio-store.ts`.

## Extensión

Para agregar un nuevo tipo de comando: editar `core/commands/types.ts` y agregar el caso al reducer correspondiente en `core/store/reducers/`.
