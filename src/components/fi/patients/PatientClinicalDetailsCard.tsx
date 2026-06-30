"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ClinicalHairLossScaleFields } from "@/src/components/fi/patients/ClinicalHairLossScaleFields";
import { updatePatientClinicalDetailsAction } from "@/lib/actions/fi-patient-actions";
import { CLINICAL_DETAIL_FIELD_LABELS } from "@/src/lib/patients/clinicalDetailsLabels";
import { formatClinicalScalesSummary } from "@/src/lib/patients/hairLossScales";
import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";

function textFromRow(v: string | null | undefined) {
  return v ?? "";
}

function parseJsonObjectField(raw: string, label: string): Record<string, unknown> {
  const t = raw.trim();
  if (!t) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(t);
  } catch {
    throw new Error(`${label}: invalid JSON.`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function buildFormFromRow(data: PatientProfileFoundationData) {
  const row = data.clinicalDetails.row;
  return {
    norwood_scale: textFromRow(row?.norwood_scale),
    ludwig_scale: textFromRow(row?.ludwig_scale),
    hairline_pattern: textFromRow(row?.hairline_pattern),
    primary_concern: textFromRow(row?.primary_concern),
    primary_hair_concern: textFromRow(row?.primary_hair_concern),
    treatment_interest: textFromRow(row?.treatment_interest),
    hair_loss_duration: textFromRow(row?.hair_loss_duration),
    family_history: textFromRow(row?.family_history),
    relevant_medical_history: textFromRow(row?.relevant_medical_history),
    current_medications: textFromRow(row?.current_medications),
    allergies: textFromRow(row?.allergies),
    contraindications: textFromRow(row?.contraindications),
    scalp_conditions: textFromRow(row?.scalp_conditions),
    previous_hair_treatments: textFromRow(row?.previous_hair_treatments),
    clinical_flags: JSON.stringify(row?.clinical_flags && typeof row.clinical_flags === "object" ? row.clinical_flags : {}, null, 2),
    metadata: JSON.stringify(row?.metadata && typeof row.metadata === "object" ? row.metadata : {}, null, 2),
  };
}

type FormState = ReturnType<typeof buildFormFromRow>;

export function PatientClinicalDetailsCard({ tenantId, data }: { tenantId: string; data: PatientProfileFoundationData }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => buildFormFromRow(data));
  const [showJson, setShowJson] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setForm(buildFormFromRow(data));
  }, [data]);

  const baselineStr = useMemo(() => JSON.stringify(buildFormFromRow(data)), [data]);

  const dirty = useMemo(() => JSON.stringify(form) !== baselineStr, [form, baselineStr]);

  const reset = useCallback(() => {
    setForm(buildFormFromRow(data));
    setMsg(null);
  }, [data]);

  const row = data.clinicalDetails.row;

  const scalesSummary = useMemo(() => {
    if (!row) return null;
    return formatClinicalScalesSummary({
      norwood_scale: row.norwood_scale,
      ludwig_scale: row.ludwig_scale,
      hairline_pattern: row.hairline_pattern,
      primary_concern: row.primary_concern,
    });
  }, [row]);

  return (
    <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
      <h2 className="text-sm font-semibold text-slate-100">Clinical details</h2>
      <p className="mt-1 text-xs text-gray-500">
        These details are a structured clinical summary only. Full diagnostics, blood analysis, images, HLI assessments
        and treatment planning will be added in later stages.
      </p>
      {scalesSummary ? (
        <div className="mt-3 rounded-md border border-indigo-100 bg-indigo-500/10 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-300">Pattern summary</p>
          <p className="mt-1 text-sm font-medium text-indigo-200">{scalesSummary}</p>
        </div>
      ) : null}
      {row?.updated_at ? (
        <p className="mt-2 text-xs text-slate-400">
          Last updated:{" "}
          <time dateTime={row.updated_at}>{row.updated_at.slice(0, 16).replace("T", " ")}</time>
          {data.clinicalDetails.updatedByLabel ? (
            <>
              {" "}
              · {data.clinicalDetails.updatedByLabel}
            </>
          ) : null}
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-400">No clinical summary row yet — save to create one.</p>
      )}

      <div className="mt-4 space-y-3">
        <ClinicalHairLossScaleFields
          values={{
            norwood_scale: form.norwood_scale,
            ludwig_scale: form.ludwig_scale,
            hairline_pattern: form.hairline_pattern,
            primary_concern: form.primary_concern,
          }}
          onFieldChange={(key, value) => setForm((f) => ({ ...f, [key]: value }))}
          disabled={pending}
          primaryConcernLabel={CLINICAL_DETAIL_FIELD_LABELS.primary_concern}
        />

        <label className="block text-xs font-medium text-slate-300">
          {CLINICAL_DETAIL_FIELD_LABELS.primary_hair_concern}
          <textarea
            value={form.primary_hair_concern}
            onChange={(e) => setForm((f) => ({ ...f, primary_hair_concern: e.target.value }))}
            rows={2}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          {CLINICAL_DETAIL_FIELD_LABELS.treatment_interest}
          <textarea
            value={form.treatment_interest}
            onChange={(e) => setForm((f) => ({ ...f, treatment_interest: e.target.value }))}
            rows={2}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          {CLINICAL_DETAIL_FIELD_LABELS.hair_loss_duration}
          <textarea
            value={form.hair_loss_duration}
            onChange={(e) => setForm((f) => ({ ...f, hair_loss_duration: e.target.value }))}
            rows={2}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          {CLINICAL_DETAIL_FIELD_LABELS.family_history}
          <textarea
            value={form.family_history}
            onChange={(e) => setForm((f) => ({ ...f, family_history: e.target.value }))}
            rows={3}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          {CLINICAL_DETAIL_FIELD_LABELS.relevant_medical_history}
          <textarea
            value={form.relevant_medical_history}
            onChange={(e) => setForm((f) => ({ ...f, relevant_medical_history: e.target.value }))}
            rows={4}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          {CLINICAL_DETAIL_FIELD_LABELS.current_medications}
          <textarea
            value={form.current_medications}
            onChange={(e) => setForm((f) => ({ ...f, current_medications: e.target.value }))}
            rows={4}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          {CLINICAL_DETAIL_FIELD_LABELS.allergies}
          <textarea
            value={form.allergies}
            onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))}
            rows={3}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          {CLINICAL_DETAIL_FIELD_LABELS.contraindications}
          <textarea
            value={form.contraindications}
            onChange={(e) => setForm((f) => ({ ...f, contraindications: e.target.value }))}
            rows={3}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          {CLINICAL_DETAIL_FIELD_LABELS.scalp_conditions}
          <textarea
            value={form.scalp_conditions}
            onChange={(e) => setForm((f) => ({ ...f, scalp_conditions: e.target.value }))}
            rows={3}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          {CLINICAL_DETAIL_FIELD_LABELS.previous_hair_treatments}
          <textarea
            value={form.previous_hair_treatments}
            onChange={(e) => setForm((f) => ({ ...f, previous_hair_treatments: e.target.value }))}
            rows={3}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>

        <button
          type="button"
          className="text-xs font-medium text-blue-300 hover:underline"
          onClick={() => setShowJson((s) => !s)}
        >
          {showJson ? "Hide" : "Show"} JSON fields ({CLINICAL_DETAIL_FIELD_LABELS.clinical_flags},{" "}
          {CLINICAL_DETAIL_FIELD_LABELS.metadata})
        </button>
        {showJson ? (
          <div className="space-y-3 border-t border-white/[0.06] pt-3">
            <label className="block text-xs font-medium text-slate-300">
              {CLINICAL_DETAIL_FIELD_LABELS.clinical_flags}
              <textarea
                value={form.clinical_flags}
                onChange={(e) => setForm((f) => ({ ...f, clinical_flags: e.target.value }))}
                rows={6}
                spellCheck={false}
                className="mt-1 block w-full rounded border border-slate-700 bg-white/[0.03] px-2 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="block text-xs font-medium text-slate-300">
              {CLINICAL_DETAIL_FIELD_LABELS.metadata}
              <textarea
                value={form.metadata}
                onChange={(e) => setForm((f) => ({ ...f, metadata: e.target.value }))}
                rows={6}
                spellCheck={false}
                className="mt-1 block w-full rounded border border-slate-700 bg-white/[0.03] px-2 py-1.5 font-mono text-xs"
              />
            </label>
          </div>
        ) : null}
      </div>

      {msg ? <p className="mt-2 text-xs text-slate-300">{msg}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={() => {
            setMsg(null);
            startTransition(async () => {
              try {
                const clinical_flags = parseJsonObjectField(form.clinical_flags, "Clinical flags");
                const metadata = parseJsonObjectField(form.metadata, "Metadata");
                const nz = (s: string) => (s.trim() ? s : null);
                const res = await updatePatientClinicalDetailsAction(tenantId, data.foundationPatientId, {
                  norwood_scale: nz(form.norwood_scale),
                  ludwig_scale: nz(form.ludwig_scale),
                  hairline_pattern: nz(form.hairline_pattern),
                  primary_concern: nz(form.primary_concern),
                  primary_hair_concern: nz(form.primary_hair_concern),
                  treatment_interest: nz(form.treatment_interest),
                  hair_loss_duration: nz(form.hair_loss_duration),
                  family_history: nz(form.family_history),
                  relevant_medical_history: nz(form.relevant_medical_history),
                  current_medications: nz(form.current_medications),
                  allergies: nz(form.allergies),
                  contraindications: nz(form.contraindications),
                  scalp_conditions: nz(form.scalp_conditions),
                  previous_hair_treatments: nz(form.previous_hair_treatments),
                  clinical_flags,
                  metadata,
                });
                if (!res.ok) {
                  setMsg(res.error);
                  return;
                }
                setMsg("Saved.");
                router.refresh();
              } catch (e) {
                setMsg(e instanceof Error ? e.message : "Save failed.");
              }
            });
          }}
          className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={reset}
          className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
