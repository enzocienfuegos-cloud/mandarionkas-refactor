import { describe, expect, it } from 'vitest';
import { buildStudioPreflightFindings } from '../../../app/shell/PreflightTray';
import { createInitialState } from '../../../domain/document/factories';
import { DynamicMapDefinition } from '../../../widgets/modules/definitions/dynamic-map.definition';
import type { ExportPreflight } from '../../../export/preflight';

describe('preflight tray findings', () => {
  it('surfaces bundle size pressure and maps widget-scoped blockers', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'google-display';
    const widget = DynamicMapDefinition.defaults(sceneId, 0);
    state.document.widgets[widget.id] = widget;
    state.document.scenes[0].widgetIds = [widget.id];

    const preflight: ExportPreflight = {
      metrics: {
        totalBytes: 240 * 1024,
        totalFiles: 12,
        assetCount: 1,
        remoteBundledAssetCount: 0,
        inlineAssetCount: 0,
        materializedAssetCount: 1,
        htmlBytes: 12 * 1024,
        javascriptBytes: 48 * 1024,
        jsonBytes: 3 * 1024,
        binaryBytes: 177 * 1024,
      },
      compliance: [],
      packagingPlan: {
        adapter: 'generic-html5',
        format: 'single-page-html',
        entryFile: 'index.html',
        bootstrapFile: 'inline',
        exitStrategy: 'window-open',
        requiresSingleRootDocument: true,
        politeLoad: false,
        sceneCount: 1,
        externalAssetMode: 'referenced',
        emittedFiles: ['index.html'],
      },
      remoteFetchPlan: [],
      channelChecklist: [],
      channelBlockers: [],
      channelWarnings: [],
      packageBlockers: [{
        level: 'error',
        code: 'widget.mraid-unsupported',
        message: 'This widget should be reviewed carefully for MRAID handoff.',
        targetId: widget.id,
        scope: 'runtime',
      }],
      packageWarnings: [],
      summary: {
        blockers: 1,
        warnings: 0,
        channelErrors: 0,
        channelWarnings: 0,
        remoteAssetPendingCount: 0,
        resolvedAssetCount: 1,
        packageScore: 72,
        packageGrade: 'C',
        readyForBundleZip: false,
        readyForResolvedZip: false,
        deliveryMode: 'blocked',
        preferredArtifact: 'zip-bundle',
        topBlocker: 'This widget should be reviewed carefully for MRAID handoff.',
        recommendedNextStep: 'Fix the blocked runtime issue.',
      },
    };

    const findings = buildStudioPreflightFindings(state.document, preflight);

    expect(findings[0]).toMatchObject({
      id: 'bundle-size-over-200kb',
      severity: 'error',
    });
    expect(findings).toContainEqual(expect.objectContaining({
      id: `package-blocker-widget.mraid-unsupported-${widget.id}`,
      widgetIds: [widget.id],
      sceneIds: [sceneId],
      severity: 'error',
    }));
    expect(findings).toContainEqual(expect.objectContaining({
      id: 'runtime-network-io-review',
      widgetIds: [widget.id],
      severity: 'warning',
    }));
  });
});
