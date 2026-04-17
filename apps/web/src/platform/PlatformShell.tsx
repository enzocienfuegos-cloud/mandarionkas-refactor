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
    return (
      <div className="platform-login-shell">
        <div className="platform-login-card">
          <div className="platform-login-copy">
            <span className="brand-mark">SMX Studio Platform</span>
            <h1>Restoring cloud session…</h1>
            <p>Checking the cookie-backed session on the API.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <LoginScreen />;

  return route === 'hub'
    ? <WorkspaceHub onEnterEditor={() => setRoute('editor')} />
    : <StudioShell onOpenWorkspaceHub={() => setRoute('hub')} />;
}
