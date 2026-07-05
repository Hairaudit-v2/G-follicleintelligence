"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  removeTenantLogoAction,
  uploadTenantLogoAction,
} from "@/lib/actions/fi-branding-actions";
import { TenantLogoPreviewStrip } from "@/src/components/brand/TenantBrandMark";
import type { NormalizedTenantBranding } from "@/src/lib/fi/foundation/tenantBrandingCore";
import { buildNormalizedBrandingCssVariables, safeBrandingColourHex } from "@/src/lib/fi/foundation/brandingCss";

const inputClass =
  "w-full rounded-lg border border-white/[0.1] bg-[#081020]/85 px-2 py-1.5 text-sm text-[#F8FAFC] file:mr-3 file:rounded-md file:border-0 file:bg-[#141C33] file:px-2 file:py-1 file:text-xs file:text-[#22C1FF] disabled:opacity-50";

export function TenantBrandingLogoUpload({
  tenantId,
  adminKey,
  canEdit,
  branding,
  hasUploadedLogo,
  legacyLogoUrl,
  onLocalPreviewChange,
  onRevalidated,
}: {
  tenantId: string;
  adminKey: string;
  canEdit: boolean;
  branding: NormalizedTenantBranding;
  hasUploadedLogo: boolean;
  legacyLogoUrl: string | null;
  onLocalPreviewChange?: (url: string | null) => void;
  onRevalidated?: () => void;
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

  useEffect(() => {
    onLocalPreviewChange?.(localPreview);
  }, [localPreview, onLocalPreviewChange]);

  const setPreview = (url: string | null) => {
    if (localPreview?.startsWith("blob:")) URL.revokeObjectURL(localPreview);
    setLocalPreview(url);
  };

  const onUpload = async (file: File | null) => {
    if (!file) return;
    if (!canEdit) {
      setFeedback({
        ok: false,
        text: "You do not have permission to update branding.",
      });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFeedback({
        ok: false,
        text: `Logo must be 2MB or smaller (selected file is ${(file.size / (1024 * 1024)).toFixed(1)}MB). Nothing was uploaded.`,
      });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setFeedback(null);
    setBusy(true);
    setPreview(URL.createObjectURL(file));
    try {
      // Server Actions reject non-serializable payloads (a File nested inside a
      // plain object throws "Only plain objects ... can be passed to Server
      // Actions"). Append the File directly to FormData instead.
      const formData = new FormData();
      formData.append("tenantId", tenantId);
      if (adminKey) formData.append("adminKey", adminKey);
      formData.append("logo", file);
      const res = await uploadTenantLogoAction(formData);
      if (res.ok) {
        setFeedback({ ok: true, text: res.message });
        setPreview(null);
        if (fileRef.current) fileRef.current.value = "";
        onRevalidated?.();
      } else {
        setPreview(null);
        setFeedback({ ok: false, text: res.error });
      }
    } catch (err) {
      // Server action threw before returning (e.g. request body over the
      // action transport limit, network drop). Distinct from a storage or
      // settings-save failure, which return { ok: false } above.
      setPreview(null);
      setFeedback({
        ok: false,
        text: `Upload request failed before completing: ${
          err instanceof Error ? err.message : "unknown error"
        }. Nothing was saved.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async () => {
    if (!canEdit) {
      setFeedback({
        ok: false,
        text: "You do not have permission to update branding.",
      });
      return;
    }
    if (!hasUploadedLogo) return;
    setFeedback(null);
    setBusy(true);
    try {
      const res = await removeTenantLogoAction({ tenantId, adminKey });
      if (res.ok) {
        setPreview(null);
        if (fileRef.current) fileRef.current.value = "";
        setFeedback({ ok: true, text: "Uploaded logo removed. Legacy URL kept if set." });
        onRevalidated?.();
      } else {
        setFeedback({ ok: false, text: res.error });
      }
    } catch (err) {
      setFeedback({
        ok: false,
        text: `Remove request failed before completing: ${
          err instanceof Error ? err.message : "unknown error"
        }. Nothing was changed.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const displayLogoUrl = localPreview ?? branding.logoUrl;

  return (
    <div className="space-y-3">
      <TenantLogoPreviewStrip
        logoUrl={displayLogoUrl}
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
      primaryColor: safeBrandingColourHex(draft.primaryColour, "#4b5563"),
      secondaryColor: "#9ca3af",
      accentColor: safeBrandingColourHex(draft.accentColour, "#2563eb"),
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
