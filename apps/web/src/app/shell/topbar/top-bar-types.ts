import type { ProjectSummary, ProjectVersionSummary } from '../../../repositories/types';
import type { BindingSource, StudioState, VariantName } from '../../../domain/document/types';
import type { ExportValidationIssue } from '../../../domain/document/export-validation';
import type { ClientWorkspace, PlatformPermission, PlatformSession, WorkspaceRole } from '../../../platform/types';
import type { useDocumentActions, useSceneActions, useUiActions } from '../../../hooks/use-studio-actions';

export type DocumentActions = ReturnType<typeof useDocumentActions>;
export type SceneActions = ReturnType<typeof useSceneActions>;
export type UiActions = ReturnType<typeof useUiActions>;

export type TopBarStudioSnapshot = {
  state: StudioState;
  name: string;
  dirty: boolean;
  selectionCount: number;
  zoom: number;
  playhead: number;
  isPlaying: boolean;
  previewMode: boolean;
  lastAction?: string;
  activeVariant: VariantName;
  activeFeedSource: BindingSource;
  activeFeedRecordId: string;
  activeProjectId?: string;
  activeSceneId: string;
  scenes: StudioState['document']['scenes'];
  canvasPresetId: string;
  release: StudioState['document']['metadata']['release'];
  lastSavedAt?: string;
  lastAutosavedAt?: string;
  platformMeta: StudioState['document']['metadata']['platform'];
  documentVersion: number;
};

export type ProjectSessionController = {
  projects: ProjectSummary[];
  repositoryMode: 'local' | 'api';
  autosaveAvailable: boolean;
  versions: ProjectVersionSummary[];
  selectedVersionId: string;
  setSelectedVersionId(value: string): void;
  newProjectName: string;
  setNewProjectName(value: string): void;
  newProjectPresetId: string;
  setNewProjectPresetId(value: string): void;
  handleCreateProject(): void;
  handleLoadProject(projectId: string): Promise<void>;
  handleSaveProject(): Promise<void>;
  handleSaveVersion(): Promise<void>;
  handleDeleteProject(): Promise<void>;
  handleDuplicateProject(projectId: string): Promise<void>;
  handleArchiveProject(projectId: string): Promise<void>;
  handleRestoreProject(projectId: string): Promise<void>;
  handleChangeProjectOwner(projectId: string, ownerUserId: string, ownerName?: string): Promise<void>;
  handleRestoreVersion(versionId: string): Promise<void>;
  handleRecoverDraft(): Promise<void>;
  handleClearDraft(): Promise<void>;
  handleRepositoryModeChange(mode: 'local' | 'api'): void;
  refreshProjects(): void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  saveMessage?: string;
};

export type WorkspaceController = {
  currentUser: PlatformSession['currentUser'];
  activeClientId?: string;
  activeClient?: ClientWorkspace;
  clients: ClientWorkspace[];
  visibleClients: ClientWorkspace[];
  permissions: PlatformPermission[];
  auditCount: number;
  sessionExpiresAt?: string;
  sessionPersistenceMode?: PlatformSession['persistenceMode'];
  workspaceRole?: WorkspaceRole;
  canCreateClient: boolean;
  canInviteClients: boolean;
  canManageBrandkits: boolean;
  canCreateProjects: boolean;
  canSaveProjects: boolean;
  canDeleteProjects: boolean;
  newClientName: string;
  setNewClientName(value: string): void;
  newBrandName: string;
  setNewBrandName(value: string): void;
  newBrandColor: string;
  setNewBrandColor(value: string): void;
  inviteEmail: string;
  setInviteEmail(value: string): void;
  inviteRole: 'editor' | 'reviewer';
  setInviteRole(value: 'editor' | 'reviewer'): void;
  handleActiveClientChange(clientId: string): Promise<void>;
  handleCreateClient(): Promise<void>;
  handleCreateBrand(): Promise<void>;
  handleInviteMember(): Promise<void>;
  handleLogout(): void;
};

export type CollaborationController = {
  openComments: number;
  pendingApprovals: number;
};

export type ExportReadinessController = {
  exportIssues: ExportValidationIssue[];
  readiness: ReturnType<typeof import('../../../export/engine').buildExportReadiness>;
  preflight: ReturnType<typeof import('../../../export/engine').buildExportPreflight>;
  diagnostics: ReturnType<typeof import('../../../domain/document/diagnostics').buildDiagnosticSummary>;
  resolvedZipStatus: 'idle' | 'exporting' | 'success' | 'error';
  resolvedZipMessage?: string;
  triggerExportHtml(state: StudioState): void;
  triggerExportManifest(state: StudioState): void;
  triggerExportPreflight(state: StudioState): void;
  triggerExportDocumentJson(state: StudioState): void;
  triggerExportPublishPackage(state: StudioState): void;
  triggerExportReviewPackage(state: StudioState): void;
  triggerExportZipBundle(state: StudioState): void;
  triggerExportZipBundleResolved(state: StudioState): Promise<void>;
};

export type DocumentController = {
  sources: BindingSource[];
  records: Array<{ id: string; label: string }>;
  documentActions: DocumentActions;
  sceneActions: SceneActions;
  uiActions: UiActions;
};
