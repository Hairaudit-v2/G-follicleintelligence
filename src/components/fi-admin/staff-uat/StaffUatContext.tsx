"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import {
  staffUatModuleFromPath,
  type StaffUatScreenKey,
} from "@/src/lib/fiOs/staffUatScreenGuide";
import type { StaffUatFrictionType } from "@/src/lib/fiOs/staffUatFrictionCore";

type StaffUatContextValue = {
  enabled: boolean;
  tenantId: string;
  role: string;
  logFriction: (
    frictionType: StaffUatFrictionType,
    detail?: string | null,
    payload?: Record<string, unknown>,
    screenKey?: StaffUatScreenKey | null
  ) => void;
};

const StaffUatContext = createContext<StaffUatContextValue | null>(null);

async function postTelemetry(
  tenantId: string,
  body: Record<string, unknown>
): Promise<void> {
  try {
    await fetch(`/api/tenants/${tenantId}/staff-uat/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    // best-effort
  }
}

export function StaffUatProvider({
  tenantId,
  role,
  enabled,
  children,
}: {
  tenantId: string;
  role: string;
  enabled: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const prevModuleRef = useRef<string | null>(null);

  const logFriction = useCallback(
    (
      frictionType: StaffUatFrictionType,
      detail?: string | null,
      payload?: Record<string, unknown>,
      screenKey?: StaffUatScreenKey | null
    ) => {
      if (!enabled) return;
      void postTelemetry(tenantId, {
        kind: "friction",
        route: pathname,
        role,
        screenKey: screenKey ?? null,
        frictionType,
        detail: detail ?? null,
        payload,
      });
    },
    [enabled, pathname, role, tenantId]
  );

  useEffect(() => {
    if (!enabled) return;
    const activeModule = staffUatModuleFromPath(pathname);
    const prev = prevModuleRef.current;
    if (prev && prev !== activeModule && prev !== "other" && activeModule !== "other") {
      void postTelemetry(tenantId, {
        kind: "friction",
        route: pathname,
        role,
        frictionType: "navigation_module_bounce",
        detail: `${prev} → ${activeModule}`,
        payload: { fromModule: prev, toModule: activeModule },
      });
    }
    prevModuleRef.current = activeModule;
  }, [enabled, pathname, role, tenantId]);

  const value = useMemo(
    () => ({ enabled, tenantId, role, logFriction }),
    [enabled, tenantId, role, logFriction]
  );

  return <StaffUatContext.Provider value={value}>{children}</StaffUatContext.Provider>;
}

export function useStaffUat(): StaffUatContextValue {
  const ctx = useContext(StaffUatContext);
  return (
    ctx ?? {
      enabled: false,
      tenantId: "",
      role: "staff",
      logFriction: () => {},
    }
  );
}