// apps/web/src/shell/ProductLauncher.tsx
//
// S43: Simplified to redirect-only. Product access decisions are made
// exclusively in apps/portal/src/App.tsx (PortalHome), not here.
//
// Logic:
//   - Any user with Ad Server access (admins included) → /overview directly.
//   - Users without Ad Server access → redirect to portal, which remains the
//     cross-product selector and can route them into Studio.
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
  if (import.meta.env.DEV) return 'http://localhost:5175';
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (hostname.startsWith('app-')) {
      return `${protocol}//${hostname.replace(/^app-/, 'portal-')}`;
    }
  }
  return '';
}

export default function ProductLauncher() {
  const navigate = useNavigate();
  const { user } = useOutletContext<{ user?: ShellUser }>();

  const access = user?.workspace?.productAccess ?? { ad_server: true, studio: true };
  const hasAdServerAccess = access.ad_server !== false;
  const portalUrl = getPortalUrl();

  useEffect(() => {
    // If this user can operate Ad Server, the web app root should resolve
    // into Ad Server itself, not bounce them back to the portal.
    if (hasAdServerAccess) {
      navigate('/overview', { replace: true });
      return;
    }
    // No Ad Server access → hand back to the canonical portal launcher.
    if (portalUrl) {
      window.location.assign(portalUrl);
    }
  }, [hasAdServerAccess, navigate, portalUrl]);

  // Ad Server-capable users navigate directly into the product.
  if (hasAdServerAccess) return null;

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
