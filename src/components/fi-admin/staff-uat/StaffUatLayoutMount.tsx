"use client";

import type { ReactNode } from "react";

import { StaffUatProvider } from "./StaffUatContext";

export function StaffUatLayoutMount({
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
  if (!enabled) return <>{children}</>;
  return (
    <StaffUatProvider tenantId={tenantId} role={role} enabled={enabled}>
      {children}
    </StaffUatProvider>
  );
}