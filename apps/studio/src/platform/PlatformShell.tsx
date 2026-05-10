import { Suspense, lazy, useEffect, useState } from 'react';
import { restoreSession } from './auth-service';
import { usePlatformSnapshot } from './runtime';
import { getPlatformServices } from './services';

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
  | { kind: 'agency'; search?: string }
  | { kind: 'client-workspace'; clientId?: string; search?: string }
  | { kind: 'editor'; search?: string };

function readRouteFromHash(): PlatformRoute {
  if (typeof window === 'undefined') return { kind: 'agency' };
  const hash = window.location.hash.replace(/^#/, '');
  const [path = '/hub', search = ''] = hash.split('?');
  if (path === '/editor') return { kind: 'editor', search };
  if (path.startsWith('/hub/client/')) {
    return { kind: 'client-workspace', clientId: decodeURIComponent(path.slice('/hub/client/'.length)), search };
  }
  return { kind: 'agency', search };
}

function routeToHash(route: PlatformRoute): string {
  const suffix = route.search ? `?${route.search}` : '';
  switch (route.kind) {
    case 'editor':
      return `#/editor${suffix}`;
    case 'client-workspace':
      return route.clientId ? `#/hub/client/${encodeURIComponent(route.clientId)}${suffix}` : `#/hub/client${suffix}`;
    case 'agency':
    default:
      return `#/hub${suffix}`;
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
    void getPlatformServices().setActiveClient(route.clientId);
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
