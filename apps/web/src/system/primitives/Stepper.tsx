import React from 'react';
import { Badge, type BadgeTone } from './Badge';
import { CheckCircle2, AlertTriangle, CircleDot, Lock } from '../icons';
import { cn } from '../cn';

export type StepStatus = 'complete' | 'current' | 'upcoming' | 'warning' | 'blocked';

export interface Step {
  id: string;
  label: string;
  status: StepStatus;
  description?: string;
  badge?: { label: string; tone: BadgeTone };
}

export interface StepperProps {
  steps: Step[];
  orientation?: 'horizontal' | 'vertical';
  onStepClick?: (stepId: string) => void;
}

const STATUS_STYLES: Record<StepStatus, { dot: string; line: string; text: string }> = {
  complete: {
    dot: 'border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)] text-[color:var(--dusk-status-success-fg)]',
    line: 'bg-[color:var(--dusk-status-success-border)]',
    text: 'text-[color:var(--dusk-text-primary)]',
  },
  current: {
    dot: 'border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)]',
    line: 'bg-[color:var(--dusk-status-info-border)]',
    text: 'text-[color:var(--dusk-text-primary)]',
  },
  upcoming: {
    dot: 'border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-2)] text-[color:var(--dusk-text-muted)]',
    line: 'bg-[color:var(--dusk-border-subtle)]',
    text: 'text-[color:var(--dusk-text-secondary)]',
  },
  warning: {
    dot: 'border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)]',
    line: 'bg-[color:var(--dusk-status-warning-border)]',
    text: 'text-[color:var(--dusk-text-primary)]',
  },
  blocked: {
    dot: 'border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] text-[color:var(--dusk-text-muted)]',
    line: 'bg-[color:var(--dusk-border-subtle)]',
    text: 'text-[color:var(--dusk-text-muted)]',
  },
};

function StepStatusIcon({ status }: { status: StepStatus }) {
  if (status === 'complete') return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
  if (status === 'warning') return <AlertTriangle className="h-4 w-4" aria-hidden="true" />;
  if (status === 'blocked') return <Lock className="h-4 w-4" aria-hidden="true" />;
  return <CircleDot className="h-4 w-4" aria-hidden="true" />;
}

export function Stepper({
  steps,
  orientation = 'vertical',
  onStepClick,
}: StepperProps) {
  const vertical = orientation === 'vertical';

  return (
    <ol
      className={cn(
        vertical ? 'space-y-3' : 'flex flex-wrap gap-3',
      )}
      aria-label="Workflow steps"
    >
      {steps.map((step, index) => {
        const styles = STATUS_STYLES[step.status];
        const interactive = Boolean(onStepClick) && step.status !== 'blocked';
        const isLast = index === steps.length - 1;
        const ContentTag = interactive ? 'button' : 'div';

        return (
          <li
            key={step.id}
            className={cn(vertical ? 'relative pl-12' : 'min-w-[11rem] flex-1')}
          >
            {vertical && !isLast ? (
              <span
                aria-hidden="true"
                className={cn('absolute left-[1.15rem] top-9 h-[calc(100%-1.1rem)] w-px', styles.line)}
              />
            ) : null}

            <span
              aria-hidden="true"
              className={cn(
                vertical ? 'absolute left-0 top-0' : 'mb-2 inline-flex',
                'inline-flex h-9 w-9 items-center justify-center rounded-full border',
                styles.dot,
              )}
            >
              <StepStatusIcon status={step.status} />
            </span>

            <ContentTag
              type={interactive ? 'button' : undefined}
              onClick={interactive ? () => onStepClick?.(step.id) : undefined}
              className={cn(
                'w-full rounded-xl border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-1)] px-4 py-3 text-left transition-colors',
                interactive
                  ? 'hover:border-[color:var(--dusk-border-strong)] hover:bg-[color:var(--dusk-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--dusk-status-info-border)]'
                  : '',
              )}
              aria-current={step.status === 'current' ? 'step' : undefined}
              disabled={interactive ? false : undefined}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('text-sm font-semibold', styles.text)}>{step.label}</span>
                {step.badge ? <Badge tone={step.badge.tone} size="sm">{step.badge.label}</Badge> : null}
              </div>
              {step.description ? (
                <p className="mt-1 text-xs text-[color:var(--dusk-text-muted)]">{step.description}</p>
              ) : null}
            </ContentTag>
          </li>
        );
      })}
    </ol>
  );
}
