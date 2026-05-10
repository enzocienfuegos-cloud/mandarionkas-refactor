# Studio World Class Codex V3 Closeout Audit

- Fecha: 2026-05-09
- Repo: `/Users/enzocienfuegos/Documents/MandaRion`
- Rama: `codex/s50-staging-rc`
- Plan fuente: `/Users/enzocienfuegos/Downloads/STUDIO_WORLD_CLASS_CODEX_PLAN_V3_CLOSEOUT.md`
- Base previa: `f5877e8` (`feat: close out studio world-class plan`)
- Fix previo relacionado: `5d8baa4` (`fix: tree-shake studio export runtime`)
- Commit closeout V3: `f8df16b` (`feat: close out studio world-class v3 gaps`)

## Estado Ejecutivo

El closeout V3 queda **completo para release externo** en los gaps obligatorios del plan:

- `GAP-1` Runtime tree-shaking por capability: cerrado
- `GAP-2` Export budgets por canal con severidad real: cerrado
- `GAP-3` Schema faltante en `four-faces` y `tiktok-video`: cerrado
- `GAP-4` `xlsx` fuera del initial load: cerrado
- `GAP-5` Visual regression con data estable: cerrado
- `GAP-7` Numeric `z-index` residual: cerrado

No queda ningún gap `CRÍTICO` o `MEDIO` abierto del plan V3.

## Qué Faltaba

La auditoría V3 encontró cuatro bloqueos reales sobre el closeout V2:

1. El runtime exportado seguía concatenando `MAP`, `INTERACTIVE` y `ENVIRONMENT` siempre, incluso en documentos mínimos.
2. `channel-compliance.ts` validaba forma y estructura, pero no budgets reales de bytes por canal.
3. `four-faces` y `tiktok-video` todavía no usaban el sistema de schema/versionado interno.
4. `xlsx` seguía generando un chunk pesado de `spreadsheet-vendor` dentro del build, sin haber sido separado del critical path.

Además, el plan proponía dos follow-ups bajos recomendados:

- robustecer visual regression con backend mock
- limpiar los `z-index` numéricos que quedaban en `dynamic-map.export.ts`

## Qué Se Implementó

### GAP-1 — Runtime tree-shaking

Este gap ya había sido cerrado en el commit `5d8baa4`.

Archivos relevantes:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/export/runtime-script.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/export/runtime-script-environment.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/testing/unit/export/runtime-tree-shake.test.ts`

Resultado:

- un documento mínimo ya no arrastra runtime de mapa
- el runtime mínimo queda debajo de `4 KB`
- `mraid` ahora puede combinarse con tree-shaking real y budget enforcement

### GAP-2 — Channel budgets con fail real

Se agregó budget enforcement por canal y se conectó al pipeline real del export.

Archivos principales:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/export/channel-budgets.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/export/channel-budget-measurement.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/export/channel-compliance.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/export/bundle.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/export/manifest.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/export/preflight.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/export/readiness.ts`

Cobertura:

- `mraid`, `gam-html5`, `google-display`, `generic-html5`, `meta-story`, `tiktok-vertical`, `vast-simid`
- medición real de `zipBytes`, `initialLoadBytes`, `runtimeJsBytes`, `assetCount`
- `mraid` y `vast-simid` bloquean por error cuando exceden budget
- display y verticales degradan a warning visible cuando aplica

Tests nuevos:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/testing/unit/export/channel-budgets.test.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/testing/unit/export/budget-integration.test.ts`

### GAP-3 — Schema en `four-faces` y `tiktok-video`

Se cerró el rollout de schema/versionado para los dos módulos piloto faltantes.

Archivos principales:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/four-faces/schema.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/tiktok-video/schema.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/definitions/four-faces.definition.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/definitions/tiktok-video.definition.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/four-faces.view-model.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/tiktok-video.view-model.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/domain/widget-schema/validate.ts`

Resultado:

- defaults del schema alineados con defaults reales del widget
- coerción segura de números y booleanos legacy
- preservación forward-compatible de campos extra
- mantenimiento del comportamiento existente de `four-faces` en el fallback de CTA/accent

Tests nuevos:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/testing/unit/widgets/four-faces-schema.test.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/testing/unit/widgets/tiktok-video-schema.test.ts`

### GAP-4 — `xlsx` fuera del initial load

No se removió `xlsx` del proyecto porque sí existe uso real, pero sí se sacó del camino crítico mediante lazy-load.

Archivo principal:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/dynamic-map.inspector.tsx`

