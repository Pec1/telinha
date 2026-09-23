import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type ToastKind } from '../context/toast';
import { CloseIcon } from './icons';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const kindClasses: Record<ToastKind, string> = {
  info: 'border-border bg-surface-2 text-fg',
  success: 'border-success/40 bg-surface-2 text-fg',
  error: 'border-danger/50 bg-surface-2 text-fg',
};

const kindDot: Record<ToastKind, string> = {
  info: 'bg-accent',
  success: 'bg-success',
  error: 'bg-danger',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId.current++;
      setToasts((ts) => [...ts.slice(-3), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-auto sm:left-auto sm:right-4 sm:top-16 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex max-w-sm items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg shadow-black/40 ${kindClasses[t.kind]}`}
          >
            <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${kindDot[t.kind]}`} />
            <p className="flex-1">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Fechar aviso"
              className="rounded text-muted hover:text-fg"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
