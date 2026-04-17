import { useEffect, useState } from 'react';
import { LoginScreen } from './LoginScreen';
import { usePlatformSnapshot } from './runtime';
import { StudioShell } from '../app/shell/StudioShell';
import { WorkspaceHub } from './WorkspaceHub';
import { restoreSession } from './auth-service';

function readRouteFromHash(): 'hub' | 'editor' {
  if (typeof window === 'undefined') return 'hub';
  return window.location.hash === '#/editor' ? 'editor' : 'hub';
}

export function PlatformShell(): JSX.Element {
  const isAuthenticated = usePlatformSnapshot().session.isAuthenticated;
  const [route, setRoute] = useState<'hub' | 'editor'>(readRouteFromHash);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  useEffect(() => {
    let active = true;
    void restoreSession().finally(() => {
      if (active) setIsRestoringSession(false);
    });
    return () => {
      active = false;
    };
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

  if (isRestoringSession) {
    return <div className="platform-login-shell"><div className="platform-login-card">Restoring session...</div></div>;
  }

  if (!isAuthenticated) return <LoginScreen />;

  return route === 'hub'
    ? <WorkspaceHub onEnterEditor={() => setRoute('editor')} />
    : <StudioShell onOpenWorkspaceHub={() => setRoute('hub')} />;
}
