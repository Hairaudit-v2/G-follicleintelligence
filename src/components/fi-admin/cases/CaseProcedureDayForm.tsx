"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertCaseProcedureDayAction } from "@/lib/actions/fi-case-procedure-day-actions";
import type { CaseProcedureRow } from "@/src/lib/cases/procedureDayLoaders";
import {
  PROCEDURE_MILESTONE_KEYS,
  PROCEDURE_MILESTONE_LABEL,
  milestoneCompletionCount,
} from "@/src/lib/cases/procedureDayMilestonesModel";
import { PROCEDURE_STATUS_VALUES, isProcedureStatus } from "@/src/lib/cases/procedureDayTypes";
import { ProcedureTeamSelect } from "@/src/components/fi/staff/StaffClinicalPickerFields";
import type { ProcedureTeamPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import { CaseProcedureTeamPanel } from "./CaseProcedureTeamPanel";
import { CaseProcedureTechnicianPanel } from "./CaseProcedureTechnicianPanel";
import { caseFormField } from "./caseFormFieldProps";

const PROCEDURE_DAY_FIELDS = {
  procedureDate: caseFormField("procedure-day-date"),
  procedureStatus: caseFormField("procedure-day-status"),
  surgeonId: caseFormField("procedure-day-surgeon"),
  nurseId: caseFormField("procedure-day-nurse"),
  room: caseFormField("procedure-day-room"),
  location: caseFormField("procedure-day-location"),
  startLocal: caseFormField("procedure-day-start"),
  finishLocal: caseFormField("procedure-day-finish"),
  punchSize: caseFormField("procedure-day-punch-size"),
  extractionMethod: caseFormField("procedure-day-extraction-method"),
  implantationMethod: caseFormField("procedure-day-implantation-method"),
  medicationNotes: caseFormField("procedure-day-medication-notes"),
  intraNotes: caseFormField("procedure-day-intra-notes"),
  graftsExtracted: caseFormField("procedure-day-grafts-extracted"),
  graftsImplanted: caseFormField("procedure-day-grafts-implanted"),
  hairsImplanted: caseFormField("procedure-day-hairs-implanted"),
  handlingNotes: caseFormField("procedure-day-handling-notes"),
  complicationsNotes: caseFormField("procedure-day-complications-notes"),
  completionSummary: caseFormField("procedure-day-completion-summary"),
} as const;

function numOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** `datetime-local` value from an ISO string (browser-local components). */
function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function CaseProcedureDayForm({
  tenantId,
  caseId,
  initial,
  teamUserOptions,
}: {
  tenantId: string;
  caseId: string;
  initial: CaseProcedureRow | null;
  teamUserOptions: ProcedureTeamPickerOption[];
}) {
  const router = useRouter();
  const [procedureDate, setProcedureDate] = useState(initial?.procedure_date?.slice(0, 10) ?? "");
  const [procedureStatus, setProcedureStatus] = useState(initial?.procedure_status ?? "scheduled");
  const [surgeonId, setSurgeonId] = useState(initial?.surgeon_user_id ?? "");
  const [nurseId, setNurseId] = useState(initial?.nurse_user_id ?? "");
  const [technicianIds, setTechnicianIds] = useState<string[]>(initial?.technician_user_ids ?? []);
  const [milestones, setMilestones] = useState<Record<string, string>>(() => ({ ...(initial?.procedure_milestones ?? {}) }));
  const [teamIds, setTeamIds] = useState<string[]>(initial?.team_member_user_ids ?? []);
  const [location, setLocation] = useState(initial?.procedure_location ?? "");
  const [room, setRoom] = useState(initial?.procedure_room ?? "");
  const [startLocal, setStartLocal] = useState(isoToDatetimeLocal(initial?.start_time ?? null));
  const [finishLocal, setFinishLocal] = useState(isoToDatetimeLocal(initial?.finish_time ?? null));
  const [punchSize, setPunchSize] = useState(initial?.punch_size ?? "");
  const [extractionMethod, setExtractionMethod] = useState(initial?.extraction_method ?? "");
  const [implantationMethod, setImplantationMethod] = useState(initial?.implantation_method ?? "");
  const [medicationNotes, setMedicationNotes] = useState(initial?.medication_notes ?? "");
  const [intraNotes, setIntraNotes] = useState(initial?.intraoperative_notes ?? "");
  const [graftsExtracted, setGraftsExtracted] = useState(
    initial?.grafts_extracted != null ? String(initial.grafts_extracted) : ""
  );
  const [graftsImplanted, setGraftsImplanted] = useState(
    initial?.grafts_implanted != null ? String(initial.grafts_implanted) : ""
  );
  const [hairsImplanted, setHairsImplanted] = useState(
    initial?.hairs_implanted != null ? String(initial.hairs_implanted) : ""
  );
  const [handlingNotes, setHandlingNotes] = useState(initial?.graft_handling_notes ?? "");
  const [complicationsNotes, setComplicationsNotes] = useState(initial?.complications_notes ?? "");
  const [completionSummary, setCompletionSummary] = useState(initial?.completion_summary ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setProcedureDate(initial?.procedure_date?.slice(0, 10) ?? "");
    setProcedureStatus(initial?.procedure_status ?? "scheduled");
    setSurgeonId(initial?.surgeon_user_id ?? "");
    setNurseId(initial?.nurse_user_id ?? "");
    setTechnicianIds(initial?.technician_user_ids ?? []);
    setMilestones({ ...(initial?.procedure_milestones ?? {}) });
    setTeamIds(initial?.team_member_user_ids ?? []);
    setLocation(initial?.procedure_location ?? "");
    setRoom(initial?.procedure_room ?? "");
    setStartLocal(isoToDatetimeLocal(initial?.start_time ?? null));
    setFinishLocal(isoToDatetimeLocal(initial?.finish_time ?? null));
    setPunchSize(initial?.punch_size ?? "");
    setExtractionMethod(initial?.extraction_method ?? "");
    setImplantationMethod(initial?.implantation_method ?? "");
    setMedicationNotes(initial?.medication_notes ?? "");
    setIntraNotes(initial?.intraoperative_notes ?? "");
    setGraftsExtracted(initial?.grafts_extracted != null ? String(initial.grafts_extracted) : "");
    setGraftsImplanted(initial?.grafts_implanted != null ? String(initial.grafts_implanted) : "");
    setHairsImplanted(initial?.hairs_implanted != null ? String(initial.hairs_implanted) : "");
    setHandlingNotes(initial?.graft_handling_notes ?? "");
    setComplicationsNotes(initial?.complications_notes ?? "");
    setCompletionSummary(initial?.completion_summary ?? "");
  }, [initial]);

  const dirty = useMemo(() => {
    if (!initial) return true;
    const ge = numOrNull(graftsExtracted);
    const gi = numOrNull(graftsImplanted);
    const hi = numOrNull(hairsImplanted);
    return (
      procedureDate !== (initial.procedure_date?.slice(0, 10) ?? "") ||
      procedureStatus !== initial.procedure_status ||
      surgeonId !== (initial.surgeon_user_id ?? "") ||
      nurseId !== (initial.nurse_user_id ?? "") ||
      JSON.stringify(technicianIds) !== JSON.stringify(initial.technician_user_ids) ||
      JSON.stringify(milestones) !== JSON.stringify(initial.procedure_milestones ?? {}) ||
      JSON.stringify(teamIds) !== JSON.stringify(initial.team_member_user_ids) ||
      location !== (initial.procedure_location ?? "") ||
      room !== (initial.procedure_room ?? "") ||
      startLocal !== isoToDatetimeLocal(initial.start_time ?? null) ||
      finishLocal !== isoToDatetimeLocal(initial.finish_time ?? null) ||
      punchSize !== (initial.punch_size ?? "") ||
      extractionMethod !== (initial.extraction_method ?? "") ||
      implantationMethod !== (initial.implantation_method ?? "") ||
      medicationNotes !== (initial.medication_notes ?? "") ||
      intraNotes !== (initial.intraoperative_notes ?? "") ||
      ge !== initial.grafts_extracted ||
      gi !== initial.grafts_implanted ||
      hi !== initial.hairs_implanted ||
      handlingNotes !== (initial.graft_handling_notes ?? "") ||
      complicationsNotes !== (initial.complications_notes ?? "") ||
      completionSummary !== (initial.completion_summary ?? "")
    );
  }, [
    initial,
    procedureDate,
    procedureStatus,
    surgeonId,
    nurseId,
    technicianIds,
    milestones,
    teamIds,
    location,
    room,
    startLocal,
    finishLocal,
    punchSize,
    extractionMethod,
    implantationMethod,
    medicationNotes,
    intraNotes,
    graftsExtracted,
    graftsImplanted,
    hairsImplanted,
    handlingNotes,
    complicationsNotes,
    completionSummary,
  ]);

  const canSaveStatus = isProcedureStatus(procedureStatus);
  const ge = numOrNull(graftsExtracted);
  const gi = numOrNull(graftsImplanted);
  const graftsOk = ge == null || gi == null || gi <= ge;
  const startIso = datetimeLocalToIso(startLocal);
  const finishIso = datetimeLocalToIso(finishLocal);
  const timesOk = !startIso || !finishIso || new Date(finishIso).getTime() >= new Date(startIso).getTime();

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={PROCEDURE_DAY_FIELDS.procedureDate.id} className="block text-xs font-medium text-slate-300">
          Procedure date
          <input
            {...PROCEDURE_DAY_FIELDS.procedureDate}
            type="date"
            value={procedureDate}
            onChange={(e) => setProcedureDate(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label htmlFor={PROCEDURE_DAY_FIELDS.procedureStatus.id} className="block text-xs font-medium text-slate-300">
          Procedure status
          <select
            {...PROCEDURE_DAY_FIELDS.procedureStatus}
            value={procedureStatus}
            onChange={(e) => setProcedureStatus(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
            {!isProcedureStatus(procedureStatus) ? <option value={procedureStatus}>{procedureStatus} (legacy)</option> : null}
            {PROCEDURE_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={PROCEDURE_DAY_FIELDS.surgeonId.id} className="block text-xs font-medium text-slate-300">
          Surgeon
          <ProcedureTeamSelect
            id={PROCEDURE_DAY_FIELDS.surgeonId.id}
            tenantId={tenantId}
            options={teamUserOptions}
            value={surgeonId}
            onChange={setSurgeonId}
            slot="clinical"
          />
        </label>
        <label htmlFor={PROCEDURE_DAY_FIELDS.nurseId.id} className="block text-xs font-medium text-slate-300">
          Circulating / recovery nurse
          <ProcedureTeamSelect
            id={PROCEDURE_DAY_FIELDS.nurseId.id}
            tenantId={tenantId}
            options={teamUserOptions}
            value={nurseId}
            onChange={setNurseId}
            slot="support"
          />
        </label>
      </div>

      <label htmlFor={PROCEDURE_DAY_FIELDS.room.id} className="block text-xs font-medium text-slate-300">
        Procedure room
        <input
          {...PROCEDURE_DAY_FIELDS.room}
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          placeholder="OR 2"
        />
      </label>

      <label htmlFor={PROCEDURE_DAY_FIELDS.location.id} className="block text-xs font-medium text-slate-300">
        Procedure location / site
        <input
          {...PROCEDURE_DAY_FIELDS.location}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          placeholder="Clinic address or site label"
        />
      </label>

      <CaseProcedureTechnicianPanel
        tenantId={tenantId}
        technicianIds={technicianIds}
        userOptions={teamUserOptions}
        excludeUserIds={[surgeonId, nurseId]}
        onChange={setTechnicianIds}
      />

      <CaseProcedureTeamPanel
        tenantId={tenantId}
        teamIds={teamIds}
        userOptions={teamUserOptions}
        excludeUserIds={[surgeonId, nurseId, ...technicianIds]}
        onChange={setTeamIds}
      />

      <div className="rounded border border-white/[0.08] bg-white/[0.03] p-3">
        <h3 className="text-xs font-semibold text-slate-100">Procedure milestones</h3>
        <p className="mt-1 text-xs text-gray-500">
          Record when each stage happened (optional but recommended for handoffs and audits).
        </p>
        <ul className="mt-3 space-y-2">
          {PROCEDURE_MILESTONE_KEYS.map((key) => {
            const ts = milestones[key]?.trim();
            return (
              <li key={key} className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-2 text-xs last:border-0 last:pb-0">
                <span className="min-w-0 flex-1 text-slate-200">{PROCEDURE_MILESTONE_LABEL[key]}</span>
                <span className="text-gray-500">
                  {ts ? (Number.isNaN(Date.parse(ts)) ? ts : new Date(ts).toLocaleString()) : "—"}
                </span>
                <button
                  type="button"
                  className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-0.5 text-[0.65rem] font-medium text-slate-200 hover:bg-white/[0.03]"
                  onClick={() => setMilestones((m) => ({ ...m, [key]: new Date().toISOString() }))}
                >
                  Now
                </button>
                <button
                  type="button"
                  className="rounded border border-transparent px-2 py-0.5 text-[0.65rem] text-rose-700 hover:underline"
                  onClick={() =>
                    setMilestones((m) => {
                      const next = { ...m };
                      delete next[key];
                      return next;
                    })
                  }
                >
                  Clear
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-slate-400">
          Milestones logged:{" "}
          <span className="font-mono font-medium">
            {milestoneCompletionCount(milestones)} / {PROCEDURE_MILESTONE_KEYS.length}
          </span>
        </p>
      </div>

      <div className="rounded border border-sky-100 bg-cyan-500/10 p-3 text-xs text-slate-200">
        <p className="font-semibold text-slate-100">Finishing the case</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-slate-300">
          <li className={ge != null && gi != null ? "" : "text-amber-200"}>Capture extracted and implanted graft counts.</li>
          <li className={milestoneCompletionCount(milestones) >= 3 ? "" : "text-amber-200"}>
            Log at least three procedure milestones (or explain gaps in intraoperative notes).
          </li>
          <li className={completionSummary.trim() ? "" : "text-amber-200"}>
            Add a completion summary when you set status to completed.
          </li>
        </ol>
        <button
          type="button"
          className="mt-2 rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1 text-xs font-medium text-slate-100 hover:bg-white/[0.03]"
          onClick={() => setProcedureStatus("completed")}
        >
          Set status to completed (save to persist)
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={PROCEDURE_DAY_FIELDS.startLocal.id} className="block text-xs font-medium text-slate-300">
          Start time
          <input
            {...PROCEDURE_DAY_FIELDS.startLocal}
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label htmlFor={PROCEDURE_DAY_FIELDS.finishLocal.id} className="block text-xs font-medium text-slate-300">
          Finish time
          <input
            {...PROCEDURE_DAY_FIELDS.finishLocal}
            type="datetime-local"
            value={finishLocal}
            onChange={(e) => setFinishLocal(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label htmlFor={PROCEDURE_DAY_FIELDS.punchSize.id} className="block text-xs font-medium text-slate-300">
          Punch size
          <input
            {...PROCEDURE_DAY_FIELDS.punchSize}
            value={punchSize}
            onChange={(e) => setPunchSize(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
            placeholder="e.g. 0.85mm"
          />
        </label>
        <label htmlFor={PROCEDURE_DAY_FIELDS.extractionMethod.id} className="block text-xs font-medium text-slate-300">
          Extraction method
          <input
            {...PROCEDURE_DAY_FIELDS.extractionMethod}
            value={extractionMethod}
            onChange={(e) => setExtractionMethod(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label htmlFor={PROCEDURE_DAY_FIELDS.implantationMethod.id} className="block text-xs font-medium text-slate-300">
          Implantation method
          <input
            {...PROCEDURE_DAY_FIELDS.implantationMethod}
            value={implantationMethod}
            onChange={(e) => setImplantationMethod(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <label htmlFor={PROCEDURE_DAY_FIELDS.medicationNotes.id} className="block text-xs font-medium text-slate-300">
        Anaesthetic / medication notes
        <textarea
          {...PROCEDURE_DAY_FIELDS.medicationNotes}
          value={medicationNotes}
          onChange={(e) => setMedicationNotes(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
        />
      </label>
      <label htmlFor={PROCEDURE_DAY_FIELDS.intraNotes.id} className="block text-xs font-medium text-slate-300">
        Intraoperative notes
        <textarea
          {...PROCEDURE_DAY_FIELDS.intraNotes}
          value={intraNotes}
          onChange={(e) => setIntraNotes(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label htmlFor={PROCEDURE_DAY_FIELDS.graftsExtracted.id} className="block text-xs font-medium text-slate-300">
          Grafts extracted
          <input
            {...PROCEDURE_DAY_FIELDS.graftsExtracted}
            inputMode="numeric"
            value={graftsExtracted}
            onChange={(e) => setGraftsExtracted(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label htmlFor={PROCEDURE_DAY_FIELDS.graftsImplanted.id} className="block text-xs font-medium text-slate-300">
          Grafts implanted
          <input
            {...PROCEDURE_DAY_FIELDS.graftsImplanted}
            inputMode="numeric"
            value={graftsImplanted}
            onChange={(e) => setGraftsImplanted(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label htmlFor={PROCEDURE_DAY_FIELDS.hairsImplanted.id} className="block text-xs font-medium text-slate-300">
          Hairs implanted
          <input
            {...PROCEDURE_DAY_FIELDS.hairsImplanted}
            inputMode="numeric"
            value={hairsImplanted}
            onChange={(e) => setHairsImplanted(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      {!graftsOk ? <p className="text-xs text-amber-300">Implanted grafts cannot exceed extracted grafts.</p> : null}
      {!timesOk ? <p className="text-xs text-amber-300">Finish time must be on or after start time.</p> : null}

      <label htmlFor={PROCEDURE_DAY_FIELDS.handlingNotes.id} className="block text-xs font-medium text-slate-300">
        Graft survival / handling notes
        <textarea
          {...PROCEDURE_DAY_FIELDS.handlingNotes}
          value={handlingNotes}
          onChange={(e) => setHandlingNotes(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
        />
      </label>
      <label htmlFor={PROCEDURE_DAY_FIELDS.complicationsNotes.id} className="block text-xs font-medium text-slate-300">
        Complications / incidents notes
        <textarea
          {...PROCEDURE_DAY_FIELDS.complicationsNotes}
          value={complicationsNotes}
          onChange={(e) => setComplicationsNotes(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
        />
      </label>
      <label htmlFor={PROCEDURE_DAY_FIELDS.completionSummary.id} className="block text-xs font-medium text-slate-300">
        Procedure completion summary
        <textarea
          {...PROCEDURE_DAY_FIELDS.completionSummary}
          value={completionSummary}
          onChange={(e) => setCompletionSummary(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
        />
      </label>

      {!canSaveStatus ? (
        <p className="text-xs text-amber-300">Pick a standard procedure status before saving.</p>
      ) : null}
      {msg ? <p className="text-xs text-slate-300">{msg}</p> : null}

      <button
        type="button"
        disabled={pending || !dirty || !canSaveStatus || !graftsOk || !timesOk}
        onClick={() => {
          setMsg(null);
          startTransition(async () => {
            const res = await upsertCaseProcedureDayAction(tenantId, caseId, {
              procedure_date: procedureDate.trim() ? procedureDate.trim().slice(0, 10) : null,
              procedure_status: procedureStatus as (typeof PROCEDURE_STATUS_VALUES)[number],
              surgeon_user_id: surgeonId.trim() ? surgeonId.trim() : null,
              nurse_user_id: nurseId.trim() ? nurseId.trim() : null,
              technician_user_ids: technicianIds,
              team_member_user_ids: teamIds,
              procedure_milestones: milestones,
              procedure_location: location.trim() ? location.trim() : null,
              procedure_room: room.trim() ? room.trim() : null,
              start_time: datetimeLocalToIso(startLocal),
              finish_time: datetimeLocalToIso(finishLocal),
              punch_size: punchSize.trim() ? punchSize.trim() : null,
              extraction_method: extractionMethod.trim() ? extractionMethod.trim() : null,
              implantation_method: implantationMethod.trim() ? implantationMethod.trim() : null,
              medication_notes: medicationNotes.trim() ? medicationNotes.trim() : null,
              intraoperative_notes: intraNotes.trim() ? intraNotes.trim() : null,
              grafts_extracted: ge,
              grafts_implanted: gi,
              hairs_implanted: numOrNull(hairsImplanted),
              graft_handling_notes: handlingNotes.trim() ? handlingNotes.trim() : null,
              complications_notes: complicationsNotes.trim() ? complicationsNotes.trim() : null,
              completion_summary: completionSummary.trim() ? completionSummary.trim() : null,
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
        {pending ? "Saving…" : initial ? "Save procedure day" : "Create procedure day record"}
      </button>
    </div>
  );
}
