"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  cancelPrescriptionAction,
  markPrescriptionReadyForPharmacyAction,
  savePrescriptionDraftAction,
  signPrescriptionAction,
} from "@/lib/actions/fi-prescribing-actions";
import { PrescriptionPharmacySendPanel } from "@/src/components/fi-admin/prescribing/PrescriptionPharmacySendPanel";
import { StaffReadinessPickerWarning } from "@/src/components/fi/staff/StaffClinicalPickerFields";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import type { FiCompoundPharmacyRow, FiPharmacyTransmissionRow } from "@/src/lib/prescribing/fiPharmacyLoaders.server";
import type {
  FiMedicationCatalogueRow,
  FiPrescriptionStatusEventRow,
  MedicationCatalogueCategory,
  PrescriptionStatus,
} from "@/src/lib/prescribing/fiPrescribingTypes";
import {
  MEDICATION_CATALOGUE_CATEGORIES,
  MEDICATION_CATEGORY_LABELS,
  PRESCRIPTION_STATUS_LABELS,
} from "@/src/lib/prescribing/fiPrescribingTypes";

function formatRxEventStatus(st: string): string {
  if (st in PRESCRIPTION_STATUS_LABELS) {
    return PRESCRIPTION_STATUS_LABELS[st as PrescriptionStatus];
  }
  if (st === "ready_for_pharmacy") return "Ready for pharmacy (queued internally)";
  if (st === "pharmacy_acknowledged") return "Pharmacy acknowledged";
  return st.replace(/_/g, " ");
}

export type PrescriptionEditorLine = {
  key: string;
  catalogueId: string;
  doseInstructions: string;
  repeatsInstructions: string;
  reorderRule: string;
  repeatRulesPrescriberConfirmed: boolean;
};

export type PrescriptionEditorStaffOption = {
  id: string;
  label: string;
  clinicallyAvailable?: boolean;
  blockReason?: string | null;
};

