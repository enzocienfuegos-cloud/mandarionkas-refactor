import React from 'react';
import { loadWorkspaces, switchWorkspace, type WorkspaceOption } from '../../shared/workspaces';
import type { ShellUser } from '../types';

export function useShellWorkspaces(user: ShellUser | null, applyAuth: (authMe: Awaited<ReturnType<typeof switchWorkspace>>) => void) {
  const [workspaces, setWorkspaces] = React.useState<WorkspaceOption[]>([]);

  const reload = React.useCallback(async () => {
    setWorkspaces(await loadWorkspaces('all'));
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const switchActiveWorkspace = React.useCallback(async (workspaceId: string) => {
    if (!workspaceId || workspaceId === user?.workspace.id) return;
    const authMe = await switchWorkspace(workspaceId);
    applyAuth(authMe);
    await reload();
  }, [applyAuth, reload, user?.workspace.id]);

  return {
    workspaces,
    activeWorkspaceId: user?.workspace.id ?? '',
    switchActiveWorkspace,
  };
}
