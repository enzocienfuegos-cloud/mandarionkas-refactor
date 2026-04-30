import type { PortableExportProject } from './portable';

export type ExportComplianceIssue = {
  level: 'error' | 'warning';
  code: string;
  message: string;
  targetId?: string;
  scope: 'package' | 'scene' | 'widget' | 'interaction' | 'asset';
};

export function validatePortableExport(project: PortableExportProject): ExportComplianceIssue[] {
  const issues: ExportComplianceIssue[] = [];

  if (!project.scenes.length) {
    issues.push({ level: 'error', code: 'package.no-scenes', scope: 'package', message: 'Portable export has no scenes.' });
  }

  if (!project.canvas.width || !project.canvas.height) {
    issues.push({ level: 'error', code: 'package.invalid-canvas', scope: 'package', message: 'Portable export is missing a valid canvas size.' });
  }

  if (!project.interactions.some((interaction) => interaction.type === 'open-url' && interaction.url)) {
    issues.push({
      level: 'warning',
      code: 'package.no-clickthrough',
      scope: 'package',
      message: 'Portable export has no clickthrough interaction. Most HTML5 ad channels expect a clear exit action.',
    });
  }

  project.scenes.forEach((scene) => {
    if (!scene.widgets.length) {
      issues.push({
        level: 'warning',
        code: 'scene.empty',
        scope: 'scene',
        targetId: scene.id,
        message: `Scene "${scene.name}" has no exportable widgets.`,
      });
    }

    if (scene.durationMs <= 0) {
      issues.push({
        level: 'error',
        code: 'scene.invalid-duration',
        scope: 'scene',
        targetId: scene.id,
        message: `Scene "${scene.name}" has an invalid duration.`,
      });
    }
  });

  project.scenes.forEach((scene) => {
    scene.widgets.forEach((widget) => {
      if (widget.frame.width <= 0 || widget.frame.height <= 0) {
        issues.push({
          level: 'error',
          code: 'widget.invalid-frame',
          scope: 'widget',
          targetId: widget.id,
          message: `Widget "${widget.name}" has an invalid frame.`,
        });
      }

      if ((widget.type === 'cta' || widget.type === 'buttons') && !widget.interactions.length) {
        issues.push({
          level: 'warning',
          code: 'widget.interactive-without-action',
          scope: 'widget',
          targetId: widget.id,
          message: `Interactive widget "${widget.name}" has no export interaction attached.`,
        });
      }
    });
  });

  project.assets.forEach((asset) => {
    if (!/^https?:\/\//i.test(asset.src) && !asset.src.startsWith('data:')) {
      issues.push({
        level: 'warning',
        code: 'asset.non-portable-src',
        scope: 'asset',
        targetId: asset.id,
        message: `Asset "${asset.id}" uses a non-portable source path.`,
      });
    }
  });

  return issues;
}
