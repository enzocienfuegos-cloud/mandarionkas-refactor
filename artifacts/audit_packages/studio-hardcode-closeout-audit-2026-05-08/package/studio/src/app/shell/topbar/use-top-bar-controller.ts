import { useMemo } from 'react';
import type { CollaborationController, DocumentController, ExportReadinessController, ProjectSessionController, TopBarStudioSnapshot, WorkspaceController } from './top-bar-types';
import { useCollaborationController } from './use-collaboration-controller';
import { useDocumentController } from './use-document-controller';
import { useExportReadinessController } from './use-export-readiness-controller';
import { useProjectSessionController } from './use-project-session-controller';
import { useTopBarStudioSnapshot } from './use-top-bar-studio-snapshot';
import { useWorkspaceController } from './use-workspace-controller';

export function formatMs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export type TopBarController = {
  snapshot: TopBarStudioSnapshot;
  document: DocumentController;
  workspace: WorkspaceController;
  projectSession: ProjectSessionController;
  collaboration: CollaborationController;
  exportReadiness: ExportReadinessController;
};

export function useTopBarController(): TopBarController {
  const snapshot = useTopBarStudioSnapshot();
  const workspace = useWorkspaceController(snapshot);
  const projectSession = useProjectSessionController(snapshot, workspace);
  const document = useDocumentController(snapshot);
  const collaboration = useCollaborationController(snapshot);
  const exportReadiness = useExportReadinessController(snapshot);

  return useMemo(() => ({
    snapshot,
    document,
    workspace,
    projectSession,
    collaboration,
    exportReadiness,
  }), [snapshot, document, workspace, projectSession, collaboration, exportReadiness]);
}
