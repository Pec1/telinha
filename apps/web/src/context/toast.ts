import { createContext, useContext } from 'react';

export type ToastKind = 'info' | 'success' | 'error';

export interface ToastApi {
  show: (message: string, kind?: ToastKind) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast fora de ToastProvider');
  return api;
}
