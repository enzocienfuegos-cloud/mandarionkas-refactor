import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ShellUser } from '../types';

export function useShellGuards(user: ShellUser | null, loading: boolean) {
  const location = useLocation();
  const navigate = useNavigate();

  const isLauncherRoute = location.pathname === '/' || location.pathname === '/launch';
  const isWorkspaceRoute = location.pathname.startsWith('/settings/workspace');
  const hasAdServerAccess = user?.workspace.productAccess.ad_server !== false;

  React.useEffect(() => {
    if (loading || !user) return;
    const canAudit = user.permissions.includes('audit:read');
    const isAdServerRoute = !isLauncherRoute && !isWorkspaceRoute;

    if (!hasAdServerAccess && isAdServerRoute) {
      navigate('/launch', { replace: true });
      return;
    }

    if (!canAudit && location.pathname.startsWith('/settings/audit-log')) {
      navigate('/settings', { replace: true });
    }
  }, [hasAdServerAccess, isLauncherRoute, isWorkspaceRoute, loading, location.pathname, navigate, user]);

  return {
    hasAdServerAccess,
    isLauncherRoute,
    isWorkspaceRoute,
    canRenderCurrentRoute: hasAdServerAccess || isLauncherRoute || isWorkspaceRoute,
  };
}
