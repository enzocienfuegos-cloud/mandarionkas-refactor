# Animation Engine Follow-ups

- Reemplazar la allowlist temporal del guardrail de arquitectura por facades/shared contracts reales.
- Resolver cleanup final de `motion-engine.ts` y helpers legacy una vez que `readConfigNumber`/`sanitizeMotionConfig` dejen de ser el puente usado por templates viejos.
- Cerrar la verificación manual del MD con proyecto BocaDeli FIFA WC 2026 y screenshots manuales finales.
- El repo-wide `npx ts-prune -p apps/studio/tsconfig.app.json` sigue teniendo mucho ruido ajeno al refactor; usar `npm run audit:animation-engine-surface -w @smx/studio` como chequeo scoped hasta que exista una limpieza global del paquete.
- [DONE] Drag fluidity del template BocaDeli FIFA WC 2026: `drag-token-pool.renderer.tsx` y `drop-zone.renderer.tsx` refactorizados para sacar React state del hot path del puntero, usar `transform: translate3d(...)` en lugar de `left`/`top`, cachear rects de drop-zones, y reemplazar transitions no-compositeables por feedback de `opacity`.
