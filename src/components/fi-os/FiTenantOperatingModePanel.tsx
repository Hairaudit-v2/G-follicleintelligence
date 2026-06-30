"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { saveTenantFiOsOperatingModeAction } from "@/lib/actions/fi-tenant-operating-mode-actions";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import {
  buildFiOsOperatingModePreviewLine,
  FI_OS_OPERATING_MODE_PREVIEW_FOOTER,
  FI_TENANT_OPERATING_MODE_UI_OPTIONS,
} from "@/src/config/fiTenantOperatingModeUi";

const inputClass =
  "w-full rounded-lg border border-white/[0.1] bg-[#081020]/85 px-2 py-1.5 text-sm text-[#F8FAFC] shadow-inner outline-none transition placeholder:text-[#475569] focus:border-[#22C1FF]/45 focus:ring-2 focus:ring-[#22C1FF]/20";

const saveButtonClass =
  "mt-3 rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition hover:from-cyan-500 hover:to-sky-500 disabled:opacity-50";

export function FiTenantOperatingModePanel({
  tenantId,
  currentModeKey,
  adminKey,
}: {
  tenantId: string;
  currentModeKey: string | null;
  adminKey: string;
}) {
  const router = useRouter();
  const [selection, setSelection] = useState<string>(currentModeKey?.trim() || "full_fi_os");
  const [busy, setBusy] = useState(false);
  const [fb, setFb] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setSelection(currentModeKey?.trim() || "full_fi_os");
  }, [currentModeKey]);

  const previewLine = useMemo(() => buildFiOsOperatingModePreviewLine(selection), [selection]);

  return (
    <DashboardCard elevated className="border-cyan-500/20 bg-[#0c1426]/80 p-4 sm:p-5">
      <h2 className="text-base font-semibold tracking-tight text-[#F8FAFC]">Operating mode</h2>
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-[#94A3B8] sm:text-sm">
        This sets <strong className="text-[#E2E8F0]">tenant defaults</strong> for FI OS Stage 3.5.
        Staff-level overrides and templates still win.{" "}
        <span className="text-amber-200/90">This does not mass-update staff rows.</span>
      </p>

      <div className="mt-4 space-y-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[#94A3B8]">Mode</span>
          <select
            className={inputClass}
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
          >
            {FI_TENANT_OPERATING_MODE_UI_OPTIONS.map((o) => (
              <option key={o.modeKey} value={o.modeKey}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {FI_TENANT_OPERATING_MODE_UI_OPTIONS.filter((o) => o.modeKey === selection).map((o) => (
          <div
            key={o.modeKey}
            className="rounded-lg border border-white/[0.06] bg-[#081020]/60 p-3 text-xs text-[#94A3B8]"
          >
            <p className="font-medium text-[#CBD5E1]">{o.label}</p>
            <p className="mt-2 leading-relaxed">{o.description}</p>
            <p className="mt-2 text-[#64748B]">
              <span className="font-semibold text-[#94A3B8]">Default modules: </span>
              {o.defaultModulesLine}
            </p>
          </div>
        ))}

        <div className="rounded-lg border border-white/[0.06] bg-[#081020]/50 p-3 text-xs leading-relaxed text-[#94A3B8]">
          <p className="text-[#E2E8F0]">{previewLine}</p>
          <p className="mt-2 text-[#64748B]">{FI_OS_OPERATING_MODE_PREVIEW_FOOTER}</p>
        </div>

        <button
          type="button"
          disabled={busy}
          className={saveButtonClass}
          onClick={async () => {
            setFb(null);
            setBusy(true);
            const res = await saveTenantFiOsOperatingModeAction({
              adminKey,
              tenantId,
              modeKey: selection,
            });
            setBusy(false);
            if (res.ok) {
              const extra = "auditWarning" in res && res.auditWarning ? ` ${res.auditWarning}` : "";
              setFb({ ok: true, text: `Operating mode saved.${extra}` });
              router.refresh();
            } else {
              setFb({ ok: false, text: res.error });
            }
          }}
        >
          {busy ? "Saving…" : "Save operating mode"}
        </button>

        {fb ? (
          <p
            role="status"
            className={`text-xs ${fb.ok ? "text-emerald-200/90" : "text-rose-200/90"}`}
          >
            {fb.text}
          </p>
        ) : null}
      </div>
    </DashboardCard>
  );
}
