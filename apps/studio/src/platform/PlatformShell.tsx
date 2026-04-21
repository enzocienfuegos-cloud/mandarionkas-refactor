import { useEffect, useState } from 'react';
import { LoginScreen } from './LoginScreen';
import { restoreSession } from './auth-service';
import { usePlatformSnapshot } from './runtime';
import { StudioShell } from '../app/shell/StudioShell';
import { WorkspaceHub } from './WorkspaceHub';

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

  if (!isAuthenticated) return <LoginScreen />;

  return route === 'hub'
    ? <WorkspaceHub onEnterEditor={() => setRoute('editor')} />
    : <StudioShell onOpenWorkspaceHub={() => setRoute('hub')} />;
}
