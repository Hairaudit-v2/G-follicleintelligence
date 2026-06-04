"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertCaseSurgeryPlanningAction } from "@/lib/actions/fi-case-surgery-planning-actions";
import type { CaseSurgeryPlanRow } from "@/src/lib/cases/surgeryPlanningLoaders";
import {
  SURGERY_PLANNING_STATUS_VALUES,
  isSurgeryPlanningStatus,
  type PlannedZoneRow,
} from "@/src/lib/cases/surgeryPlanningTypes";
import { CasePlannedZonesPanel } from "./CasePlannedZonesPanel";

function numOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function CaseSurgeryPlanningForm({
  tenantId,
  caseId,
  initial,
}: {
  tenantId: string;
  caseId: string;
  initial: CaseSurgeryPlanRow | null;
}) {
  const router = useRouter();
  const [planningStatus, setPlanningStatus] = useState(initial?.planning_status ?? "draft");
  const [procedureType, setProcedureType] = useState(initial?.planned_procedure_type ?? "");
  const [sessionType, setSessionType] = useState(initial?.planned_session_type ?? "");
  const [zones, setZones] = useState<PlannedZoneRow[]>(initial?.planned_zones ?? []);
  const [graftsMin, setGraftsMin] = useState(initial?.estimated_grafts_min != null ? String(initial.estimated_grafts_min) : "");
  const [graftsMax, setGraftsMax] = useState(initial?.estimated_grafts_max != null ? String(initial.estimated_grafts_max) : "");
  const [donorNotes, setDonorNotes] = useState(initial?.donor_strategy_notes ?? "");
  const [recipientNotes, setRecipientNotes] = useState(initial?.recipient_strategy_notes ?? "");
  const [medNotes, setMedNotes] = useState(initial?.medication_prep_notes ?? "");
  const [planningNotes, setPlanningNotes] = useState(initial?.planning_notes ?? "");
  const [summary, setSummary] = useState(initial?.surgical_plan_summary ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setPlanningStatus(initial?.planning_status ?? "draft");
    setProcedureType(initial?.planned_procedure_type ?? "");
    setSessionType(initial?.planned_session_type ?? "");
    setZones(initial?.planned_zones ?? []);
    setGraftsMin(initial?.estimated_grafts_min != null ? String(initial.estimated_grafts_min) : "");
    setGraftsMax(initial?.estimated_grafts_max != null ? String(initial.estimated_grafts_max) : "");
    setDonorNotes(initial?.donor_strategy_notes ?? "");
    setRecipientNotes(initial?.recipient_strategy_notes ?? "");
    setMedNotes(initial?.medication_prep_notes ?? "");
    setPlanningNotes(initial?.planning_notes ?? "");
    setSummary(initial?.surgical_plan_summary ?? "");
  }, [initial]);

  const dirty = useMemo(() => {
    if (!initial) return true;
    const gmin = numOrNull(graftsMin);
    const gmax = numOrNull(graftsMax);
    return (
      planningStatus !== initial.planning_status ||
      procedureType.trim() !== (initial.planned_procedure_type ?? "").trim() ||
      sessionType.trim() !== (initial.planned_session_type ?? "").trim() ||
      JSON.stringify(zones) !== JSON.stringify(initial.planned_zones) ||
      gmin !== initial.estimated_grafts_min ||
      gmax !== initial.estimated_grafts_max ||
      donorNotes !== (initial.donor_strategy_notes ?? "") ||
      recipientNotes !== (initial.recipient_strategy_notes ?? "") ||
      medNotes !== (initial.medication_prep_notes ?? "") ||
      planningNotes !== (initial.planning_notes ?? "") ||
      summary !== (initial.surgical_plan_summary ?? "")
    );
  }, [
    initial,
    planningStatus,
    procedureType,
    sessionType,
    zones,
    graftsMin,
    graftsMax,
    donorNotes,
    recipientNotes,
    medNotes,
    planningNotes,
    summary,
  ]);

  const canSaveStatus = isSurgeryPlanningStatus(planningStatus);

  return (
    <div className="space-y-4">
      <label className="block text-xs font-medium text-gray-700">
        Planning status
        <select
          value={planningStatus}
          onChange={(e) => setPlanningStatus(e.target.value)}
          className="mt-1 block w-full max-w-xs rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
        >
          {!isSurgeryPlanningStatus(planningStatus) ? <option value={planningStatus}>{planningStatus} (legacy)</option> : null}
          {SURGERY_PLANNING_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs font-medium text-gray-700">
        Surgical plan summary
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          placeholder="One-paragraph overview of the intended procedure and goals."
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-gray-700">
          Planned procedure type
          <input
            value={procedureType}
            onChange={(e) => setProcedureType(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
            placeholder="e.g. FUE, FUT"
          />
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Planned session type
          <input
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
            placeholder="e.g. mega-session, two-day"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-gray-700">
          Estimated grafts (min)
          <input
            inputMode="numeric"
            value={graftsMin}
            onChange={(e) => setGraftsMin(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
            placeholder="Optional"
          />
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Estimated grafts (max)
          <input
            inputMode="numeric"
            value={graftsMax}
            onChange={(e) => setGraftsMax(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
            placeholder="Optional"
          />
        </label>
      </div>

      <CasePlannedZonesPanel zones={zones} onChange={setZones} />

      <label className="block text-xs font-medium text-gray-700">
        Donor strategy notes
        <textarea
          value={donorNotes}
          onChange={(e) => setDonorNotes(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-gray-700">
        Recipient strategy notes
        <textarea
          value={recipientNotes}
          onChange={(e) => setRecipientNotes(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-gray-700">
        Medication / prep notes
        <textarea
          value={medNotes}
          onChange={(e) => setMedNotes(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-gray-700">
        Detailed planning notes (surgery plan)
        <textarea
          value={planningNotes}
          onChange={(e) => setPlanningNotes(e.target.value)}
          rows={4}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          placeholder="Longer narrative — still not procedure-day counts or audit scoring."
        />
      </label>

      {!canSaveStatus ? (
        <p className="text-xs text-amber-800">Pick a standard planning status before saving.</p>
      ) : null}
      {msg ? <p className="text-xs text-gray-700">{msg}</p> : null}

      <button
        type="button"
        disabled={pending || !dirty || !canSaveStatus}
        onClick={() => {
          setMsg(null);
          startTransition(async () => {
            const gmin = numOrNull(graftsMin);
            const gmax = numOrNull(graftsMax);
            const res = await upsertCaseSurgeryPlanningAction(tenantId, caseId, {
              planning_status: planningStatus as (typeof SURGERY_PLANNING_STATUS_VALUES)[number],
              planned_procedure_type: procedureType.trim() ? procedureType.trim() : null,
              planned_session_type: sessionType.trim() ? sessionType.trim() : null,
              planned_zones: zones.filter((z) => z.key.trim()),
              estimated_grafts_min: gmin,
              estimated_grafts_max: gmax,
              donor_strategy_notes: donorNotes.trim() ? donorNotes.trim() : null,
              recipient_strategy_notes: recipientNotes.trim() ? recipientNotes.trim() : null,
              medication_prep_notes: medNotes.trim() ? medNotes.trim() : null,
              planning_notes: planningNotes.trim() ? planningNotes.trim() : null,
              surgical_plan_summary: summary.trim() ? summary.trim() : null,
            });
            if (!res.ok) {
              setMsg(res.error);
              return;
            }
            setMsg("Saved.");
            router.refresh();
          });
        }}
        className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {pending ? "Saving…" : initial ? "Save surgery plan" : "Create surgery plan"}
      </button>
    </div>
  );
}
