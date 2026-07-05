"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  clearTenantLegacyLogoUrlAction,
  removeTenantLogoAction,
  uploadTenantLogoAction,
} from "@/lib/actions/fi-branding-actions";
import { TenantLogoPreviewStrip } from "@/src/components/brand/TenantBrandMark";
import type { NormalizedTenantBranding } from "@/src/lib/fi/foundation/tenantBrandingCore";
import { TENANT_BRANDING_LOGO_FALLBACK_ORDER } from "@/src/lib/fi/foundation/tenantBrandingFormCore";
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
        setFeedback({
          ok: true,
          text: legacyLogoUrl
            ? "Uploaded logo removed. Now falling back to the legacy logo URL."
            : "Uploaded logo removed. Now falling back to clinic initials.",
        });
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

  const onClearLegacy = async () => {
    if (!canEdit) {
      setFeedback({
        ok: false,
        text: "You do not have permission to update branding.",
      });
      return;
    }
    if (!legacyLogoUrl) return;
    setFeedback(null);
    setBusy(true);
    try {
      const res = await clearTenantLegacyLogoUrlAction({ tenantId, adminKey });
      if (res.ok) {
        setFeedback({
          ok: true,
          text: hasUploadedLogo
            ? "Legacy logo URL cleared. The uploaded logo remains active."
            : "Legacy logo URL cleared. Now falling back to clinic initials.",
        });
        onRevalidated?.();
      } else {
        setFeedback({ ok: false, text: res.error });
      }
    } catch (err) {
      setFeedback({
        ok: false,
        text: `Clear request failed before completing: ${
          err instanceof Error ? err.message : "unknown error"
        }. Nothing was changed.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const displayLogoUrl = localPreview ?? branding.logoUrl;
  const removeUploadedEnabled = !busy && hasUploadedLogo;
  const clearLegacyEnabled = !busy && Boolean(legacyLogoUrl);
  const legacyOnly = !hasUploadedLogo && Boolean(legacyLogoUrl);
  const statusLabel = hasUploadedLogo
    ? "Using uploaded logo."
    : legacyOnly
      ? "Using legacy logo URL."
      : "No logo set — clinic initials will show.";

  return (
    <div className="space-y-3">
      <TenantLogoPreviewStrip
        logoUrl={displayLogoUrl}
        displayName={branding.clinicDisplayName}
        localPreviewUrl={localPreview}
      />
      <p className="text-xs font-medium text-[#CBD5E1]" data-testid="branding-logo-status">
        {statusLabel}
      </p>
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
          <button
            type="button"
            disabled={!removeUploadedEnabled}
            title={
              hasUploadedLogo
                ? "Delete the uploaded logo from private storage"
                : "No uploaded logo to remove"
            }
            className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-950/40 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => void onRemove()}
          >
            Remove uploaded logo
          </button>
          {clearLegacyEnabled || legacyLogoUrl ? (
            <button
              type="button"
              disabled={!clearLegacyEnabled}
              title={
                legacyLogoUrl
                  ? "Clear the legacy logo_url column"
                  : "No legacy logo URL to clear"
              }
              className="rounded-lg border border-white/[0.14] px-3 py-1.5 text-xs font-medium text-[#94A3B8] hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => void onClearLegacy()}
            >
              Clear legacy logo URL
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
          {hasUploadedLogo ? "Legacy logo URL (fallback, not currently shown): " : "Legacy logo URL (currently active): "}
          <code className="break-all text-[#94A3B8]">{legacyLogoUrl}</code>
        </p>
      ) : null}
      <p className="text-[0.7rem] leading-relaxed text-[#64748B]">
        Logo fallback order: {TENANT_BRANDING_LOGO_FALLBACK_ORDER.join(" → ")}.
      </p>
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
  const hasLogo = Boolean(draft.localLogoPreview || draft.logoUrl);

  const navRows = [
    { label: "Dashboard", active: true },
    { label: "Calendar", active: false },
    { label: "Patients", active: false },
  ];

  return (
    <div
      className="space-y-3 rounded-xl border border-white/[0.08] bg-[#081020]/60 p-4"
      style={cssVars}
      data-testid="branding-shell-preview"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
          Branded shell preview
        </p>
        <span className="fi-tenant-accent-text text-[0.65rem] font-semibold uppercase tracking-wider">
          Live
        </span>
      </div>

      {/* Mock shell: sidebar + topbar + workspace with dashboard card */}
      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#060d18]/80">
        <div className="grid grid-cols-[128px_1fr]">
          {/* Sidebar */}
          <div className="border-r border-white/[0.08] bg-[#060d18] p-2">
            <div
              className="fi-tenant-card-accent mb-2 flex items-center gap-2 rounded-lg border px-2 py-1.5"
              style={{ backgroundColor: "var(--fi-tenant-brand-bg)" }}
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-md text-[0.6rem] font-bold"
                style={{ color: "var(--fi-tenant-accent)" }}
              >
                {branding.clinicInitials}
              </span>
              <span className="truncate text-[0.65rem] font-semibold text-slate-100">
                {branding.clinicDisplayName}
              </span>
            </div>
            <div className="space-y-1">
              {navRows.map((row) => (
                <div
                  key={row.label}
                  className={`rounded-md px-2 py-1 text-[0.7rem] font-medium ${
                    row.active
                      ? "fi-tenant-nav-active text-slate-50"
                      : "text-slate-400"
                  }`}
                >
                  {row.label}
                </div>
              ))}
            </div>
          </div>

          {/* Main column */}
          <div>
            {/* Topbar with accent strip */}
            <div className="fi-tenant-topbar-accent flex items-center justify-between border-b border-white/[0.08] bg-[#0a1424]/92 px-3 py-2">
              <span className="text-[0.7rem] font-medium text-slate-300">
                {branding.clinicDisplayName}
              </span>
              <button
                type="button"
                tabIndex={-1}
                className="rounded-md px-2 py-1 text-[0.65rem] font-semibold text-white"
                style={{
                  background: `linear-gradient(to right, var(--fi-tenant-primary), var(--fi-tenant-accent))`,
                }}
              >
                Quick create
              </button>
            </div>

            {/* Workspace */}
            <div className="space-y-2 p-3">
              {/* Tabs */}
              <div className="inline-flex gap-1 rounded-lg border border-white/[0.07] bg-[#0c1220]/80 p-1">
                <span className="fi-tenant-tab-active rounded-md px-2 py-1 text-[0.65rem] font-medium text-slate-100">
                  Branding
                </span>
                <span className="rounded-md px-2 py-1 text-[0.65rem] font-medium text-slate-500">
                  Calendar
                </span>
              </div>

              {/* Dashboard entry card */}
              <div className="fi-tenant-card-accent flex items-start gap-2 rounded-lg border bg-[#0c1426]/60 p-2">
                <span className="fi-tenant-icon-chip flex h-7 w-7 items-center justify-center rounded-md border text-[0.6rem] font-bold">
                  {branding.clinicInitials}
                </span>
                <div className="min-w-0">
                  <p className="text-[0.72rem] font-semibold text-slate-100">
                    {branding.clinicDisplayName}
                  </p>
                  <p className="text-[0.62rem] text-slate-500">Workspace module card</p>
                </div>
              </div>

              {/* Primary + secondary buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  tabIndex={-1}
                  className="fi-tenant-btn-primary rounded-lg px-3 py-1.5 text-[0.7rem] font-semibold text-white shadow-md"
                >
                  Save changes
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  className="fi-tenant-card-accent rounded-lg border px-3 py-1.5 text-[0.7rem] font-medium text-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Logo fallback states */}
      <div className="rounded-xl border border-white/[0.08] p-3">
        <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-wider text-[#64748B]">
          Logo &amp; fallback states
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <TenantLogoPreviewStrip
            logoUrl={draft.logoUrl}
            displayName={branding.clinicDisplayName}
            localPreviewUrl={draft.localLogoPreview}
          />
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#0F1629] p-4">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-lg border text-sm font-bold"
              style={{
                borderColor: "color-mix(in srgb, var(--fi-tenant-accent) 20%, transparent)",
                backgroundColor: "var(--fi-tenant-brand-bg)",
                color: "var(--fi-tenant-accent)",
              }}
            >
              {branding.clinicInitials}
            </span>
            <span className="text-xs text-slate-400">
              {hasLogo
                ? "Logo shown above; initials appear if the image fails to load."
                : "No logo set — initials shown across the shell."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
