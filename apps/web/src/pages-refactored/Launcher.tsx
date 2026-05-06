import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, LogOut, Plus } from '../system/icons';
import {
  Panel,
  Button,
  Badge,
  Kicker,
  CenteredSpinner,
  EmptyState,
  useToast,
} from '../system';
import { DuskLogo } from '../shell/DuskLogo';
import {
  getWorkspaceProductLabel,
  loadWorkspaces,
  switchWorkspace,
  type WorkspaceOption,
} from '../shared/workspaces';

type Workspace = WorkspaceOption & {
  role: 'owner' | 'admin' | 'member' | 'viewer';
  campaignCount: number;
  lastActiveAt: string | null;
};

/**
 * Launcher — refactored to the design system (S56).
 *
 * Shown after sign-in if the user has access to multiple workspaces or
 * to multiple SignalMix products. Replaces the legacy launcher which
 * had hardcoded gradient cards and inline brand colors.
 */
export default function Launcher() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    loadWorkspaces('all')
      .then((items) =>
        setWorkspaces(
          items.map((workspace) => ({
            ...workspace,
            role: 'member',
            campaignCount: 0,
            lastActiveAt: null,
          })),
        ),
      )
      .catch(() => toast({ tone: 'critical', title: 'Could not load workspaces' }))
      .finally(() => setLoading(false));
  }, [toast]);

  const handleEnter = async (workspace: Workspace) => {
    try {
      await switchWorkspace(workspace.id);
    } catch {
      toast({ tone: 'critical', title: 'Could not switch workspace' });
      return;
    }
    navigate('/overview');
  };

  const handleSignOut = async () => {
    await fetch('/v1/auth/logout', { method: 'POST', credentials: 'include' });
    navigate('/login');
  };

  if (loading) return <CenteredSpinner label="Loading workspaces…" />;

  return (
    <div
      className="min-h-screen flex flex-col p-6"
      style={{
        background:
          'radial-gradient(ellipse at top, rgba(241, 0, 139, 0.08) 0%, transparent 50%), var(--dusk-bg)',
      }}
    >
      <header className="flex items-center justify-between mb-12">
        <DuskLogo />
        <Button variant="ghost" leadingIcon={<LogOut />} onClick={handleSignOut}>
          Sign out
        </Button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <Kicker>Welcome</Kicker>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
              Choose a workspace
            </h1>
            <p className="mt-2 text-sm text-[color:var(--dusk-text-muted)]">
              You have access to {workspaces.length} workspace{workspaces.length === 1 ? '' : 's'}.
            </p>
          </div>

          {workspaces.length === 0 ? (
            <Panel padding="none">
              <EmptyState
                icon={<Building2 />}
                title="No workspaces yet"
                description="Ask your admin to add you to a workspace, or create your own."
                action={<Button variant="primary" leadingIcon={<Plus />}>Create workspace</Button>}
              />
            </Panel>
          ) : (
            <ul className="space-y-3">
              {workspaces.map((workspace) => (
                <li key={workspace.id}>
                  <button
                    type="button"
                    onClick={() => handleEnter(workspace)}
                    className="
                      w-full text-left flex items-center gap-4 p-4 rounded-2xl
                      bg-surface-1 border border-[color:var(--dusk-border-default)]
                      hover:border-brand-500 hover:shadow-2 transition-all
                      group
                    "
                  >
                    <div
                      className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center text-sm font-semibold text-text-inverse"
                      style={{ background: 'var(--dusk-brand-gradient)' }}
                      aria-hidden
                    >
                      {workspace.name.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-[color:var(--dusk-text-primary)] truncate">
                          {workspace.name}
                        </p>
                        <Badge tone="neutral" size="sm" variant="outline">{workspace.role}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-[color:var(--dusk-text-soft)]">
                        {getWorkspaceProductLabel(workspace)}
                        {workspace.lastActiveAt ? (
                          <> · last active {new Date(workspace.lastActiveAt).toLocaleDateString()}</>
                        ) : null}
                      </p>
                    </div>

                    <ArrowRight className="h-5 w-5 text-[color:var(--dusk-text-soft)] group-hover:text-text-brand group-hover:translate-x-0.5 transition-all" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
