"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { SurgeryBookingWizard } from "./SurgeryBookingWizard";
import type { SurgeryBookingWizardPrefill } from "@/src/lib/surgeryBooking/surgeryBookingTypes";

type SurgeryBookingWizardContextValue = {
  openSurgeryBooking: (prefill: SurgeryBookingWizardPrefill) => void;
  closeSurgeryBooking: () => void;
};

const SurgeryBookingWizardCtx = createContext<SurgeryBookingWizardContextValue | null>(null);

export function useSurgeryBookingWizardOptional(): SurgeryBookingWizardContextValue | null {
  return useContext(SurgeryBookingWizardCtx);
}

export function SurgeryBookingWizardProvider({
  tenantId,
  children,
}: {
  tenantId: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<SurgeryBookingWizardPrefill>({});

  const openSurgeryBooking = useCallback((next: SurgeryBookingWizardPrefill) => {
    setPrefill(next);
    setOpen(true);
  }, []);

  const closeSurgeryBooking = useCallback(() => {
    setOpen(false);
  }, []);

  const value = useMemo(
    () => ({ openSurgeryBooking, closeSurgeryBooking }),
    [openSurgeryBooking, closeSurgeryBooking]
  );

  return (
    <SurgeryBookingWizardCtx.Provider value={value}>
      {children}
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
          >
            <div className="flex justify-end border-b border-white/10 px-4 py-2">
              <button
                type="button"
                onClick={closeSurgeryBooking}
                className="text-sm text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>
            <SurgeryBookingWizard
              tenantId={tenantId}
              prefill={prefill}
              onClose={closeSurgeryBooking}
            />
          </div>
        </div>
      ) : null}
    </SurgeryBookingWizardCtx.Provider>
  );
}