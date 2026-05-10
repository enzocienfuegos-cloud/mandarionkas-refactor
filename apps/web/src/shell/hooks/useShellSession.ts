import React from 'react';
import { useNavigate } from 'react-router-dom';
import { loadAuthMe } from '../../shared/workspaces';
import { mapAuthMeToShellUser, type ShellUser } from '../types';

export function useShellSession() {
  const navigate = useNavigate();
  const [user, setUser] = React.useState<ShellUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const applyAuth = React.useCallback((authMe: Awaited<ReturnType<typeof loadAuthMe>>) => {
    setUser(mapAuthMeToShellUser(authMe));
  }, []);

  const retry = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      applyAuth(await loadAuthMe());
    } catch (loadError: unknown) {
      const status = (loadError as { status?: number })?.status ?? 0;
      if (status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      setError(`Could not load session: ${(loadError as Error)?.message ?? 'unknown error'}.`);
    } finally {
      setLoading(false);
    }
  }, [applyAuth, navigate]);

  React.useEffect(() => {
    void retry();
  }, [retry]);

  return { user, loading, error, retry, applyAuth };
}
