import { useEffect, useState } from 'react';
import { clearAutosaveDraft, loadAutosaveDraft } from '../../../repositories/document';
import { archiveProject, changeProjectOwner, duplicateProject, getProjectRepository, listProjects, loadProject, restoreProject, saveProject } from '../../../repositories/project';
import { listProjectVersions, loadProjectVersion, saveProjectVersion } from '../../../repositories/project-versions';
import type { ProjectSessionController, TopBarStudioSnapshot, WorkspaceController } from './top-bar-types';
import { useStudioSessionActions } from '../../../hooks/use-studio-actions';
import { getProjectRepositoryMode, setProjectRepositoryMode } from '../../../repositories/mode';
import { createProjectStarterState } from './project-starters';
import { ensureWorldCupStarterRegistered } from './world-cup-starter';

export function useProjectSessionController(snapshot: TopBarStudioSnapshot, workspace: Pick<WorkspaceController, 'activeClientId' | 'clients' | 'canCreateProjects'>): ProjectSessionController {
  ensureWorldCupStarterRegistered();
  const [projectTick, setProjectTick] = useState(0);
  const [newProjectName, setNewProjectName] = useState('');
  const [projects, setProjects] = useState<ProjectSessionController['projects']>([]);
  const [newProjectPresetId, setNewProjectPresetId] = useState('custom');
  const [newProjectStarterId, setNewProjectStarterId] = useState<ProjectSessionController['newProjectStarterId']>('blank');
  const [autosaveAvailable, setAutosaveAvailable] = useState(true);
  const [versions, setVersions] = useState<ProjectSessionController['versions']>([]);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string | undefined>(undefined);
  const [repositoryMode, setRepositoryMode] = useState<'local' | 'api'>(getProjectRepositoryMode());
  const sessionActions = useStudioSessionActions();

  function handleRepositoryModeChange(mode: 'local' | 'api'): void {
    setProjectRepositoryMode(mode);
    setRepositoryMode(mode);
  }

  useEffect(() => {
    listProjects().then(setProjects).catch(() => setProjects([]));
  }, [projectTick, snapshot.activeProjectId, snapshot.lastSavedAt, workspace.activeClientId]);

  useEffect(() => {
    let cancelled = false;
    const projectId = snapshot.activeProjectId;
    if (!projectId) {
      setVersions([]);
      setSelectedVersionId('');
      return;
    }
    listProjectVersions(projectId)
      .then((items) => {
        if (cancelled) return;
        setVersions(items);
        setSelectedVersionId((current) => current && items.some((item) => item.id === current) ? current : (items[0]?.id ?? ''));
      })
      .catch(() => {
        if (!cancelled) {
          setVersions([]);
          setSelectedVersionId('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectTick, snapshot.activeProjectId, snapshot.lastSavedAt]);

  function refreshProjects(): void {
    setProjectTick((value) => value + 1);
  }

  async function handleSaveProject(): Promise<void> {
    try {
      setSaveStatus('saving');
      setSaveMessage(undefined);
      const summary = await saveProject(snapshot.state, snapshot.activeProjectId);
      const version = await saveProjectVersion(summary.id, snapshot.state);
      const nextState = {
        ...snapshot.state,
        document: {
          ...snapshot.state.document,
          id: summary.id,
          version: version.versionNumber,
          metadata: { ...snapshot.state.document.metadata, dirty: false, lastSavedAt: version.savedAt },
        },
        ui: { ...snapshot.state.ui, activeProjectId: summary.id },
      };
      sessionActions.replaceState(nextState);
      setSaveStatus('saved');
      setSaveMessage(`Saved v${version.versionNumber}`);
      refreshProjects();
    } catch (error) {
      setSaveStatus('error');
      setSaveMessage(error instanceof Error ? error.message : 'Save failed');
      throw error;
    }
  }

  async function handleSaveVersion(): Promise<void> {
    if (!snapshot.activeProjectId) {
      await handleSaveProject();
      return;
    }
    try {
      setSaveStatus('saving');
      setSaveMessage(undefined);
      const version = await saveProjectVersion(snapshot.activeProjectId, snapshot.state);
      const nextState = {
        ...snapshot.state,
        document: {
          ...snapshot.state.document,
          version: version.versionNumber,
          metadata: { ...snapshot.state.document.metadata, dirty: false, lastSavedAt: version.savedAt },
        },
      };
      sessionActions.replaceState(nextState);
      setSaveStatus('saved');
      setSaveMessage(`Version ${version.versionNumber} saved`);
      refreshProjects();
    } catch (error) {
      setSaveStatus('error');
      setSaveMessage(error instanceof Error ? error.message : 'Version save failed');
      throw error;
    }
  }

  async function handleCreateProject(): Promise<void> {
    if (!workspace.canCreateProjects) return;
    const projectName = newProjectName.trim() || 'Untitled Project';
    const seededState = createProjectStarterState({
      starterId: newProjectStarterId,
      name: projectName,
      canvasPresetId: newProjectPresetId,
      clientId: workspace.activeClientId,
      clientName: workspace.clients.find((item) => item.id === workspace.activeClientId)?.name ?? '',
      brandName: snapshot.platformMeta?.brandName ?? '',
      campaignName: snapshot.platformMeta?.campaignName ?? '',
    });
    const initialState = {
      ...seededState,
      ui: { ...seededState.ui, activeProjectId: undefined },
    };

    sessionActions.replaceState(initialState);
    setNewProjectName('');

    try {
      setSaveStatus('saving');
      setSaveMessage(undefined);
      const summary = await saveProject(initialState);
      const version = await saveProjectVersion(summary.id, initialState);
      const nextState = {
        ...initialState,
        document: {
          ...initialState.document,
          id: summary.id,
          version: version.versionNumber,
          metadata: {
            ...initialState.document.metadata,
            dirty: false,
            lastSavedAt: version.savedAt,
          },
        },
        ui: { ...initialState.ui, activeProjectId: summary.id },
      };
      sessionActions.replaceState(nextState);
      setSaveStatus('saved');
      setSaveMessage(`Created ${summary.name}`);
      refreshProjects();
    } catch (error) {
      setSaveStatus('error');
      setSaveMessage(error instanceof Error ? error.message : 'Project creation failed');
      throw error;
    }
  }

  async function handleLoadProject(projectId: string): Promise<void> {
    const loaded = await loadProject(projectId);
    if (!loaded) return;
    sessionActions.replaceState({ ...loaded, ui: { ...loaded.ui, activeProjectId: projectId } });
    refreshProjects();
  }

  async function handleDeleteProject(): Promise<void> {
    if (!snapshot.activeProjectId) return;
    await getProjectRepository().delete(snapshot.activeProjectId);
    setVersions([]);
    setSelectedVersionId('');
    refreshProjects();
  }

  async function handleDuplicateProject(projectId: string): Promise<void> {
    await duplicateProject(projectId);
    refreshProjects();
  }

  async function handleArchiveProject(projectId: string): Promise<void> {
    await archiveProject(projectId);
    refreshProjects();
  }

  async function handleRestoreProject(projectId: string): Promise<void> {
    await restoreProject(projectId);
    refreshProjects();
  }

  async function handleChangeProjectOwner(projectId: string, ownerUserId: string, ownerName?: string): Promise<void> {
    await changeProjectOwner(projectId, ownerUserId, ownerName);
    refreshProjects();
  }

  async function handleRestoreVersion(versionId: string): Promise<void> {
    if (!snapshot.activeProjectId || !versionId) return;
    const restored = await loadProjectVersion(snapshot.activeProjectId, versionId);
    if (!restored) return;
    sessionActions.replaceState({
      ...restored,
      document: {
        ...restored.document,
        metadata: {
          ...restored.document.metadata,
          dirty: false,
        },
      },
      ui: { ...restored.ui, activeProjectId: snapshot.activeProjectId },
    });
    refreshProjects();
  }

  async function handleRecoverDraft(): Promise<void> {
    const draft = await loadAutosaveDraft();
    if (!draft) {
      setAutosaveAvailable(false);
      return;
    }
    sessionActions.replaceState(draft);
    setAutosaveAvailable(true);
  }

  async function handleClearDraft(): Promise<void> {
    await clearAutosaveDraft();
    setAutosaveAvailable(false);
  }

  return {
    projects,
    repositoryMode,
    autosaveAvailable,
    versions,
    selectedVersionId,
    setSelectedVersionId,
    newProjectName,
    setNewProjectName,
    newProjectPresetId,
    setNewProjectPresetId,
    newProjectStarterId,
    setNewProjectStarterId,
    handleCreateProject,
    handleLoadProject,
    handleSaveProject,
    handleSaveVersion,
    handleDeleteProject,
    handleDuplicateProject,
    handleArchiveProject,
    handleRestoreProject,
    handleChangeProjectOwner,
    handleRestoreVersion,
    handleRecoverDraft,
    handleClearDraft,
    refreshProjects,
    handleRepositoryModeChange,
    saveStatus,
    saveMessage,
  };
}
