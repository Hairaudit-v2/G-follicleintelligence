"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { convertCrmLeadAction } from "@/lib/actions/fi-crm-actions";
import type { CrmLeadConversionState } from "@/src/lib/crm/types";

const card =
  "rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40";

function personLabel(person: CrmLeadConversionState["person"]): string {
  if (!person) return "—";
  const m = person.metadata;
  const dn = typeof m.display_name === "string" ? m.display_name.trim() : "";
  const em = typeof m.email === "string" ? m.email.trim() : "";
  if (dn) return dn;
  if (em) return em;
  return person.id;
}

export function CrmLeadConversionPanel({
  tenantId,
  leadId,
  conversionState,
}: {
  tenantId: string;
  leadId: string;
  conversionState: CrmLeadConversionState | null;
}) {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState("");
  const [seedCase, setSeedCase] = useState(false);
  const [caseType, setCaseType] = useState("");
  const [treatmentInterest, setTreatmentInterest] = useState("");
  const [conversionNote, setConversionNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!conversionState) {
    return null;
  }

  const { lead, person, patient, case: caseRow } = conversionState;
  const converted = Boolean(lead.converted_at);
  const canSeedCase = !lead.case_id;

  function withAdmin<T extends Record<string, unknown>>(body: T): T & { adminKey?: string } {
    if (adminKey.trim()) return { ...body, adminKey: adminKey.trim() };
    return body;
  }

  async function onConvert(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setBusy(true);
    try {
      const r = await convertCrmLeadAction(
        tenantId,
        leadId,
        withAdmin({
          seedCase: seedCase && canSeedCase,
          caseType: caseType.trim() || null,
          treatmentInterest: treatmentInterest.trim() || null,
          conversionNote: conversionNote.trim() || null,
        })
      );
      setFeedback(r.ok ? "Conversion completed." : r.error);
      if (r.ok) {
        setSeedCase(false);
        setCaseType("");
        setTreatmentInterest("");
        setConversionNote("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={card}>
      <h2 className="mb-1 text-sm font-semibold text-slate-100">Lead conversion</h2>
      <p className="mb-3 text-xs text-slate-400">
        Conversion preserves the CRM lead history and creates the patient foundation for bookings,
        clinical records, images, and treatment planning.
      </p>

      <div className="mb-3 rounded border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-slate-300">
        <p>
          <span className="font-medium text-slate-100">Person on lead:</span> {personLabel(person)}{" "}
          <span className="font-mono text-gray-500">({lead.person_id})</span>
        </p>
        {patient ? (
          <p className="mt-1">
            <span className="font-medium text-slate-100">Patient record:</span>{" "}
            <span className="font-mono">{patient.id}</span>
          </p>
        ) : null}
        {caseRow ? (
          <p className="mt-1">
            <span className="font-medium text-slate-100">Linked patient:</span>{" "}
            <span className="font-mono">{caseRow.id}</span> ({caseRow.status})
          </p>
        ) : null}
      </div>

      {converted ? (
        <div className="space-y-2 text-sm text-slate-300">
          <p className="font-medium text-slate-100">Conversion complete</p>
          <p className="text-xs text-slate-400">Converted at {lead.converted_at}</p>
          {lead.converted_person_id ? (
            <p className="text-xs">
              Linked person: <span className="font-mono">{lead.converted_person_id}</span>
            </p>
          ) : null}
          {lead.converted_case_id ? (
            <p className="text-xs">
              Seeded patient: <span className="font-mono">{lead.converted_case_id}</span>
            </p>
          ) : null}
          <p className="text-xs text-gray-500">
            This lead cannot be converted again from this panel. Contact an administrator to relink
            if needed.
          </p>
        </div>
      ) : (
        <form onSubmit={onConvert} className="space-y-3 text-sm">
          <label className="block max-w-md text-xs">
            <span className="text-slate-400">FI admin key (optional)</span>
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1"
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={seedCase && canSeedCase}
              disabled={!canSeedCase}
              onChange={(e) => setSeedCase(e.target.checked)}
            />
            Create draft patient record now (adds a{" "}
            <code className="rounded bg-white/[0.06] px-0.5">fi_cases</code> shell in{" "}
            <code className="rounded bg-white/[0.06] px-0.5">draft</code> status)
          </label>
          {!canSeedCase ? (
            <p className="text-xs text-amber-300">
              This lead already has a patient link; a second shell is not created here.
            </p>
          ) : null}

          {seedCase && canSeedCase ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-400">
                Patient type (optional, stored in patient metadata)
                <input
                  value={caseType}
                  onChange={(e) => setCaseType(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1"
                  maxLength={128}
                />
              </label>
              <label className="text-xs text-slate-400">
                Treatment interest (optional)
                <input
                  value={treatmentInterest}
                  onChange={(e) => setTreatmentInterest(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1"
                  maxLength={512}
                />
              </label>
            </div>
          ) : null}

          <label className="block text-xs text-slate-400">
            Internal conversion note (optional, stored on lead metadata only — not in activity)
            <textarea
              value={conversionNote}
              onChange={(e) => setConversionNote(e.target.value)}
              rows={2}
              className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1"
              maxLength={2000}
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="rounded bg-gray-800 px-3 py-1.5 text-xs text-white disabled:opacity-50"
          >
            Convert lead to patient
          </button>
        </form>
      )}

      {feedback ? <p className="mt-3 text-sm text-slate-200">{feedback}</p> : null}
    </section>
  );
}
