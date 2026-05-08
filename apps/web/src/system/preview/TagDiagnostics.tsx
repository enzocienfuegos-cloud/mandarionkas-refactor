import React from 'react';
import { cn } from '../cn';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from '../icons';
import { Button } from '../primitives/Button';
import { Panel } from '../primitives/Panel';

export interface TagDiagnosticCheck {
  id: string;
  label: string;
  status: 'ok' | 'warning' | 'error' | 'info';
  message?: string;
  action?: { label: string; onClick: () => void };
}

export interface TagDiagnosticsProps {
  checks: TagDiagnosticCheck[];
  loading?: boolean;
}

const statusIconMap = {
  ok: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
} as const;

const statusColorMap: Record<TagDiagnosticCheck['status'], string> = {
  ok: 'text-[color:var(--dusk-status-success-fg)]',
  warning: 'text-[color:var(--dusk-status-warning-fg)]',
  error: 'text-[color:var(--dusk-status-critical-fg)]',
  info: 'text-[color:var(--dusk-status-info-fg)]',
};

const statusBorderMap: Record<TagDiagnosticCheck['status'], string> = {
  ok: 'border-[color:var(--dusk-status-success-border)]/60',
  warning: 'border-[color:var(--dusk-status-warning-border)]/60',
  error: 'border-[color:var(--dusk-status-critical-border)]/80',
  info: 'border-border-subtle',
};

export function TagDiagnostics({ checks, loading = false }: TagDiagnosticsProps) {
  if (loading) {
    return <Panel className="text-sm text-text-muted">Running diagnostics…</Panel>;
  }

  return (
    <Panel className="space-y-3">
      {checks.map((check) => {
        const Icon = statusIconMap[check.status];
        return (
          <div
            key={check.id}
            className={cn(
              'flex items-start gap-3 rounded-xl border bg-surface-muted px-3 py-3',
              statusBorderMap[check.status],
            )}
          >
            <Icon className={cn('mt-0.5 h-4 w-4', statusColorMap[check.status])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary">{check.label}</p>
              {check.message ? <p className="mt-1 text-sm text-text-muted">{check.message}</p> : null}
            </div>
            {check.action ? (
              <Button size="sm" variant="ghost" onClick={check.action.onClick}>
                {check.action.label}
              </Button>
            ) : null}
          </div>
        );
      })}
    </Panel>
  );
}
