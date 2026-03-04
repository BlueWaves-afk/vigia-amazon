'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, X, Info, Zap } from 'lucide-react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type ToastKind = 'success' | 'error' | 'warning' | 'info' | 'hazard';

export interface ToastData {
  id:       string;
  kind:     ToastKind;
  title:    string;
  message?: string;
  duration?: number;   // ms, default 4000
}

// ─────────────────────────────────────────────
// Global event bus — no context needed
// Components call toast.fire() from anywhere
// ─────────────────────────────────────────────

const TOAST_EVENT = 'vigia-toast';

export const toast = {
  fire: (data: Omit<ToastData, 'id'>) => {
    window.dispatchEvent(new CustomEvent(TOAST_EVENT, {
      detail: { ...data, id: crypto.randomUUID() }
    }));
  },
  success: (title: string, message?: string) =>
    toast.fire({ kind: 'success', title, message }),
  error:   (title: string, message?: string) =>
    toast.fire({ kind: 'error', title, message }),
  warning: (title: string, message?: string) =>
    toast.fire({ kind: 'warning', title, message }),
  info:    (title: string, message?: string) =>
    toast.fire({ kind: 'info', title, message }),
  hazard:  (title: string, message?: string) =>
    toast.fire({ kind: 'hazard', title, message, duration: 6000 }),
};

// ─────────────────────────────────────────────
// Icon + color per kind
// ─────────────────────────────────────────────

const KIND_META: Record<ToastKind, { icon: React.ReactNode; color: string }> = {
  success: { icon: <CheckCircle  size={14} />, color: 'var(--c-green)'  },
  error:   { icon: <AlertTriangle size={14}/>, color: 'var(--c-red)'    },
  warning: { icon: <AlertTriangle size={14}/>, color: 'var(--c-yellow)' },
  info:    { icon: <Info size={14} />,         color: 'var(--c-rose-2)' },
  hazard:  { icon: <Zap  size={14} />,         color: 'var(--c-red)'    },
};

// ─────────────────────────────────────────────
// Single toast item
// ─────────────────────────────────────────────

function ToastItem({ data, onRemove }: { data: ToastData; onRemove: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);
  const { icon, color } = KIND_META[data.kind];

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onRemove(data.id), 180);
  }, [data.id, onRemove]);

  useEffect(() => {
    const t = setTimeout(dismiss, data.duration ?? 4000);
    return () => clearTimeout(t);
  }, [dismiss, data.duration]);

  return (
    <div
      className={`toast toast-${data.kind} ${exiting ? 'toast-exit' : ''}`}
      onClick={dismiss}
    >
      {/* Icon */}
      <span style={{ color, flexShrink: 0, marginTop: 1 }}>{icon}</span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 500,
          color: 'var(--c-text)',
          fontSize: '0.76rem',
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          lineHeight: 1.4,
        }}>
          {data.title}
        </div>
        {data.message && (
          <div style={{
            color: 'var(--c-text-2)',
            fontSize: '0.68rem',
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            marginTop: 2,
            lineHeight: 1.5,
          }}>
            {data.message}
          </div>
        )}
      </div>

      {/* Close */}
      <button
        onClick={(e) => { e.stopPropagation(); dismiss(); }}
        style={{
          background: 'none', border: 'none',
          color: 'var(--c-text-3)', cursor: 'pointer',
          display: 'flex', flexShrink: 0, padding: 2,
          transition: 'color 0.12s',
        }}
        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--c-text)'}
        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--c-text-3)'}
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Toast container — mount once in layout/page
// ─────────────────────────────────────────────

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent).detail as ToastData;
      setToasts(prev => [...prev.slice(-4), data]); // max 5 visible
    };
    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div id="vigia-toast-root">
      {toasts.map(t => (
        <ToastItem key={t.id} data={t} onRemove={remove} />
      ))}
    </div>
  );
}