export function PrescriptionEditorClient({
  tenantId,
  patientId,
  caseId,
  initialPrescriptionId,
  initialStatus,
  initialDoctorId,
  initialClinicalNotes,
  initialDeliveryType,
  initialPatientShippingAddress,
  initialPharmacyName,
  initialReadyForPharmacyAt,
  initialSignedAt,
  initialItems,
  catalogue,
  staffOptions,
  initialEvents,
  initialPharmacies = [],
  initialTransmissions = [],
  initialRepeatsAllowed = false,
  initialRepeatLimit = 0,
  initialReorderValidFrom = "",
  initialReorderValidUntil = "",
  initialReorderReviewRequired = false,
  initialPatientReorderFeePence = "",
  initialReorderFeePaymentRequired = false,
}: {
  tenantId: string;
  patientId: string;
  caseId: string | null;
  initialPrescriptionId: string | null;
  initialStatus: PrescriptionStatus;
  initialDoctorId: string;
  initialClinicalNotes: string;
  initialDeliveryType: string;
  initialPatientShippingAddress: string;
  initialPharmacyName: string;
  initialReadyForPharmacyAt: string | null;
  initialSignedAt: string | null;
  initialItems: PrescriptionEditorLine[];
  catalogue: FiMedicationCatalogueRow[];
  staffOptions: PrescriptionEditorStaffOption[];
  initialEvents: FiPrescriptionStatusEventRow[];
  initialPharmacies?: FiCompoundPharmacyRow[];
  initialTransmissions?: FiPharmacyTransmissionRow[];
  initialRepeatsAllowed?: boolean;
  initialRepeatLimit?: number;
  initialReorderValidFrom?: string;
  initialReorderValidUntil?: string;
  initialReorderReviewRequired?: boolean;
  initialPatientReorderFeePence?: string;
  initialReorderFeePaymentRequired?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [prescriptionId, setPrescriptionId] = useState<string | null>(initialPrescriptionId);
  const [status, setStatus] = useState<PrescriptionStatus>(initialStatus);
  const [doctorId, setDoctorId] = useState(initialDoctorId);
  const [clinicalNotes, setClinicalNotes] = useState(initialClinicalNotes);
  const [deliveryType, setDeliveryType] = useState(initialDeliveryType);
  const [patientShippingAddress, setPatientShippingAddress] = useState(initialPatientShippingAddress);
  const [pharmacyName, setPharmacyName] = useState(initialPharmacyName);
  const [readyForPharmacyAt, setReadyForPharmacyAt] = useState<string | null>(initialReadyForPharmacyAt);
  const [signedAt, setSignedAt] = useState<string | null>(initialSignedAt);
  const [events, setEvents] = useState(initialEvents);

  const [repeatsAllowed, setRepeatsAllowed] = useState(initialRepeatsAllowed);
  const [repeatLimit, setRepeatLimit] = useState(initialRepeatLimit);
  const [reorderValidFrom, setReorderValidFrom] = useState(
    initialReorderValidFrom ? initialReorderValidFrom.slice(0, 16) : ""
  );
  const [reorderValidUntil, setReorderValidUntil] = useState(
    initialReorderValidUntil ? initialReorderValidUntil.slice(0, 16) : ""
  );
  const [reorderReviewRequired, setReorderReviewRequired] = useState(initialReorderReviewRequired);
  const [patientReorderFeePence, setPatientReorderFeePence] = useState(initialPatientReorderFeePence);
  const [reorderFeePaymentRequired, setReorderFeePaymentRequired] = useState(initialReorderFeePaymentRequired);

  const [lines, setLines] = useState<PrescriptionEditorLine[]>(() =>
    initialItems.length
      ? initialItems
      : [
          {
            key: crypto.randomUUID(),
            catalogueId: "",
            doseInstructions: "",
            repeatsInstructions: "",
            reorderRule: "",
            repeatRulesPrescriberConfirmed: false,
          },
        ]
  );

  const isDraft = status === "draft";
  const isSigned = status === "signed";
  const isCancelled = status === "cancelled";

  const catalogueByCategory = useMemo(() => {
    const m = new Map<MedicationCatalogueCategory, FiMedicationCatalogueRow[]>();
    for (const row of catalogue) {
      const k = row.category;
      const arr = m.get(k) ?? [];
      arr.push(row);
      m.set(k, arr);
    }
    return m;
  }, [catalogue]);

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        catalogueId: "",
        doseInstructions: "",
        repeatsInstructions: "",
        reorderRule: "",
        repeatRulesPrescriberConfirmed: false,
      },
    ]);
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  }

  function updateLine(key: string, patch: Partial<Omit<PrescriptionEditorLine, "key">>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function saveDraft() {
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      const items = lines
        .filter((l) => l.catalogueId.trim())
        .map((l, idx) => ({
          catalogueId: l.catalogueId.trim(),
          doseInstructions: l.doseInstructions,
          repeatsInstructions: l.repeatsInstructions.trim() || null,
          reorderRule: l.reorderRule.trim() || null,
          repeatRulesPrescriberConfirmed: l.repeatRulesPrescriberConfirmed,
          sortOrder: idx,
        }));
      const res = await savePrescriptionDraftAction({
        tenantId,
        prescriptionId: prescriptionId ?? undefined,
        patientId,
        doctorId,
        caseId: caseId ?? undefined,
        clinicalNotes: clinicalNotes.trim() || null,
        deliveryType: deliveryType.trim() || null,
        patientShippingAddress: patientShippingAddress.trim() || null,
        pharmacyName: pharmacyName.trim() || null,
        repeatsAllowed,
        repeatLimit,
        reorderValidFrom: reorderValidFrom.trim()
          ? (Number.isNaN(Date.parse(reorderValidFrom)) ? null : new Date(reorderValidFrom).toISOString())
          : null,
        reorderValidUntil: reorderValidUntil.trim()
          ? (Number.isNaN(Date.parse(reorderValidUntil)) ? null : new Date(reorderValidUntil).toISOString())
          : null,
        reorderReviewRequired,
        patientReorderFeePence: patientReorderFeePence.trim() ? Number(patientReorderFeePence.trim()) : null,
        reorderFeePaymentRequired,
        items,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setMsg("Draft saved.");
      if (!prescriptionId) {
        setPrescriptionId(res.id);
        router.replace(`/fi-admin/${tenantId.trim()}/prescriptions/${res.id}`);
      } else {
        router.refresh();
      }
    });
  }

  function sign() {
    setErr(null);
    setMsg(null);
    if (!prescriptionId) {
      setErr("Save the draft first.");
      return;
    }
    startTransition(async () => {
      const res = await signPrescriptionAction({ tenantId, prescriptionId });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setStatus("signed");
      setSignedAt(new Date().toISOString());
      setEvents((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          prescription_id: prescriptionId,
          from_status: "draft",
          to_status: "signed",
          actor_fi_user_id: null,
          note: "Prescription signed",
          created_at: new Date().toISOString(),
        },
      ]);
      setMsg("Prescription signed.");
      router.refresh();
    });
  }

  function markReady() {
    setErr(null);
    setMsg(null);
    if (!prescriptionId) return;
    startTransition(async () => {
      const res = await markPrescriptionReadyForPharmacyAction({ tenantId, prescriptionId });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      const ts = new Date().toISOString();
      setReadyForPharmacyAt(ts);
      setEvents((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          prescription_id: prescriptionId,
          from_status: "signed",
          to_status: "ready_for_pharmacy",
          actor_fi_user_id: null,
          note: "Marked ready for pharmacy (internal queue — not transmitted)",
          created_at: ts,
        },
      ]);
      setMsg("Marked ready for pharmacy (internal queue).");
      router.refresh();
    });
  }

  function cancel() {
    if (!window.confirm("Cancel this prescription?")) return;
    setErr(null);
    setMsg(null);
    if (!prescriptionId) return;
    startTransition(async () => {
      const res = await cancelPrescriptionAction({ tenantId, prescriptionId });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setStatus("cancelled");
      setMsg("Prescription cancelled.");
      router.refresh();
    });
  }

  const canEditBody = isDraft && !pending;
  const canSign = isDraft && prescriptionId && lines.some((l) => l.catalogueId.trim());
  const canMarkReady = isSigned && prescriptionId && !readyForPharmacyAt;

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <p className="text-sm text-slate-400">
        <Link href={`/fi-admin/${tenantId.trim()}/patients/${patientId}`} className="text-cyan-300 hover:underline">
          ← Patient profile
        </Link>
        {caseId ? (
          <>
            <span className="mx-2 text-slate-300">·</span>
            <Link href={`/fi-admin/${tenantId.trim()}/cases/${caseId}`} className="text-cyan-300 hover:underline">
              Case
            </Link>
          </>
        ) : null}
        <span className="mx-2 text-slate-300">·</span>
        <Link href={`/fi-admin/${tenantId.trim()}/prescriptions`} className="text-cyan-300 hover:underline">
          Prescriptions workspace
        </Link>
      </p>

      <FiCard>
        <FiPageHeader
          titleId="rx-editor-heading"
          eyebrow="DoctorOS"
          title={prescriptionId ? "Edit prescription" : "New prescription"}
          description={`Status: ${PRESCRIPTION_STATUS_LABELS[status]}${
            signedAt ? ` · Signed ${new Date(signedAt).toLocaleString()}` : ""
          }${readyForPharmacyAt ? " · Ready for pharmacy (queued internally)" : ""}`}
        />
        {err ? <p className="mt-2 text-sm text-rose-300">{err}</p> : null}
        {msg ? <p className="mt-2 text-sm text-emerald-300">{msg}</p> : null}
      </FiCard>

      <FiCard>
        <h2 className="text-sm font-semibold text-slate-100">Prescriber & logistics</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-xs font-medium text-slate-300">
            Doctor (fi_staff)
            <select
              className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-2 text-sm"
              value={doctorId}
              disabled={!canEditBody}
              onChange={(e) => setDoctorId(e.target.value)}
            >
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id} disabled={s.clinicallyAvailable === false}>
                  {s.label}
                </option>
              ))}
            </select>
            {(() => {
              const selected = staffOptions.find((s) => s.id === doctorId);
              if (!selected || selected.clinicallyAvailable !== false) return null;
              return (
                <StaffReadinessPickerWarning tenantId={tenantId} blockReason={selected.blockReason ?? null} />
              );
            })()}
          </label>
          <label className="block text-xs font-medium text-slate-300">
            Delivery type
            <input
              className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-2 text-sm"
              value={deliveryType}
              disabled={!canEditBody}
              onChange={(e) => setDeliveryType(e.target.value)}
              placeholder="e.g. Standard / Express"
            />
          </label>
          <label className="block text-xs font-medium text-slate-300 md:col-span-2">
            Pharmacy name (optional)
            <input
              className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-2 text-sm"
              value={pharmacyName}
              disabled={!canEditBody}
              onChange={(e) => setPharmacyName(e.target.value)}
              placeholder="Compound partner label"
            />
          </label>
          <label className="block text-xs font-medium text-slate-300 md:col-span-2">
            Patient shipping address
            <textarea
              className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-2 text-sm"
              rows={3}
              value={patientShippingAddress}
              disabled={!canEditBody}
              onChange={(e) => setPatientShippingAddress(e.target.value)}
              placeholder="Full postal address for delivery when you send to pharmacy in a later stage."
            />
          </label>
          <label className="block text-xs font-medium text-slate-300 md:col-span-2">
            Clinical notes
            <textarea
              className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-2 text-sm"
              rows={4}
              value={clinicalNotes}
              disabled={!canEditBody}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Indications, monitoring, counselling points…"
            />
          </label>
        </div>
      </FiCard>

      <FiCard>
        <h2 className="text-sm font-semibold text-slate-100">Patient reorder programme (portal)</h2>
        <p className="mt-1 text-xs text-slate-400">
          Controls whether this signed prescription appears in the patient portal for refills. Requires repeat limit ≥ 1
          when repeats are allowed.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-200 md:col-span-2">
            <input
              type="checkbox"
              checked={repeatsAllowed}
              disabled={!canEditBody}
              onChange={(e) => setRepeatsAllowed(e.target.checked)}
            />
            Allow patient portal repeats / reorders
          </label>
          <label className="block text-xs font-medium text-slate-300">
            Repeat limit (max approved reorders)
            <input
              type="number"
              min={0}
              max={99}
              className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-2 text-sm"
              value={repeatLimit}
              disabled={!canEditBody}
              onChange={(e) => setRepeatLimit(Number(e.target.value))}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-200">
            <input
              type="checkbox"
              checked={reorderReviewRequired}
              disabled={!canEditBody}
              onChange={(e) => setReorderReviewRequired(e.target.checked)}
            />
            Every patient reorder requires doctor review
          </label>
          <label className="block text-xs font-medium text-slate-300">
            Reorder window start (local)
            <input
              type="datetime-local"
              className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-2 text-sm"
              value={reorderValidFrom}
              disabled={!canEditBody}
              onChange={(e) => setReorderValidFrom(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-slate-300">
            Reorder window end (local)
            <input
              type="datetime-local"
              className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-2 text-sm"
              value={reorderValidUntil}
              disabled={!canEditBody}
              onChange={(e) => setReorderValidUntil(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-slate-300">
            Patient reorder fee (pence, optional)
            <input
              type="number"
              min={0}
              className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-2 text-sm"
              value={patientReorderFeePence}
              disabled={!canEditBody}
              onChange={(e) => setPatientReorderFeePence(e.target.value)}
              placeholder="e.g. 500 for £5.00"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-200">
            <input
              type="checkbox"
              checked={reorderFeePaymentRequired}
              disabled={!canEditBody}
              onChange={(e) => setReorderFeePaymentRequired(e.target.checked)}
            />
            Require payment acknowledgement before patient can submit
          </label>
        </div>
      </FiCard>

      <FiCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-100">Medication lines</h2>
          {canEditBody ? (
            <button
              type="button"
              onClick={addLine}
              className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.03]"
            >
              Add line
            </button>
          ) : null}
        </div>
        <div className="mt-4 space-y-4">
          {lines.map((line) => (
            <div key={line.key} className="rounded border border-white/[0.08] bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <label className="block min-w-[12rem] flex-1 text-xs font-medium text-slate-300">
                  Catalogue item
                  <select
                    className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-2 text-sm"
                    value={line.catalogueId}
                    disabled={!canEditBody}
                    onChange={(e) => updateLine(line.key, { catalogueId: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {MEDICATION_CATALOGUE_CATEGORIES.map((cat) => {
                      const rows = catalogueByCategory.get(cat) ?? [];
                      if (!rows.length) return null;
                      return (
                      <optgroup key={cat} label={MEDICATION_CATEGORY_LABELS[cat]}>
                        {rows.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.medication_name} — {r.quantity_label} (${Number(r.base_price).toFixed(2)})
                            {r.requires_doctor_approval ? " (MD approval)" : ""}
                          </option>
                        ))}
                      </optgroup>
                      );
                    })}
                  </select>
                </label>
                {canEditBody ? (
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    className="text-xs font-medium text-rose-300 hover:underline"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <label className="mt-3 block text-xs font-medium text-slate-300">
                Dose instructions
                <textarea
                  className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-2 text-sm"
                  rows={2}
                  value={line.doseInstructions}
                  disabled={!canEditBody}
                  onChange={(e) => updateLine(line.key, { doseInstructions: e.target.value })}
                  placeholder="e.g. 1 capsule daily with food"
                />
              </label>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block text-xs font-medium text-slate-300">
                  Repeats / refill instructions
                  <textarea
                    className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-2 text-sm"
                    rows={2}
                    value={line.repeatsInstructions}
                    disabled={!canEditBody}
                    onChange={(e) => updateLine(line.key, { repeatsInstructions: e.target.value })}
                    placeholder="e.g. 2 repeats; contact clinic before final repeat"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-300">
                  Reorder rule
                  <textarea
                    className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-2 text-sm"
                    rows={2}
                    value={line.reorderRule}
                    disabled={!canEditBody}
                    onChange={(e) => updateLine(line.key, { reorderRule: e.target.value })}
                    placeholder="e.g. Allow early refill if travelling"
                  />
                </label>
              </div>
              {line.repeatsInstructions.trim() || line.reorderRule.trim() ? (
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-slate-200">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={line.repeatRulesPrescriberConfirmed}
                    disabled={!canEditBody}
                    onChange={(e) => updateLine(line.key, { repeatRulesPrescriberConfirmed: e.target.checked })}
                  />
                  <span>
                    Prescriber confirms repeat / reorder rules for this line (required to sign and send to pharmacy).
                  </span>
                </label>
              ) : null}
            </div>
          ))}
        </div>
      </FiCard>

      <div className="flex flex-wrap gap-2">
        {canEditBody ? (
          <button
            type="button"
            disabled={pending}
            onClick={saveDraft}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400"
          >
            {pending ? "Saving…" : "Save draft"}
          </button>
        ) : null}
        {canSign ? (
          <button
            type="button"
            disabled={pending}
            onClick={sign}
            className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:bg-slate-400"
          >
            Sign prescription
          </button>
        ) : null}
        {canMarkReady ? (
          <button
            type="button"
            disabled={pending}
            onClick={markReady}
            className="rounded border border-sky-600 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/15 disabled:opacity-50"
          >
            Mark ready for pharmacy
          </button>
        ) : null}
        {!isCancelled ? (
          <button
            type="button"
            disabled={pending}
            onClick={cancel}
            className="rounded border border-red-300 bg-[#0F1629]/80 backdrop-blur-md px-4 py-2 text-sm font-medium text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
          >
            Cancel prescription
          </button>
        ) : null}
      </div>

      {prescriptionId ? (
        <PrescriptionPharmacySendPanel
          tenantId={tenantId}
          patientId={patientId}
          prescriptionId={prescriptionId}
          prescriptionStatus={status}
          pharmacies={initialPharmacies}
          transmissions={initialTransmissions}
        />
      ) : null}

      <FiCard>
        <h2 className="text-sm font-semibold text-slate-100">Workflow log</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          {events.map((ev) => (
            <li key={ev.id} className="border-b border-white/[0.06] pb-2 last:border-0">
              <span className="font-mono text-xs text-slate-500">{new Date(ev.created_at).toLocaleString()}</span>
              {ev.from_status ? (
                <span className="ml-2 text-xs">
                  {formatRxEventStatus(ev.from_status)} → {formatRxEventStatus(ev.to_status)}
                </span>
              ) : (
                <span className="ml-2 text-xs">{formatRxEventStatus(ev.to_status)}</span>
              )}
              {ev.note ? <p className="mt-0.5 text-xs text-slate-400">{ev.note}</p> : null}
            </li>
          ))}
        </ul>
      </FiCard>
    </div>
  );
}
