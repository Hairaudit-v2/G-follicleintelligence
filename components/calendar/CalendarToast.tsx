"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type ToastTone = "success" | "error";

type ToastItem = {
  id: number;
  tone: ToastTone;
  message: string;
  action?: { label: string; onClick: () => void };
};

type CalendarToastContextValue = {
  success: (message: string, action?: { label: string; onClick: () => void }) => void;
  error: (message: string) => void;
};

const CalendarToastContext = createContext<CalendarToastContextValue | null>(null);

export function useCalendarToast(): CalendarToastContextValue {
  const ctx = useContext(CalendarToastContext);
  if (!ctx) {
    throw new Error("useCalendarToast must be used within CalendarToastProvider");
  }
  return ctx;
}

export function useCalendarToastOptional(): CalendarToastContextValue | null {
  return useContext(CalendarToastContext);
}

export function CalendarToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((items) => items.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string, action?: ToastItem["action"]) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((items) => [...items.slice(-2), { id, tone, message, action }]);
      const ttl = tone === "success" ? (action ? 12_000 : 3200) : 5200;
      window.setTimeout(() => dismiss(id), ttl);
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      success: (message: string, action?: ToastItem["action"]) => push("success", message, action),
      error: (message: string) => push("error", message),
    }),
    [push]
  );

  return (
    <CalendarToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(100vw-2rem,20rem)] flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2 rounded-xl border px-3 py-2.5 shadow-lg backdrop-blur-sm transition-all animate-in slide-in-from-bottom-2 fade-in",
              toast.tone === "success"
                ? "border-emerald-200/90 bg-emerald-50/95 text-emerald-950"
                : "border-rose-200/90 bg-rose-50/95 text-rose-950"
            )}
            role="status"
          >
            {toast.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />
            )}
            <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{toast.message}</p>
            {toast.action ? (
              <button
                type="button"
                className="shrink-0 rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
                onClick={() => {
                  toast.action?.onClick();
                  dismiss(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded-md p-0.5 opacity-70 transition hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </CalendarToastContext.Provider>
  );
}
