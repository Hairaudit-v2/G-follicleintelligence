"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCaseProfileAction } from "@/lib/actions/fi-case-actions";
import { CASE_DETAIL_SECTION_IDS, caseDetailSectionHeadingId } from "@/src/lib/cases/caseDetailNavConstants";
import { FI_CASE_STATUS_VALUES, isFiCaseStatus } from "@/src/lib/cases/caseTypes";

import { caseFormField } from "./caseFormFieldProps";

const SUMMARY_FIELDS = {
  status: caseFormField("summary-status"),
  treatmentType: caseFormField("summary-treatment-type"),
  caseType: caseFormField("summary-case-type"),
} as const;

export type CaseSummaryCardModel = {
  id: string;
  status: string;
  treatment_type: string | null;
  case_type: string | null;
  external_id: string | null;
  created_at: string;
  updated_at: string;
  clinic_id: string | null;
  organisation_id: string | null;
  partner_id: string | null;
};

export function CaseSummaryCard({ tenantId, initial }: { tenantId: string; initial: CaseSummaryCardModel }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial.status);
  const [treatmentType, setTreatmentType] = useState(initial.treatment_type ?? "");
  const [caseType, setCaseType] = useState(initial.case_type ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setStatus(initial.status);
    setTreatmentType(initial.treatment_type ?? "");
    setCaseType(initial.case_type ?? "");
  }, [initial.status, initial.treatment_type, initial.case_type, initial.updated_at]);

  const dirty = useMemo(() => {
    const t0 = initial.treatment_type ?? "";
    const c0 = initial.case_type ?? "";
    return (
      status !== initial.status ||
      treatmentType.trim() !== t0.trim() ||
      caseType.trim() !== c0.trim()
    );
  }, [status, treatmentType, caseType, initial.status, initial.treatment_type, initial.case_type]);

  return (
    <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">
      <h2 id={caseDetailSectionHeadingId(CASE_DETAIL_SECTION_IDS.summary)} className="text-sm font-semibold text-gray-900">
        Patient summary
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        Stage 5A profile fields. Graft planning, procedure-day workflow, and audit scoring ship in later stages.
      </p>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-gray-500">Patient id</dt>
          <dd className="font-mono text-xs text-gray-800">{initial.id}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-gray-500">External id</dt>
          <dd className="text-gray-800">{initial.external_id?.trim() ? initial.external_id : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-gray-500">Created</dt>
          <dd className="text-gray-800">{initial.created_at ? new Date(initial.created_at).toLocaleString() : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-gray-500">Updated</dt>
          <dd className="text-gray-800">{initial.updated_at ? new Date(initial.updated_at).toLocaleString() : "—"}</dd>
        </div>
        {initial.clinic_id ? (
          <div>
            <dt className="text-xs font-medium text-gray-500">Clinic id</dt>
            <dd className="font-mono text-xs text-gray-700">{initial.clinic_id}</dd>
          </div>
        ) : null}
        {initial.organisation_id ? (
          <div>
            <dt className="text-xs font-medium text-gray-500">Organisation id</dt>
            <dd className="font-mono text-xs text-gray-700">{initial.organisation_id}</dd>
          </div>
        ) : null}
        {initial.partner_id ? (
          <div>
            <dt className="text-xs font-medium text-gray-500">Partner id</dt>
            <dd className="font-mono text-xs text-gray-700">{initial.partner_id}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-6 space-y-3 border-t border-gray-100 pt-4">
        <label htmlFor={SUMMARY_FIELDS.status.id} className="block text-xs font-medium text-gray-700">
          Patient status
          <select
            {...SUMMARY_FIELDS.status}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 block w-full max-w-xs rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            {!isFiCaseStatus(status) ? (
              <option value={status}>
                {status} (non-standard)
              </option>
            ) : null}
            {FI_CASE_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={SUMMARY_FIELDS.treatmentType.id} className="block text-xs font-medium text-gray-700">
          Treatment type
          <input
            {...SUMMARY_FIELDS.treatmentType}
            value={treatmentType}
            onChange={(e) => setTreatmentType(e.target.value)}
            className="mt-1 block w-full max-w-md rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
            placeholder="e.g. FUE, consultation pathway…"
          />
        </label>
        <label htmlFor={SUMMARY_FIELDS.caseType.id} className="block text-xs font-medium text-gray-700">
          Patient type
          <input
            {...SUMMARY_FIELDS.caseType}
            value={caseType}
            onChange={(e) => setCaseType(e.target.value)}
            className="mt-1 block w-full max-w-md rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
            placeholder="Stored in patient metadata (producer / bridge label)."
          />
        </label>
      </div>

      {msg ? <p className="mt-3 text-xs text-gray-700">{msg}</p> : null}
      {!isFiCaseStatus(status) ? (
        <p className="mt-2 text-xs text-amber-800">
          This case&apos;s status is not in the standard set. Choose a standard status before saving profile fields.
        </p>
      ) : null}
      <button
        type="button"
        disabled={pending || !dirty || !isFiCaseStatus(status)}
        onClick={() => {
          setMsg(null);
          startTransition(async () => {
            const res = await updateCaseProfileAction(tenantId, initial.id, {
              status,
              treatment_type: treatmentType.trim() ? treatmentType.trim() : null,
              case_type: caseType.trim() ? caseType.trim() : null,
            });
            if (!res.ok) {
              setMsg(res.error);
              return;
            }
            setMsg("Saved.");
            router.refresh();
          });
        }}
        className="mt-3 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {pending ? "Saving…" : "Save profile fields"}
      </button>
    </div>
  );
}
