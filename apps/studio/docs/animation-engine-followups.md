# Animation Engine Follow-ups

- Reemplazar la allowlist temporal del guardrail de arquitectura por facades/shared contracts reales.
- Resolver cleanup final de `motion-engine.ts` y helpers legacy una vez que `readConfigNumber`/`sanitizeMotionConfig` dejen de ser el puente usado por templates viejos.
- Cerrar la verificación manual del MD con proyecto BocaDeli FIFA WC 2026 y screenshots manuales finales.
- El repo-wide `npx ts-prune -p apps/studio/tsconfig.app.json` sigue teniendo mucho ruido ajeno al refactor; usar `npm run audit:animation-engine-surface -w @smx/studio` como chequeo scoped hasta que exista una limpieza global del paquete.
- [DONE] Drag fluidity del template BocaDeli FIFA WC 2026: `drag-token-pool.renderer.tsx` y `drop-zone.renderer.tsx` refactorizados para sacar React state del hot path del puntero, usar `transform: translate3d(...)` en lugar de `left`/`top`, cachear rects de drop-zones, y reemplazar transitions no-compositeables por feedback de `opacity`.
- [DONE S52] `StageSurface` ya no depende de `playheadMs` en su arbol React; el playback se aplica via `subscribeDom(...)`.
- [DONE S52] `usePlaybackMsLive` queda bloqueado en codigo productivo por `lint:playback-live`.
- [DONE S52] `selectStageState` se separo en `selectStageDocument` y `selectStageUi`.
- [DONE S52] `RenderContext` y `StageWidget` quedaron estabilizados para no invalidarse por frame.
- [DONE S52] `drop-zone` y `timer-bar` ya no se resuscriben por `ctx` caliente.
- [DONE S53] `useStudioStoreRef` ya no re-renderiza consumidores; el path de scene/stage actions usa ref no-reactivo real.
- [DONE S53] `useWidgetPlayheadMs` fue removido de codigo productivo y queda cubierto por `lint:playback-live`.
- [DONE S53] `lint:broad-store` bloquea nuevas suscripciones de identidad al store de Studio.
