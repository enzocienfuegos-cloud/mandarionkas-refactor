# core/persistence/

Utilidades de serialización de estado para persistencia — desacopladas del mecanismo
de transporte (autosave, save manual, exportación de versión).

## Archivos

`persistence-snapshot.ts` — dos funciones:

- `createPersistenceSnapshot(state)` → copia limpia del estado sin ruido de UI
  (playhead, hover, preview mode). Es lo que se envía al servidor.
- `createPersistenceSignature(state)` → string JSON del snapshot, usado para
  detección de cambios (dirty check) sin comparación profunda de objetos.

## Qué NO va aquí

- El **trigger** del autosave vive en `persistence/autosave/` (capa de app).
- El **transporte HTTP** vive en `repositories/document/`.
- El **store** que despacha `MARK_DOCUMENT_SAVED` vive en `core/store/`.

Este directorio es puro: sin React, sin efectos, sin llamadas de red.
