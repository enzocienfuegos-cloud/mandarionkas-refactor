# core/store/

Store central del editor — implementado sobre `useSyncExternalStore` sin dependencias
de Redux, Zustand, ni Jotai.

## Archivos clave

| Archivo                     | Responsabilidad                                                        |
|-----------------------------|------------------------------------------------------------------------|
| `studio-store.ts`           | Instancia del store, integra historial undo/redo y action-effects.     |
| `create-store.ts`           | Fábrica genérica `createStore<S, C>` reutilizable.                     |
| `use-studio-store.ts`       | Hook React `useStudioStore(selector)` — única entrada para componentes.|
| `store-utils.ts`            | Utilidades de comparación shallow para evitar re-renders innecesarios. |
| `reducers/`                 | Un archivo por slice: `widget-reducer`, `document-scene-reducer`, etc. |
| `reducers/index.ts`         | `reduceBySlices()` — compone todos los reducers en secuencia.          |
| `selectors/stage-selectors.ts` | Selectores derivados para la vista de canvas.                       |

## Contrato de acceso

Los componentes **nunca** acceden a `studioStore` directamente. Usan:

```ts
const zoom = useStudioStore((s) => s.ui.zoom);
```

Para mutaciones, despachan comandos via el hook de acciones:

```ts
const { dispatch } = useStudioActions();
dispatch({ type: 'SET_ZOOM', zoom: 1.5 });
```

## Agregar un nuevo slice de reducer

1. Crear `reducers/mi-feature-reducer.ts` que exporte `reduceMiFeature(state, command)`.
2. Registrar el reducer en `reducers/index.ts` dentro de `reduceBySlices()`.
3. Si el slice necesita estado inicial, extender `domain/document/factories.ts`.
