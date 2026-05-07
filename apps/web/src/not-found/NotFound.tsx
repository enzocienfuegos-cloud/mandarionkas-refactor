import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft, LayoutDashboard } from '../system/icons';
import { Panel, Button, Kicker } from '../system';

/**
 * 404 page — refactored to the design system.
 *
 * Renders inside the app shell (so the sidebar is still visible).
 */
export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="max-w-xl mx-auto py-20">
      <Panel padding="lg" elevation={3} className="text-center">
        <div
          className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-6"
          style={{ background: 'var(--dusk-brand-gradient)' }}
          aria-hidden
        >
          <Compass className="h-8 w-8 text-text-inverse" />
        </div>

        <Kicker>404</Kicker>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-[color:var(--dusk-text-muted)]">
          The page you were looking for doesn't exist, or you don't have access.
          Try one of the destinations below.
        </p>

        <div className="mt-6 flex items-center justify-center gap-2">
          <Button variant="secondary" leadingIcon={<ArrowLeft />} onClick={() => navigate(-1)}>
            Go back
          </Button>
          <Button variant="primary" leadingIcon={<LayoutDashboard />} onClick={() => navigate('/overview')}>
            Overview
          </Button>
        </div>

        <p className="mt-6 text-xs text-[color:var(--dusk-text-soft)]">
          Tip: press <kbd className="dusk-mono px-1 py-0.5 rounded border border-[color:var(--dusk-border-default)] bg-surface-muted text-[10px]">⌘ K</kbd> to search for any page.
        </p>
      </Panel>
    </div>
  );
}
