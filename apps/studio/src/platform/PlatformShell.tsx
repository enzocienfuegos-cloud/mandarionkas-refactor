import { Suspense, lazy, useEffect, useState } from 'react';
import { restoreSession } from './auth-service';
import { usePlatformSnapshot } from './runtime';

const LoginScreen = lazy(async () => {
  const module = await import('./LoginScreen');
  return { default: module.LoginScreen };
});

const StudioShell = lazy(async () => {
  const module = await import('../app/shell/StudioShell');
  return { default: module.StudioShell };
});

const WorkspaceHub = lazy(async () => {
  const module = await import('./WorkspaceHub');
  return { default: module.WorkspaceHub };
});

const AgencyShell = lazy(async () => {
  const module = await import('./AgencyShell');
  return { default: module.AgencyShell };
});

type PlatformRoute =
  | { kind: 'agency' }
  | { kind: 'client-workspace'; clientId?: string }
  | { kind: 'editor' };

function readRouteFromHash(): PlatformRoute {
  if (typeof window === 'undefined') return { kind: 'agency' };
  const hash = window.location.hash.replace(/^#/, '');
  if (hash === '/editor') return { kind: 'editor' };
  if (hash.startsWith('/hub/client/')) {
    return { kind: 'client-workspace', clientId: decodeURIComponent(hash.slice('/hub/client/'.length)) };
  }
  return { kind: 'agency' };
}

function routeToHash(route: PlatformRoute): string {
  switch (route.kind) {
    case 'editor':
      return '#/editor';
    case 'client-workspace':
      return route.clientId ? `#/hub/client/${encodeURIComponent(route.clientId)}` : '#/hub/client';
    case 'agency':
    default:
      return '#/hub';
  }
}

export function PlatformShell(): JSX.Element {
  const snapshot = usePlatformSnapshot();
  const isAuthenticated = snapshot.session.isAuthenticated;
  const [route, setRoute] = useState<PlatformRoute>(readRouteFromHash);

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setRoute({ kind: 'agency' });
      if (typeof window !== 'undefined') window.location.hash = '#/hub';
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onHashChange = () => setRoute(readRouteFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nextHash = routeToHash(route);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, [route]);

  useEffect(() => {
    if (route.kind !== 'client-workspace' || !route.clientId || snapshot.session.activeClientId === route.clientId) return;
    void import('./workspace-service').then((module) => module.setActiveClient(route.clientId!));
  }, [route, snapshot.session.activeClientId]);

  return (
    <Suspense fallback={<div className="platform-loading-shell">Loading studio…</div>}>
      {!isAuthenticated
        ? <LoginScreen />
        : route.kind === 'agency'
          ? (
            <AgencyShell
              onOpenClientWorkspace={(clientId) => setRoute({ kind: 'client-workspace', clientId })}
              onEnterEditor={() => setRoute({ kind: 'editor' })}
            />
          )
          : route.kind === 'client-workspace'
            ? (
              <WorkspaceHub
                onBackToAgencyShell={() => setRoute({ kind: 'agency' })}
                onEnterEditor={() => setRoute({ kind: 'editor' })}
              />
            )
            : <StudioShell onOpenWorkspaceHub={() => setRoute({ kind: 'client-workspace', clientId: snapshot.session.activeClientId })} />}
    </Suspense>
  );
}
