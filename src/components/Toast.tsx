import { motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

const iconMap = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: 'bg-pet-mint text-white border-pet-mintDark/30',
  error: 'bg-pet-coral text-white border-pet-coralDark/30',
  warning: 'bg-pet-amber text-pet-slate border-pet-amber/50',
  info: 'bg-pet-slate text-white border-pet-slateLight/30',
};

interface ToastProps {
  toast: ToastData;
  onClose: (id: string) => void;
}

export function Toast({ toast, onClose }: ToastProps) {
  const [leaving, setLeaving] = useState(false);
  const Icon = iconMap[toast.type];

  useEffect(() => {
    const t = setTimeout(() => setLeaving(true), (toast.duration ?? 3500) - 200);
    const t2 = setTimeout(() => onClose(toast.id), toast.duration ?? 3500);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [toast.id, toast.duration, onClose]);

  return (
    <motion.li
      layout
      initial={{ x: 40, opacity: 0, scale: 0.95 }}
      animate={{ x: 0, opacity: leaving ? 0 : 1, scale: leaving ? 0.95 : 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      className={cn(
        'min-w-[280px] max-w-sm rounded-2xl shadow-soft border px-4 py-3 flex items-start gap-3',
        colorMap[toast.type]
      )}
    >
      <Icon size={20} className="mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-tight">{toast.title}</p>
        {toast.message && <p className="text-xs mt-1 opacity-90">{toast.message}</p>}
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="opacity-80 hover:opacity-100 transition-opacity -m-1 p-1 rounded-lg hover:bg-white/20"
      >
        <X size={14} />
      </button>
    </motion.li>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <ul className="fixed top-20 right-4 sm:right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <Toast toast={t} onClose={onClose} />
        </div>
      ))}
    </ul>
  );
}

interface ToastContextValue {
  push: (t: Omit<ToastData, 'id'>) => string;
}

import { createContext, useCallback, useContext } from 'react';

const ToastCtx = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export { ToastCtx };
