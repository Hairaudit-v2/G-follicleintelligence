"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  removeTenantLogoAction,
  uploadTenantLogoAction,
} from "@/lib/actions/fi-branding-actions";
import { TenantLogoPreviewStrip } from "@/src/components/brand/TenantBrandMark";
import type { NormalizedTenantBranding } from "@/src/lib/fi/foundation/tenantBrandingCore";
import { buildNormalizedBrandingCssVariables } from "@/src/lib/fi/foundation/brandingCss";

const inputClass =
  "w-full rounded-lg border border-white/[0.1] bg-[#081020]/85 px-2 py-1.5 text-sm text-[#F8FAFC] file:mr-3 file:rounded-md file:border-0 file:bg-[#141C33] file:px-2 file:py-1 file:text-xs file:text-[#22C1FF]";

export function TenantBrandingLogoUpload({
  tenantId,
  adminKey,
  canEdit,
  branding,
  hasUploadedLogo,
  legacyLogoUrl,
}: {
  tenantId: string;
  adminKey: string;
  canEdit: boolean;
  branding: NormalizedTenantBranding;
  hasUploadedLogo: boolean;
  legacyLogoUrl: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (localPreview?.startsWith("blob:")) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const onUpload = async (file: File | null) => {
    if (!file || !canEdit) return;
    setFeedback(null);
    setBusy(true);
    if (localPreview?.startsWith("blob:")) URL.revokeObjectURL(localPreview);
    setLocalPreview(URL.createObjectURL(file));
    const res = await uploadTenantLogoAction({ tenantId, adminKey, file });
    setBusy(false);
    if (res.ok) {
      setFeedback({ ok: true, text: "Logo uploaded." });
    } else {
      setFeedback({ ok: false, text: res.error });
    }
  };

  const onRemove = async () => {
    if (!canEdit || !hasUploadedLogo) return;
    setFeedback(null);
    setBusy(true);
    const res = await removeTenantLogoAction({ tenantId, adminKey });
    setBusy(false);
    if (res.ok) {
      if (localPreview?.startsWith("blob:")) URL.revokeObjectURL(localPreview);
      setLocalPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      setFeedback({ ok: true, text: "Uploaded logo removed. Legacy URL kept if set." });
    } else {
      setFeedback({ ok: false, text: res.error });
    }
  };

  return (
    <div className="space-y-3">
      <TenantLogoPreviewStrip
        logoUrl={branding.logoUrl}
        displayName={branding.clinicDisplayName}
        localPreviewUrl={localPreview}
      />
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className={inputClass}
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              void onUpload(f);
            }}
          />
          {hasUploadedLogo ? (
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-950/40 disabled:opacity-50"
              onClick={() => void onRemove()}
            >
              Remove uploaded logo
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-[#64748B]">
          Only clinic admins can upload or remove logos. You can still preview branding below.
        </p>
      )}
      {legacyLogoUrl ? (
        <p className="text-xs text-[#64748B]">
          Legacy logo URL is kept as fallback when no upload is present:{" "}
          <code className="break-all text-[#94A3B8]">{legacyLogoUrl}</code>
        </p>
      ) : null}
      {feedback ? (
        <p
          role="status"
          className={`rounded-lg border px-2 py-1.5 text-xs ${
            feedback.ok
              ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-100"
              : "border-rose-500/30 bg-rose-950/40 text-rose-100"
          }`}
        >
          {feedback.text}
        </p>
      ) : null}
    </div>
  );
}

export function TenantBrandingPreviewPanel({
  draft,
}: {
  draft: {
    brandName: string;
    primaryColour: string;
    accentColour: string;
    logoUrl: string | null;
    localLogoPreview?: string | null;
  };
}) {
  const branding = useMemo(
    (): NormalizedTenantBranding => ({
      clinicDisplayName: draft.brandName.trim() || "Clinic preview",
      logoUrl: draft.localLogoPreview || draft.logoUrl,
      logoUrlLegacy: draft.logoUrl,
      logoStoragePath: null,
      logoStorageBucket: null,
      primaryColor: draft.primaryColour,
      secondaryColor: "#9ca3af",
      accentColor: draft.accentColour,
      themeMode: null,
      clinicInitials: draft.brandName.trim().slice(0, 2).toUpperCase() || "CL",
    }),
    [draft]
  );

  const cssVars = buildNormalizedBrandingCssVariables(branding);

  return (
    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-[#081020]/60 p-4" style={cssVars}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Live preview</p>
      <div className="grid gap-4 lg:grid-cols-3">
        <div
          className="rounded-xl border border-white/[0.08] p-3"
          style={{ backgroundColor: "var(--fi-tenant-brand-bg)" }}
        >
          <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-wider text-[#64748B]">
            Sidebar
          </p>
          <div
            className="flex items-center gap-2 rounded-lg border px-2 py-2"
            style={{
              borderColor: "color-mix(in srgb, var(--fi-tenant-accent) 25%, transparent)",
              backgroundColor: "var(--fi-tenant-primary-soft)",
              boxShadow: "inset 3px 0 0 0 var(--fi-tenant-accent)",
            }}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold"
              style={{ color: "var(--fi-tenant-accent)" }}
            >
              {branding.clinicInitials}
            </span>
            <span className="truncate text-sm font-medium text-slate-100">{branding.clinicDisplayName}</span>
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.08] p-3">
          <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-wider text-[#64748B]">
            Primary button
          </p>
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md"
            style={{
              background: `linear-gradient(to right, var(--fi-tenant-primary), var(--fi-tenant-accent))`,
            }}
          >
            Save changes
          </button>
          <p className="mt-3 mb-2 text-[0.65rem] font-bold uppercase tracking-wider text-[#64748B]">
            Selected tab
          </p>
          <div
            className="inline-flex rounded-lg border px-3 py-1.5 text-xs font-medium text-slate-50"
            style={{
              borderColor: "color-mix(in srgb, var(--fi-tenant-accent) 30%, transparent)",
              backgroundColor: "var(--fi-tenant-primary-soft)",
            }}
          >
            Branding
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.08] p-3">
          <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-wider text-[#64748B]">
            Card accent
          </p>
          <div
            className="rounded-lg border-l-4 bg-[#0F1629]/80 p-3"
            style={{ borderLeftColor: "var(--fi-tenant-accent)" }}
          >
            <p className="text-sm font-semibold text-slate-50">{branding.clinicDisplayName}</p>
            <p className="mt-1 text-xs text-slate-400">Support and operational defaults</p>
          </div>
          <div className="mt-3">
            <TenantLogoPreviewStrip
              logoUrl={draft.logoUrl}
              displayName={branding.clinicDisplayName}
              localPreviewUrl={draft.localLogoPreview}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