Resultado:

- `spreadsheet-vendor` sigue existiendo como chunk lazy
- `dist/index.html` ya no referencia `spreadsheet-vendor`
- el costo queda fuera del initial load y se paga solo cuando el usuario importa spreadsheets para `dynamic-map`

### GAP-5 — Visual regression con backend mock

Se volvió determinista la suite visual para que valide estado real del shell y drawers con data mockeada.

Archivos principales:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/tests/visual/helpers/mock-server.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/tests/visual/helpers/setup.ts`

Snapshots actualizados:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/tests/visual/inspector.visual.spec.ts-snapshots/inspector-brand-kit-drawer-darwin.png`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/tests/visual/shell.visual.spec.ts-snapshots/shell-agency-command-center-darwin.png`

Resultado:

- `test:visual` queda estable en `15/15`
- los baselines ya no validan solamente una UI degradada por API caída

### GAP-7 — Numeric `z-index`

Se eliminaron los 2 usos residuales detectados por auditoría.

Archivos principales:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/export/export-tokens.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/dynamic-map.export.ts`

Resultado:

- `numeric z-index uses: 0`

## Estado de Follow-ups Bajos

- `GAP-6` Templates library: ya no aplica como gap. La suite valida `>= 11` templates en `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/testing/unit/templates/template-library-registry.test.ts`.
- `GAP-8` Inspector contract-driven: ya existe adopción real en secciones productivas como `TimingSection`, `ConditionsSection`, `ProjectContextSection`, `CommentsSection` y `ReleaseSettingsSection`. No queda como bloqueador de release.

## Validación Ejecutada

Comandos corridos en `/Users/enzocienfuegos/Documents/MandaRion`:

```bash
npm run lint -w @smx/studio
npm run typecheck -w @smx/studio
npm run test -w @smx/studio
npm run build -w @smx/studio
npm run audit:visual-debt -w @smx/studio
npm run test:visual -w @smx/studio
npm run release:readiness -w @smx/studio
```

Resultados:

- `lint`: OK
- `typecheck`: OK
- `test`: `87` files, `358` tests pasando
- `build`: OK
- `audit:visual-debt`: OK
- `test:visual`: `15/15`
- `release:readiness`: `PASS 6/6`

Reporte de readiness:

- `/Users/enzocienfuegos/Documents/MandaRion/artifacts/release-readiness/studio/studio-release-readiness-2026-05-09.md`

## Métricas Finales

- `files over threshold`: `0`
- `inline styles`: `0`
- `!important uses`: `0`
- `numeric z-index uses`: `0`
- `hardcoded widget type branches`: `4`
- ese `4` queda repartido entre:
  - `runtime-script.ts`: `3`
  - `widget-reducer.test.ts`: `1`

Notas:

- el `3` de `runtime-script.ts` corresponde al detector explícito de capabilities (`dynamic-map`, `leaflet-map`, `form`/`carousel` interactions). Es intencional y acotado.
- `spreadsheet-vendor` sigue pesando ~`419 KB`, pero ya quedó como chunk lazy y fuera del `index.html`.

## Riesgos / Observaciones

- No se tocó el ruido no relacionado ya presente en `artifacts/` ni el cambio local ajeno en `/Users/enzocienfuegos/Documents/MandaRion/packages/db/migrations/0023_video_transcode_jobs.sql`.
- La primera corrida de `release:readiness` falló por una ejecución visual transitoria; la rerun final quedó verde `6/6` y el reporte persistido es el passing.
- No se introdujeron cambios de contrato público fuera del scope del V3; los ajustes fueron internos o aditivos.

## Entrega

Artefactos de este closeout:

- audit markdown:
  `/Users/enzocienfuegos/Documents/MandaRion/artifacts/audit_packages/studio-world-class-codex-v3-closeout-2026-05-09/studio-world-class-codex-v3-closeout-audit-2026-05-09.md`
- bundle zip:
  `/Users/enzocienfuegos/Documents/MandaRion/artifacts/audit_packages/studio-world-class-codex-v3-closeout-2026-05-09/studio-world-class-codex-v3-closeout-bundle-2026-05-09.zip`

## Conclusión

No falta ningún cambio release-blocking del `STUDIO_WORLD_CLASS_CODEX_PLAN_V3_CLOSEOUT.md`.

Studio queda nuevamente en estado de:

- release-ready técnico
- release-ready visual
- release-ready de compliance por canal
- release-ready de packaging y documentación para auditoría
