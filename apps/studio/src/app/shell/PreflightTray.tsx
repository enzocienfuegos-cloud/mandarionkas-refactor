import { useMemo, useState } from 'react';
import { useSceneActions, useWidgetActions } from '../../hooks/use-studio-actions';
import { buildExportPreflight } from '../../export/preflight';
import { shallowEqual, useStudioStore } from '../../core/store/use-studio-store';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import type { StudioDocument, StudioState } from '../../domain/document/types';
import { getWidgetDefinition } from '../../widgets/registry/widget-registry';

type ExportPreflight = ReturnType<typeof buildExportPreflight>;

export type StudioPreflightFinding = {
  id: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  detail: string;
  resolution?: string;
  widgetIds?: string[];
  sceneIds?: string[];
};

function getIssueScope(
  documentSnapshot: StudioDocument,
  targetId?: string,
): Pick<StudioPreflightFinding, 'widgetIds' | 'sceneIds'> {
  if (!targetId || !documentSnapshot.widgets[targetId]) return {};
  const widget = documentSnapshot.widgets[targetId];
  return { widgetIds: [widget.id], sceneIds: [widget.sceneId] };
}

export function buildStudioPreflightFindings(
  documentSnapshot: StudioDocument,
  preflight: ExportPreflight,
): StudioPreflightFinding[] {
  const findings: StudioPreflightFinding[] = [];
  const widgetEntries = Object.values(documentSnapshot.widgets).flatMap((widget) => {
    try {
      return [{ widget, definition: getWidgetDefinition(widget.type) }];
    } catch {
      return [];
    }
  });
  const runtimeNetworkWidgets = widgetEntries.filter((item) => item.definition.capabilities?.performsNetworkIo);
  const offlineSensitiveWidgets = widgetEntries.filter((item) => item.definition.capabilities?.worksOffline === false);
  const mraidHostWidgets = widgetEntries.filter((item) => item.definition.capabilities?.requiresMraidHost);
  const runtimeRandomWidgets = widgetEntries.filter((item) => item.definition.capabilities?.hasRuntimeRandomness);

  if (preflight.metrics.totalBytes > 200 * 1024) {
    findings.push({
      id: 'bundle-size-over-200kb',
      severity: 'error',
      title: 'Bundle size is above 200 KB',
      detail: `Current package weight is ${Math.round(preflight.metrics.totalBytes / 1024)} KB.`,
      resolution: 'Compress media or simplify high-cost widgets before final handoff.',
    });
  }

  if (preflight.summary.remoteAssetPendingCount > 0) {
    findings.push({
      id: 'remote-assets-pending',
      severity: 'warning',
      title: 'Remote assets still need materialization',
      detail: `${preflight.summary.remoteAssetPendingCount} asset reference(s) still depend on the resolved ZIP flow.`,
      resolution: 'Run the resolved ZIP export before final delivery.',
    });
  }

  if (
    runtimeNetworkWidgets.length
    && ['google-display', 'gam-html5', 'mraid'].includes(documentSnapshot.metadata.release.targetChannel)
  ) {
    findings.push({
      id: 'runtime-network-io-review',
      severity: 'warning',
      title: 'Some widgets perform runtime network I/O',
      detail: `${runtimeNetworkWidgets.length} widget(s) fetch external data or media at runtime in a strict ad-hosting channel.`,
      resolution: 'QA those widgets carefully and prefer cached or bundled content when possible.',
      widgetIds: runtimeNetworkWidgets.map((item) => item.widget.id),
      sceneIds: [...new Set(runtimeNetworkWidgets.map((item) => item.widget.sceneId))],
    });
  }

  if (
    offlineSensitiveWidgets.length
    && ['google-display', 'gam-html5', 'mraid'].includes(documentSnapshot.metadata.release.targetChannel)
  ) {
    findings.push({
      id: 'offline-safety-review',
      severity: 'warning',
      title: 'Online-only widgets are present in an ad-hosting flow',
      detail: `${offlineSensitiveWidgets.length} widget(s) may degrade when the host has limited connectivity or restrictive runtime rules.`,
      resolution: 'Provide safe fallbacks or keep those widgets out of offline-sensitive placements.',
      widgetIds: offlineSensitiveWidgets.map((item) => item.widget.id),
      sceneIds: [...new Set(offlineSensitiveWidgets.map((item) => item.widget.sceneId))],
    });
  }

  if (mraidHostWidgets.length && documentSnapshot.metadata.release.targetChannel === 'mraid') {
    findings.push({
      id: 'mraid-host-capabilities-required',
      severity: 'warning',
      title: 'MRAID host capabilities are required',
      detail: `${mraidHostWidgets.length} widget(s) rely on host-level MRAID APIs or placement support.`,
      resolution: 'Confirm the target SDK supports the required host features before handoff.',
      widgetIds: mraidHostWidgets.map((item) => item.widget.id),
      sceneIds: [...new Set(mraidHostWidgets.map((item) => item.widget.sceneId))],
    });
  }

  if (runtimeRandomWidgets.length) {
    findings.push({
      id: 'runtime-randomness-review',
      severity: 'info',
      title: 'Some widgets produce runtime-varying output',
      detail: `${runtimeRandomWidgets.length} widget(s) may render impression-to-impression differences or live data changes.`,
      resolution: 'Review QA snapshots and analytics expectations for those modules.',
      widgetIds: runtimeRandomWidgets.map((item) => item.widget.id),
      sceneIds: [...new Set(runtimeRandomWidgets.map((item) => item.widget.sceneId))],
    });
  }

  preflight.channelBlockers.forEach((issue) => {
    findings.push({
      id: `channel-blocker-${issue.id}`,
      severity: 'error',
      title: issue.label,
      detail: `Channel requirement for ${documentSnapshot.metadata.release.targetChannel}.`,
      resolution: 'Address this requirement before export handoff.',
    });
  });

  preflight.packageBlockers.forEach((issue, index) => {
    findings.push({
      id: `package-blocker-${issue.code}-${issue.targetId ?? index}`,
      severity: 'error',
      title: issue.message,
      detail: `${issue.scope} · ${issue.code}`,
      resolution: 'Resolve the package-level blocker before shipping the export.',
      ...getIssueScope(documentSnapshot, issue.targetId),
    });
  });

  preflight.channelWarnings.forEach((issue) => {
    findings.push({
      id: `channel-warning-${issue.id}`,
      severity: 'warning',
      title: issue.label,
      detail: `Channel fit warning for ${documentSnapshot.metadata.release.targetChannel}.`,
      resolution: 'Recommended to review before sharing the final package.',
    });
  });

  preflight.packageWarnings.forEach((issue, index) => {
    findings.push({
      id: `package-warning-${issue.code}-${issue.targetId ?? index}`,
      severity: 'warning',
      title: issue.message,
      detail: `${issue.scope} · ${issue.code}`,
      resolution: 'Worth reviewing before final delivery.',
      ...getIssueScope(documentSnapshot, issue.targetId),
    });
  });

  return findings;
}

