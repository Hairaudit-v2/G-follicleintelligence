"use client";

import { AlertTriangle } from "lucide-react";

import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import type { ReceptionOsModuleHealth } from "@/src/lib/receptionOs/receptionOsModuleHealthModel";

export function ReceptionOsModuleHealthPanel({ health }: { health: ReceptionOsModuleHealth }) {
  if (!health.coreBoardLoaded || health.unavailableModules.length === 0) return null;

  return (
    <InfoNotice
      variant="warning"
      title="Feature not available"
    >
      <div className="space-y-2 text-sm">
        <p>
          The front-desk command centre is available. Some add-on modules could not load, usually
          because ReceptionOS migrations are pending or a non-critical query failed.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          {health.unavailableModules.map((item) => (
            <li key={item.module}>
              <span className="font-medium text-slate-100">{item.label}</span>
              <span className="text-slate-400"> — {item.message}</span>
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Apply migrations `20260919120001` through `20260919120004` on production Supabase, then
          redeploy.
        </p>
      </div>
    </InfoNotice>
  );
}
