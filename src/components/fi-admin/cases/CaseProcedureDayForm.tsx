"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertCaseProcedureDayAction } from "@/lib/actions/fi-case-procedure-day-actions";
import type { CaseProcedureRow, FiUserPickerOption } from "@/src/lib/cases/procedureDayLoaders";
import { PROCEDURE_STATUS_VALUES, isProcedureStatus } from "@/src/lib/cases/procedureDayTypes";
import { CaseProcedureTeamPanel } from "./CaseProcedureTeamPanel";
import { caseFormField } from "./caseFormFieldProps";

const PROCEDURE_DAY_FIELDS = {
  procedureDate: caseFormField("procedure-day-date"),
  procedureStatus: caseFormField("procedure-day-status"),
  surgeonId: caseFormField("procedure-day-surgeon"),
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
  teamUserOptions: FiUserPickerOption[];
}) {
  const router = useRouter();
  const [procedureDate, setProcedureDate] = useState(initial?.procedure_date?.slice(0, 10) ?? "");
  const [procedureStatus, setProcedureStatus] = useState(initial?.procedure_status ?? "scheduled");
  const [surgeonId, setSurgeonId] = useState(initial?.surgeon_user_id ?? "");
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
        <label htmlFor={PROCEDURE_DAY_FIELDS.procedureDate.id} className="block text-xs font-medium text-gray-700">
          Procedure date
          <input
            {...PROCEDURE_DAY_FIELDS.procedureDate}
            type="date"
            value={procedureDate}
            onChange={(e) => setProcedureDate(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label htmlFor={PROCEDURE_DAY_FIELDS.procedureStatus.id} className="block text-xs font-medium text-gray-700">
          Procedure status
          <select
            {...PROCEDURE_DAY_FIELDS.procedureStatus}
            value={procedureStatus}
            onChange={(e) => setProcedureStatus(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
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
        <label htmlFor={PROCEDURE_DAY_FIELDS.surgeonId.id} className="block text-xs font-medium text-gray-700">
          Surgeon (fi_users)
          <select
            {...PROCEDURE_DAY_FIELDS.surgeonId}
            value={surgeonId}
            onChange={(e) => setSurgeonId(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">—</option>
            {teamUserOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {(u.email ?? u.id.slice(0, 8)) + (u.role ? ` · ${u.role}` : "")}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={PROCEDURE_DAY_FIELDS.room.id} className="block text-xs font-medium text-gray-700">
          Procedure room
          <input
            {...PROCEDURE_DAY_FIELDS.room}
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
            placeholder="OR 2"
          />
        </label>
      </div>

      <label htmlFor={PROCEDURE_DAY_FIELDS.location.id} className="block text-xs font-medium text-gray-700">
        Procedure location / site
        <input
          {...PROCEDURE_DAY_FIELDS.location}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          placeholder="Clinic address or site label"
        />
      </label>

      <CaseProcedureTeamPanel teamIds={teamIds} userOptions={teamUserOptions} excludeUserIds={[surgeonId]} onChange={setTeamIds} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={PROCEDURE_DAY_FIELDS.startLocal.id} className="block text-xs font-medium text-gray-700">
          Start time
          <input
            {...PROCEDURE_DAY_FIELDS.startLocal}
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label htmlFor={PROCEDURE_DAY_FIELDS.finishLocal.id} className="block text-xs font-medium text-gray-700">
          Finish time
          <input
            {...PROCEDURE_DAY_FIELDS.finishLocal}
            type="datetime-local"
            value={finishLocal}
            onChange={(e) => setFinishLocal(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label htmlFor={PROCEDURE_DAY_FIELDS.punchSize.id} className="block text-xs font-medium text-gray-700">
          Punch size
          <input
            {...PROCEDURE_DAY_FIELDS.punchSize}
            value={punchSize}
            onChange={(e) => setPunchSize(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
            placeholder="e.g. 0.85mm"
          />
        </label>
        <label htmlFor={PROCEDURE_DAY_FIELDS.extractionMethod.id} className="block text-xs font-medium text-gray-700">
          Extraction method
          <input
            {...PROCEDURE_DAY_FIELDS.extractionMethod}
            value={extractionMethod}
            onChange={(e) => setExtractionMethod(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label htmlFor={PROCEDURE_DAY_FIELDS.implantationMethod.id} className="block text-xs font-medium text-gray-700">
          Implantation method
          <input
            {...PROCEDURE_DAY_FIELDS.implantationMethod}
            value={implantationMethod}
            onChange={(e) => setImplantationMethod(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <label htmlFor={PROCEDURE_DAY_FIELDS.medicationNotes.id} className="block text-xs font-medium text-gray-700">
        Anaesthetic / medication notes
        <textarea
          {...PROCEDURE_DAY_FIELDS.medicationNotes}
          value={medicationNotes}
          onChange={(e) => setMedicationNotes(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
        />
      </label>
      <label htmlFor={PROCEDURE_DAY_FIELDS.intraNotes.id} className="block text-xs font-medium text-gray-700">
        Intraoperative notes
        <textarea
          {...PROCEDURE_DAY_FIELDS.intraNotes}
          value={intraNotes}
          onChange={(e) => setIntraNotes(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label htmlFor={PROCEDURE_DAY_FIELDS.graftsExtracted.id} className="block text-xs font-medium text-gray-700">
          Grafts extracted
          <input
            {...PROCEDURE_DAY_FIELDS.graftsExtracted}
            inputMode="numeric"
            value={graftsExtracted}
            onChange={(e) => setGraftsExtracted(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label htmlFor={PROCEDURE_DAY_FIELDS.graftsImplanted.id} className="block text-xs font-medium text-gray-700">
          Grafts implanted
          <input
            {...PROCEDURE_DAY_FIELDS.graftsImplanted}
            inputMode="numeric"
            value={graftsImplanted}
            onChange={(e) => setGraftsImplanted(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label htmlFor={PROCEDURE_DAY_FIELDS.hairsImplanted.id} className="block text-xs font-medium text-gray-700">
          Hairs implanted
          <input
            {...PROCEDURE_DAY_FIELDS.hairsImplanted}
            inputMode="numeric"
            value={hairsImplanted}
            onChange={(e) => setHairsImplanted(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      {!graftsOk ? <p className="text-xs text-amber-800">Implanted grafts cannot exceed extracted grafts.</p> : null}
      {!timesOk ? <p className="text-xs text-amber-800">Finish time must be on or after start time.</p> : null}

      <label htmlFor={PROCEDURE_DAY_FIELDS.handlingNotes.id} className="block text-xs font-medium text-gray-700">
        Graft survival / handling notes
        <textarea
          {...PROCEDURE_DAY_FIELDS.handlingNotes}
          value={handlingNotes}
          onChange={(e) => setHandlingNotes(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
        />
      </label>
      <label htmlFor={PROCEDURE_DAY_FIELDS.complicationsNotes.id} className="block text-xs font-medium text-gray-700">
        Complications / incidents notes
        <textarea
          {...PROCEDURE_DAY_FIELDS.complicationsNotes}
          value={complicationsNotes}
          onChange={(e) => setComplicationsNotes(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
        />
      </label>
      <label htmlFor={PROCEDURE_DAY_FIELDS.completionSummary.id} className="block text-xs font-medium text-gray-700">
        Procedure completion summary
        <textarea
          {...PROCEDURE_DAY_FIELDS.completionSummary}
          value={completionSummary}
          onChange={(e) => setCompletionSummary(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
        />
      </label>

      {!canSaveStatus ? (
        <p className="text-xs text-amber-800">Pick a standard procedure status before saving.</p>
      ) : null}
      {msg ? <p className="text-xs text-gray-700">{msg}</p> : null}

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
              team_member_user_ids: teamIds,
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