function getSeverityIcon(severity: StudioPreflightFinding['severity']) {
  switch (severity) {
    case 'error':
      return StudioIcons.x;
    case 'warning':
      return StudioIcons.info;
    default:
      return StudioIcons.check;
  }
}

export function PreflightTray(): JSX.Element {
  const { documentSnapshot, activeVariant, activeFeedSource, activeFeedRecordId } = useStudioStore((snapshot) => ({
    documentSnapshot: snapshot.document,
    activeVariant: snapshot.ui.activeVariant,
    activeFeedSource: snapshot.ui.activeFeedSource,
    activeFeedRecordId: snapshot.ui.activeFeedRecordId,
  }), shallowEqual);
  const sceneActions = useSceneActions();
  const widgetActions = useWidgetActions();
  const [collapsed, setCollapsed] = useState(true);
  const syntheticState = useMemo<StudioState>(
    () => ({
      document: documentSnapshot,
      ui: {
        activeVariant,
        activeFeedSource,
        activeFeedRecordId,
      },
    } as StudioState),
    [activeFeedRecordId, activeFeedSource, activeVariant, documentSnapshot],
  );
  const preflight = useMemo(() => buildExportPreflight(syntheticState), [syntheticState]);
  const findings = useMemo(
    () => buildStudioPreflightFindings(documentSnapshot, preflight),
    [documentSnapshot, preflight],
  );
  const errorCount = findings.filter((item) => item.severity === 'error').length;
  const warningCount = findings.filter((item) => item.severity === 'warning').length;

  function focusFindingScope(finding: StudioPreflightFinding): void {
    if (!finding.widgetIds?.length) return;
    const widgetIds = finding.widgetIds.filter((widgetId) => documentSnapshot.widgets[widgetId]);
    if (!widgetIds.length) return;
    const primaryWidget = documentSnapshot.widgets[widgetIds[0]];
    if (primaryWidget.sceneId !== documentSnapshot.selection.activeSceneId) {
      sceneActions.selectScene(primaryWidget.sceneId);
    }
    widgetActions.selectWidgets(widgetIds, widgetIds[0]);
  }

  return (
    <aside className={`preflight-tray ${collapsed ? 'is-collapsed' : 'is-expanded'}`}>
      <button
        type="button"
        className="preflight-tray__toggle"
        onClick={() => setCollapsed((value) => !value)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Open preflight tray' : 'Collapse preflight tray'}
      >
        <span className="preflight-tray__toggle-label">
          <StudioIcon icon={errorCount ? StudioIcons.x : warningCount ? StudioIcons.info : StudioIcons.check} size={14} />
          Preflight
        </span>
        <span className="preflight-tray__badges">
          {errorCount ? <span className="preflight-badge preflight-badge--error">{errorCount}</span> : null}
          {warningCount ? <span className="preflight-badge preflight-badge--warning">{warningCount}</span> : null}
          {!errorCount && !warningCount ? <span className="preflight-badge preflight-badge--clean">{preflight.summary.packageGrade}</span> : null}
        </span>
      </button>
      {!collapsed ? (
        <div className="preflight-tray__panel">
          <div className="preflight-tray__summary">
            <span className="pill">Grade {preflight.summary.packageGrade}</span>
            <span className="pill">Size {Math.round(preflight.metrics.totalBytes / 1024)} KB</span>
            <span className="pill">Files {preflight.metrics.totalFiles}</span>
          </div>
          {findings.length ? (
            <ul className="preflight-tray__list">
              {findings.map((finding) => (
                <li key={finding.id}>
                  <button
                    type="button"
                    className={`preflight-finding preflight-finding--${finding.severity} ${finding.widgetIds?.length ? 'is-actionable' : ''}`.trim()}
                    onClick={() => focusFindingScope(finding)}
                    disabled={!finding.widgetIds?.length}
                  >
                    <div className="preflight-finding__title">
                      <StudioIcon icon={getSeverityIcon(finding.severity)} size={12} />
                      <strong>{finding.title}</strong>
                    </div>
                    <div className="preflight-finding__detail">{finding.detail}</div>
                    {finding.resolution ? (
                      <div className="preflight-finding__resolution">{finding.resolution}</div>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="preflight-tray__empty">
              No blockers or warnings right now. This document is ready to keep moving.
            </div>
          )}
        </div>
      ) : null}
    </aside>
  );
}
