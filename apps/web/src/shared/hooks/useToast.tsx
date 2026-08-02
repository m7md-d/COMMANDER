/**
 * Transient feedback.
 *
 * Two live regions, not one (docs/UI-AUDIT.md §3). `polite` waits for a screen
 * reader to finish what it is saying, which is right for "saved" and wrong for
 * "save failed" — a failure announced after the user has moved on is a failure
 * they never heard. Errors therefore go to an assertive region and stay until
 * dismissed, while successes expire on their own.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toastVariants } from "@/shared/lib/motion";
import { useTranslate } from "@/shared/i18n/I18nProvider";

type ToastKind = "success" | "error";

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  notify: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const VISIBLE_MS = 4_000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, kind: ToastKind = "success") => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, kind }]);

      // Errors persist: the user decides when they have read them.
      if (kind === "error") return;

      const timer = setTimeout(() => {
        timers.current.delete(timer);
        dismiss(id);
      }, VISIBLE_MS);
      timers.current.add(timer);
    },
    [dismiss],
  );

  // Timers outlive the component otherwise, and fire into a dead tree (§11).
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region">
        <ToastList
          toasts={toasts.filter((toast) => toast.kind === "success")}
          onDismiss={dismiss}
          role="status"
        />
        <ToastList
          toasts={toasts.filter((toast) => toast.kind === "error")}
          onDismiss={dismiss}
          role="alert"
        />
      </div>
    </ToastContext.Provider>
  );
}

interface ToastListProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
  role: "status" | "alert";
}

function ToastList({ toasts, onDismiss, role }: ToastListProps) {
  const t = useTranslate();

  return (
    <div role={role} aria-live={role === "alert" ? "assertive" : "polite"} className="stack-sm">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            type="button"
            className={`toast toast-${toast.kind}`}
            variants={toastVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            layout
            title={t("action.close")}
            onClick={() => onDismiss(toast.id)}
          >
            {toast.message}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
