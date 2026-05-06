import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, Close } from '../icons';
import { cn } from '../cn';

export type ToastTone = 'success' | 'warning' | 'critical' | 'info' | 'neutral';

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Time in ms before auto-dismiss. 0 = persistent. Default 4500. */
  duration?: number;
  /** Optional action button */
  action?: { label: string; onClick: () => void };
}

interface Toast extends Required<Omit<ToastOptions, 'description' | 'action'>> {
  id: string;
  description?: string;
  action?: ToastOptions['action'];
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

/**
 * Mount once at the root of the app (in App.tsx).
 *
 * @example
 *   <ToastProvider>
 *     <App />
 *   </ToastProvider>
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (opts: ToastOptions) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const next: Toast = {
        id,
        title: opts.title,
        description: opts.description,
        tone: opts.tone ?? 'neutral',
        duration: opts.duration ?? 4500,
        action: opts.action,
      };
      setToasts((current) => [...current, next]);

      if (next.duration > 0) {
        const timer = setTimeout(() => dismiss(id), next.duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismiss],
  );

  // Cleanup pending timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const toneIconMap: Record<ToastTone, React.ComponentType<{ className?: string }>> = {
  success:  CheckCircle2,
  warning:  AlertTriangle,
  critical: AlertCircle,
  info:     Info,
  neutral:  Info,
};

const toneClassMap: Record<ToastTone, string> = {
  success:  'border-[color:var(--dusk-status-success-border)] [&_[data-tone-icon]]:text-[color:var(--dusk-status-success-fg)]',
  warning:  'border-[color:var(--dusk-status-warning-border)] [&_[data-tone-icon]]:text-[color:var(--dusk-status-warning-fg)]',
  critical: 'border-[color:var(--dusk-status-critical-border)] [&_[data-tone-icon]]:text-[color:var(--dusk-status-critical-fg)]',
  info:     'border-[color:var(--dusk-status-info-border)]     [&_[data-tone-icon]]:text-[color:var(--dusk-status-info-fg)]',
  neutral:  'border-[color:var(--dusk-border-default)]         [&_[data-tone-icon]]:text-[color:var(--dusk-text-muted)]',
};

function ToastViewport({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-toast flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => {
        const Icon = toneIconMap[t.tone];
        return (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={cn(
              'pointer-events-auto flex w-80 max-w-full items-start gap-3 rounded-xl border bg-surface-1 shadow-overlay px-4 py-3',
              'animate-[duskToastIn_240ms_var(--dusk-ease-enter)]',
              toneClassMap[t.tone],
            )}
          >
            <span data-tone-icon className="shrink-0 mt-0.5">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[color:var(--dusk-text-primary)]">
                {t.title}
              </p>
              {t.description && (
                <p className="mt-1 text-xs text-[color:var(--dusk-text-muted)] leading-snug">
                  {t.description}
                </p>
              )}
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                  className="mt-2 text-xs font-semibold text-text-brand hover:underline"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 -mt-0.5 -mr-1 rounded-md p-1 text-[color:var(--dusk-text-soft)] hover:text-[color:var(--dusk-text-primary)]"
              aria-label="Dismiss notification"
            >
              <Close className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

      <style>{`
        @keyframes duskToastIn {
          from { opacity: 0; transform: translateY(8px) }
          to   { opacity: 1; transform: translateY(0)   }
        }
      `}</style>
    </div>
  );
}
