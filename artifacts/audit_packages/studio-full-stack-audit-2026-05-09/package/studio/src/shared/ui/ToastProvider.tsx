import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { IconButton } from './IconButton';
import { StudioIcon, StudioIcons } from './icons';

type ToastTone = 'info' | 'success' | 'danger';

type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
};

type ToastRecord = ToastInput & {
  id: number;
  tone: ToastTone;
};

type ToastContextValue = {
  pushToast(input: ToastInput): void;
  dismissToast(id: number): void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextToastIdRef = useRef(1);
  const timeoutIdsRef = useRef(new Map<number, ReturnType<typeof globalThis.setTimeout>>());

  const dismissToast = useCallback((id: number) => {
    const timeoutId = timeoutIdsRef.current.get(id);
    if (timeoutId) {
      globalThis.clearTimeout(timeoutId);
      timeoutIdsRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((input: ToastInput) => {
    const id = nextToastIdRef.current++;
    const toast: ToastRecord = {
      id,
      tone: input.tone ?? 'info',
      title: input.title,
      description: input.description,
      durationMs: input.durationMs,
    };

    setToasts((current) => [...current, toast]);
    const timeoutId = globalThis.setTimeout(() => dismissToast(id), input.durationMs ?? 4200);
    timeoutIdsRef.current.set(id, timeoutId);
  }, [dismissToast]);

  useEffect(() => () => {
    timeoutIdsRef.current.forEach((timeoutId) => {
      globalThis.clearTimeout(timeoutId);
    });
    timeoutIdsRef.current.clear();
  }, []);

  const value = useMemo(() => ({
    pushToast,
    dismissToast,
  }), [dismissToast, pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-card toast-card--${toast.tone}`} role="status">
            <div className="toast-card__content">
              <strong>{toast.title}</strong>
              {toast.description ? <span>{toast.description}</span> : null}
            </div>
            <IconButton
              variant="ghost"
              size="sm"
              className="toast-card__dismiss"
              label="Dismiss notification"
              showTooltip={false}
              icon={<StudioIcon icon={StudioIcons.x} size={14} />}
              onClick={() => dismissToast(toast.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
