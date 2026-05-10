import { validateExport } from '../domain/document/export-validation';
import type { StudioState } from '../domain/document/types';
import { getChannelRequirements } from './channels';
import type { ExportReadiness } from './types';

export function buildExportReadiness(state: StudioState): ExportReadiness {
  const issues = validateExport(state);
  const blockers = issues.filter((item) => item.level === 'error').length;
  const warnings = issues.filter((item) => item.level === 'warning').length;
  const targetChannel = state.document.metadata.release.targetChannel;
  const channelChecklist = getChannelRequirements(targetChannel, state);
  const checklist = [
    { label: 'Document has a name', passed: Boolean(state.document.name.trim()) },
    { label: 'At least one scene exists', passed: state.document.scenes.length > 0 },
    { label: 'Every scene has widgets', passed: state.document.scenes.every((scene) => scene.widgetIds.length > 0) },
    { label: 'All widget frames are valid', passed: Object.values(state.document.widgets).every((widget) => widget.frame.width > 0 && widget.frame.height > 0) },
    { label: 'CTA widgets have URLs', passed: Object.values(state.document.widgets).filter((widget) => widget.type === 'cta').every((widget) => Object.values(state.document.actions).some((action) => action.widgetId === widget.id && action.type === 'open-url' && action.url)) },
    { label: 'QA status is ready-for-qa or passed', passed: state.document.metadata.release.qaStatus !== 'draft' },
    ...channelChecklist.map((item) => ({ label: item.label, passed: item.passed })),
    { label: 'No export blockers', passed: blockers === 0 },
  ];
  const passedCount = checklist.filter((item) => item.passed).length;
  const rawScore = Math.round((passedCount / checklist.length) * 100 - warnings * 2 - blockers * 15);
  const score = Math.max(0, Math.min(100, rawScore));
  const grade: ExportReadiness['grade'] = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
  return { score, grade, blockers, warnings, checklist, targetChannel, qaStatus: state.document.metadata.release.qaStatus };
}
