// apps/web/src/shell/ProductLauncher.tsx
//
// S43: Simplified to redirect-only. Product access decisions are made
// exclusively in apps/portal/src/App.tsx (PortalHome), not here.
//
// Logic:
//   - Ad Ops pure (Ad Server only, no Studio) → /overview directly.
//   - Everyone else → redirect to portal (unconditional when VITE_PORTAL_URL set).
//   - No portal URL (local dev) → minimal dev fallback.

import React, { useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

interface ShellUser {
  firstName: string;
  workspace?: {
    name: string;
    productAccess?: {
      ad_server: boolean;
      studio: boolean;
    };
  };
}

function getPortalUrl(): string {
  const configured = import.meta.env.VITE_PORTAL_URL?.trim();
  if (configured) return configured;
  if (import.meta.env.DEV) return 'http://localhost:5175/launch';
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (hostname.startsWith('app-')) {
      return `${protocol}//${hostname.replace(/^app-/, 'portal-')}/launch`;
    }
  }
  return '';
}

export default function ProductLauncher() {
  const navigate = useNavigate();
  const { user } = useOutletContext<{ user?: ShellUser }>();

  const access = user?.workspace?.productAccess ?? { ad_server: true, studio: true };
  const hasAdServerAccess = access.ad_server !== false;
  const hasStudioAccess   = access.studio   !== false;
  const portalUrl = getPortalUrl();

  useEffect(() => {
    // Pure Ad Ops — already in the right product, skip portal.
    if (hasAdServerAccess && !hasStudioAccess) {
      navigate('/overview', { replace: true });
      return;
    }
    // All other users → canonical portal launcher.
    if (portalUrl) {
      window.location.assign(portalUrl);
    }
  }, [hasAdServerAccess, hasStudioAccess, navigate, portalUrl]);

  // Pure Ad Ops: navigate() handles it, render nothing.
  if (hasAdServerAccess && !hasStudioAccess) return null;

  // Redirect in progress — show brief message.
  if (portalUrl) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            Unified Access
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Redirecting to the portal{user?.firstName ? `, ${user.firstName}` : ''}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-500 dark:text-white/45">
            Product access is managed from the unified portal.
          </p>
        </div>
        <div className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
          <a
            href={portalUrl}
            className="inline-flex rounded-xl bg-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(241,0,139,0.28)] transition hover:bg-fuchsia-600"
          >
            Continue in Portal →
          </a>
        </div>
      </div>
    );
  }

  // Dev fallback — no portal running.
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
        Dev mode — portal not configured
      </p>
      <p className="text-sm text-slate-500 dark:text-white/45">
        Set <code>VITE_PORTAL_URL</code> or start <code>apps/portal</code> on port 5175.
      </p>
      {hasAdServerAccess && (
        <button
          type="button"
          onClick={() => navigate('/overview')}
          className="rounded-xl bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Go to Ad Server overview
        </button>
      )}
    </div>
  );
}
