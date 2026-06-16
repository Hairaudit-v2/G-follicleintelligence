"use client";

import { createContext, useContext } from "react";

import type { OperationalCalendarGridPatch } from "@/src/lib/calendar/operationalCalendarTypes";

export type OperationalCalendarStreamContextValue = {
  applyGridPatch: (patch: OperationalCalendarGridPatch) => void;
};

const OperationalCalendarStreamContext = createContext<OperationalCalendarStreamContextValue | null>(null);

export function OperationalCalendarStreamProvider({
  value,
  children,
}: {
  value: OperationalCalendarStreamContextValue;
  children: React.ReactNode;
}) {
  return (
    <OperationalCalendarStreamContext.Provider value={value}>{children}</OperationalCalendarStreamContext.Provider>
  );
}

export function useOperationalCalendarStream(): OperationalCalendarStreamContextValue | null {
  return useContext(OperationalCalendarStreamContext);
}
