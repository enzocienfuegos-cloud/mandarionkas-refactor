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

function readRouteFromHash(): 'hub' | 'editor' {
  if (typeof window === 'undefined') return 'hub';
  return window.location.hash === '#/editor' ? 'editor' : 'hub';
}

export function PlatformShell(): JSX.Element {
  const snapshot = usePlatformSnapshot();
  const isAuthenticated = snapshot.session.isAuthenticated;
  const [route, setRoute] = useState<'hub' | 'editor'>(readRouteFromHash);

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setRoute('hub');
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
    const nextHash = route === 'editor' ? '#/editor' : '#/hub';
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, [route]);

  return (
    <Suspense fallback={<div className="platform-loading-shell">Loading studio…</div>}>
      {!isAuthenticated
        ? <LoginScreen />
        : route === 'hub'
          ? <WorkspaceHub onEnterEditor={() => setRoute('editor')} />
          : <StudioShell onOpenWorkspaceHub={() => setRoute('hub')} />}
    </Suspense>
  );
}
