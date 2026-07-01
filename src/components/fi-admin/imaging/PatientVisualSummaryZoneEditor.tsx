"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { savePatientVisualSummaryZoneRecordAction } from "@/lib/actions/fi-imaging-actions";
import {
  emptyRecipientZoneDraft,
  recipientZoneDraftFromRecord,
  RECIPIENT_ZONE_IDS,
  RECIPIENT_ZONE_LABELS,
  type RecipientZoneDraft,
} from "@/src/lib/imaging-os/patientVisualSummaryRecordCore";
import type { PatientVisualSummaryStaffRecord } from "@/src/lib/imaging-os/patientVisualSummaryReportTypes";

const inputClass =
  "mt-0.5 w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-100";

export function PatientVisualSummaryZoneEditor({
  tenantId,
  caseId,
  surgeryId,
  surgeryGraftTotal,
  initialRecord,
  adminKey,
  onSaved,
}: {
  tenantId: string;
  caseId: string;
  surgeryId?: string | null;
  surgeryGraftTotal?: number | null;
  initialRecord?: PatientVisualSummaryStaffRecord | null;
  adminKey?: string;
  onSaved?: () => void;
}) {
  const [drafts, setDrafts] = useState<RecipientZoneDraft[]>(() =>
    RECIPIENT_ZONE_IDS.map((id) => emptyRecipientZoneDraft(id))
  );
  const [followUpPlan, setFollowUpPlan] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pending, start] = useTransition();

  useEffect(() => {
    const record = initialRecord ?? null;
    if (!record) return;
    setDrafts(recipientZoneDraftFromRecord(record));
    setFollowUpPlan(record.follow_up_plan ?? "");
  }, [initialRecord]);

  const updateDraft = useCallback((zoneId: string, patch: Partial<RecipientZoneDraft>) => {
    setDrafts((prev) =>
      prev.map((d) => (d.zone_id === zoneId ? { ...d, ...patch } : d))
    );
  }, []);

  const save = () => {
    start(async () => {
      setMessage(null);
      setWarnings([]);
      const res = await savePatientVisualSummaryZoneRecordAction(tenantId, {
        adminKey,
        caseId,
        surgeryId: surgeryId ?? null,
        surgeryGraftTotal: surgeryGraftTotal ?? null,
        zones: drafts,
        followUpPlan: followUpPlan.trim() || null,
      });
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      setWarnings(res.warnings ?? []);
      setMessage("Zone data saved.");
      onSaved?.();
    });
  };

  return (
    <div className="mt-4 space-y-4 border-t border-white/[0.06] pt-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Recipient zone data
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Staff-only. Partial entries are allowed. Missing fields show as &quot;Not recorded&quot; in
          the patient report.
          {surgeryGraftTotal != null && surgeryGraftTotal > 0
            ? ` Surgery graft total: ${surgeryGraftTotal}.`
            : null}
        </p>
      </div>

      <div className="space-y-3">
        {drafts.map((draft) => (
          <div
            key={draft.zone_id}
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
          >
            <p className="text-xs font-medium text-slate-200">
              {RECIPIENT_ZONE_LABELS[draft.zone_id]}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-[10px] text-slate-500">
                Graft count
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={draft.graft_count}
                  onChange={(e) => updateDraft(draft.zone_id, { graft_count: e.target.value })}
                />
              </label>
              <label className="text-[10px] text-slate-500">
                Density range
                <input
                  className={inputClass}
                  value={draft.density_range}
                  placeholder="e.g. 45–50 grafts/cm²"
                  onChange={(e) => updateDraft(draft.zone_id, { density_range: e.target.value })}
                />
              </label>
              <label className="text-[10px] text-slate-500">
                Grafts/cm²
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  className={inputClass}
                  value={draft.grafts_per_cm2}
                  onChange={(e) => updateDraft(draft.zone_id, { grafts_per_cm2: e.target.value })}
                />
              </label>
              <label className="text-[10px] text-slate-500">
                Staff notes (not shown to patients)
                <input
                  className={inputClass}
                  value={draft.notes}
                  onChange={(e) => updateDraft(draft.zone_id, { notes: e.target.value })}
                />
              </label>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-5">
              {(
                [
                  ["singles", "Singles"],
                  ["doubles", "Doubles"],
                  ["triples", "Triples"],
                  ["multi_hair", "4+ hair"],
                  ["five_hair", "5-hair"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="text-[10px] text-slate-500">
                  {label}
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={draft[key]}
                    onChange={(e) => updateDraft(draft.zone_id, { [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <label className="block text-xs text-slate-400">
        Follow-up plan (patient-safe wording only)
        <textarea
          className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-100"
          rows={2}
          value={followUpPlan}
          onChange={(e) => setFollowUpPlan(e.target.value)}
          placeholder="Optional — shown in approved patient summary"
        />
      </label>

      <button
        type="button"
        disabled={pending}
        onClick={save}
        className="rounded-lg border border-cyan-500/30 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-50"
      >
        Save zone data
      </button>

      {warnings.length > 0 ? (
        <ul className="space-y-1 text-xs text-amber-200/90">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
      {message ? <p className="text-xs text-slate-300">{message}</p> : null}
    </div>
  );
}