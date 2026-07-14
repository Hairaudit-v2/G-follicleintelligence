"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import {
  previewHairAuditClinicDiscoveryAction,
  runHairAuditClinicDiscoverySyncAction,
  saveHairAuditClinicDiscoverySettingsAction,
} from "@/lib/actions/fi-hairaudit-clinic-discovery-actions";
import type { PublicClinicDiscoveryAdminSettings } from "@/src/lib/hairaudit/clinicDiscovery/publicClinicProfileTypes";
import type { PublicClinicProfileSyncSummary } from "@/src/lib/hairaudit/clinicDiscovery/publicClinicProfileSyncCore";

const inputClass =
  "w-full rounded-lg border border-white/[0.1] bg-[#081020]/85 px-2 py-1.5 text-sm text-[#F8FAFC] shadow-inner outline-none transition placeholder:text-[#475569] focus:border-[#22C1FF]/45 focus:ring-2 focus:ring-[#22C1FF]/20";

export function ClinicDiscoverySection(props: {
  tenantId: string;
  clinicId: string;
  clinics: Array<{ id: string; display_name: string }>;
  initialSettings: PublicClinicDiscoveryAdminSettings;
  hairauditClinicId: string | null;
  previewBlockingReasons: string[];
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(props.initialSettings);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncSummary, setSyncSummary] = useState<PublicClinicProfileSyncSummary | null>(null);
  const [previewJson, setPreviewJson] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onClinicChange = (nextClinicId: string) => {
    router.push(
      `/fi-admin/${props.tenantId}/settings/hairaudit-discovery?clinicId=${encodeURIComponent(nextClinicId)}`
    );
  };

  const save = useCallback(() => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await saveHairAuditClinicDiscoverySettingsAction(props.tenantId, {
        fi_clinic_id: props.clinicId,
        settings,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message);
      router.refresh();
    });
  }, [props.tenantId, props.clinicId, settings, router]);

  const preview = useCallback(() => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await previewHairAuditClinicDiscoveryAction(props.tenantId, props.clinicId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreviewJson(JSON.stringify(result.preview.searchDocument, null, 2));
      setMessage(
        result.preview.publishReady
          ? "Preview ready — profile can be published to search."
          : `Preview blocked: ${result.preview.blockingReasons.join(", ")}`
      );
    });
  }, [props.tenantId, props.clinicId]);

  const runSync = useCallback(
    (dryRun: boolean) => {
      setMessage(null);
      setError(null);
      startTransition(async () => {
        const result = await runHairAuditClinicDiscoverySyncAction(props.tenantId, {
          fi_clinic_id: props.clinicId,
          dryRun,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSyncSummary(result.data.summary);
        setMessage(result.message);
        if (!dryRun) router.refresh();
      });
    },
    [props.tenantId, props.clinicId, router]
  );

  return (
    <div className="space-y-6 rounded-2xl border border-white/[0.08] bg-[#0F1629]/75 p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium text-[#CBD5E1]">
          Clinic
          <select
            className={inputClass}
            value={props.clinicId}
            onChange={(e) => onClinicChange(e.target.value)}
          >
            {props.clinics.map((clinic) => (
              <option key={clinic.id} value={clinic.id}>
                {clinic.display_name}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm text-[#94A3B8]">
          HairAudit clinic link:{" "}
          <span className="text-[#E2E8F0]">{props.hairauditClinicId ?? "Not linked"}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-sm text-[#CBD5E1]">
          <input
            type="checkbox"
            checked={settings.public_profile_enabled}
            onChange={(e) =>
              setSettings((s) => ({ ...s, public_profile_enabled: e.target.checked }))
            }
          />
          Enable HairAudit public discovery
        </label>
        <label className="flex items-center gap-2 text-sm text-[#CBD5E1]">
          <input
            type="checkbox"
            checked={settings.search_visible}
            onChange={(e) => setSettings((s) => ({ ...s, search_visible: e.target.checked }))}
          />
          Search visible
        </label>
        <label className="flex items-center gap-2 text-sm text-[#CBD5E1]">
          <input
            type="checkbox"
            checked={settings.accepts_independent_hairaudit_enquiries}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                accepts_independent_hairaudit_enquiries: e.target.checked,
              }))
            }
          />
          Accept independent HairAudit enquiries
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(
          [
            ["clinic_name", "Public clinic name"],
            ["city_suburb", "City / suburb"],
            ["state_region", "State / region"],
            ["country", "Country"],
            ["public_phone", "Public phone"],
            ["public_email", "Public email"],
            ["public_website_url", "Public website"],
            ["public_booking_url", "Public booking URL"],
            ["logo_brand_image_url", "Logo / brand image URL"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="grid gap-1 text-xs font-medium text-[#CBD5E1]">
            {label}
            <input
              className={inputClass}
              value={settings[key] ?? ""}
              onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value || null }))}
            />
          </label>
        ))}
      </div>

      <label className="grid gap-1 text-xs font-medium text-[#CBD5E1]">
        Profile summary
        <textarea
          className={`${inputClass} min-h-[80px]`}
          value={settings.profile_summary ?? ""}
          onChange={(e) => setSettings((s) => ({ ...s, profile_summary: e.target.value || null }))}
        />
      </label>

      <label className="grid gap-1 text-xs font-medium text-[#CBD5E1]">
        Profile bio
        <textarea
          className={`${inputClass} min-h-[120px]`}
          value={settings.profile_bio ?? ""}
          onChange={(e) => setSettings((s) => ({ ...s, profile_bio: e.target.value || null }))}
        />
      </label>

      {props.previewBlockingReasons.length ? (
        <p className="text-sm text-amber-300/90">
          Blocking reasons: {props.previewBlockingReasons.join(", ")}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="rounded-lg border border-[#22C1FF]/40 bg-[#22C1FF]/10 px-3 py-2 text-sm text-[#22C1FF] disabled:opacity-50"
        >
          Save settings
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={preview}
          className="rounded-lg border border-white/10 px-3 py-2 text-sm text-[#CBD5E1] disabled:opacity-50"
        >
          Preview profile
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => runSync(true)}
          className="rounded-lg border border-white/10 px-3 py-2 text-sm text-[#CBD5E1] disabled:opacity-50"
        >
          Dry-run sync
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => runSync(false)}
          className="rounded-lg border border-white/10 px-3 py-2 text-sm text-[#CBD5E1] disabled:opacity-50"
        >
          Run sync
        </button>
      </div>

      {syncSummary ? (
        <div className="rounded-lg border border-white/10 bg-[#081020]/70 p-3 text-sm text-[#94A3B8]">
          Scanned {syncSummary.scanned} · Would create {syncSummary.wouldCreate} · Would update{" "}
          {syncSummary.wouldUpdate} · Skipped opt-out {syncSummary.skippedOptOut}
        </div>
      ) : null}

      {previewJson ? (
        <pre className="overflow-x-auto rounded-lg border border-white/10 bg-[#081020]/70 p-3 text-xs text-[#CBD5E1]">
          {previewJson}
        </pre>
      ) : null}

      {message ? <p className="text-sm text-emerald-300/90">{message}</p> : null}
      {error ? <p className="text-sm text-rose-300/90">{error}</p> : null}
    </div>
  );
}
