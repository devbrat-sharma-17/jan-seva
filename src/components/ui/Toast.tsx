// ============================================================
// Toast — Transient feedback channel
// ============================================================
// Actions like "copy tracking link", "update requested" and, critically,
// "your report could not be saved" previously had nowhere to surface.
// Failures were logged to the console and the citizen saw success.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import './Toast.css';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  /** Errors stay until dismissed; everything else auto-dismisses. */
  sticky: boolean;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextId.current;
    nextId.current += 1;
    const sticky = tone === 'error';

    // Cap the stack so a burst of sync events cannot bury the page.
    setToasts((prev) => [...prev.slice(-2), { id, message, tone, sticky }]);

    if (!sticky) {
      timers.current.set(
        id,
        setTimeout(() => dismissToast(id), AUTO_DISMISS_MS)
      );
    }
  }, [dismissToast]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/*
        `polite` rather than `assertive`: these announcements should not
        interrupt a screen reader mid-sentence during form entry.
      */}
      <div className="toast-stack" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            <ToastIcon tone={toast.tone} />
            <span className="toast__message">{toast.message}</span>
            <button
              type="button"
              className="toast__dismiss"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className: 'toast__icon',
  };

  if (tone === 'success') {
    return (
      <svg {...common}>
        <path d="M20 6L9 17l-5-5" />
      </svg>
    );
  }
  if (tone === 'error' || tone === 'warning') {
    return (
      <svg {...common}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside a <ToastProvider>.');
  }
  return ctx;
}
