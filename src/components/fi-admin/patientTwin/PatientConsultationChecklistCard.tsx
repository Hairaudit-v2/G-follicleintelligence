"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { FiSection } from "@/src/components/fi-design/FiSection";
import {
  generatePatientConsultationChecklistAction,
  updateConsultationChecklistReviewAction,
} from "@/src/lib/actions/fi-consultation-checklist-actions";
import {
  HIE_CONSULTATION_CHECKLIST_STATUSES,
  HIE_CONSULTATION_CONSENT_COMPLEXITY_LEVELS,
  HIE_CONSULTATION_PRIORITY_LEVELS,
  HIE_CONSULTATION_REVIEW_STATUSES,
} from "@/src/lib/hair-intelligence/consultationChecklist/types";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{children}</p>
  );
}

function priorityBadgeClass(p: string): string {
  switch (p) {
    case "urgent":
      return "bg-rose-600/90 text-white";
    case "high":
      return "bg-orange-500/90 text-white";
    case "moderate":
      return "bg-amber-500/90 text-slate-100";
    default:
      return "bg-slate-600/80 text-white";
  }
}

export function PatientConsultationChecklistCard({
  tenantId,
  patientId,
  twin,
}: {
  tenantId: string;
  patientId: string;
  twin: PatientTwinV1;
}) {
  const { consultation_checklist: cc } = twin.intelligence;
  const latest = cc.latest;

  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [editId, setEditId] = useState(() => cc.latest?.id ?? "");
  const [priority, setPriority] = useState(latest?.priority_level ?? "low");
  const [review, setReview] = useState(latest?.review_status ?? "pending");
  const [checklistStatus, setChecklistStatus] = useState(latest?.checklist_status ?? "generated");
  const [conf, setConf] = useState(latest != null ? String(latest.confidence_score) : "0");
  const [med, setMed] = useState(latest?.medication_discussion_required ?? false);
  const [stab, setStab] = useState(latest?.stabilisation_discussion_required ?? false);
  const [donor, setDonor] = useState(latest?.donor_preservation_discussion_required ?? false);
  const [expect, setExpect] = useState(latest?.expectation_management_required ?? false);
  const [consent, setConsent] = useState(latest?.consent_complexity_level ?? "unknown");
  const [doc, setDoc] = useState(latest?.documentation_required ?? false);
  const [follow, setFollow] = useState(latest?.follow_up_required ?? false);
  const [delay, setDelay] = useState(latest?.delay_recommended ?? false);
  const [summary, setSummary] = useState(latest?.consultation_summary ?? "");
  const [aiNotes, setAiNotes] = useState(latest?.ai_notes ?? "");
  const [itemsText, setItemsText] = useState(() => (latest?.checklist_items ?? []).join("\n"));
  const [flagsText, setFlagsText] = useState(() => (latest?.risk_flags ?? []).join("\n"));

  const syncEditRow = useCallback(
    (id: string) => {
      const row = cc.recent.find((r) => r.id === id);
      if (!row) return;
      setPriority(row.priority_level);
      setReview(row.review_status);
      setChecklistStatus(row.checklist_status);
      setConf(String(row.confidence_score));
      setMed(row.medication_discussion_required);
      setStab(row.stabilisation_discussion_required);
      setDonor(row.donor_preservation_discussion_required);
      setExpect(row.expectation_management_required);
      setConsent(row.consent_complexity_level ?? "unknown");
      setDoc(row.documentation_required);
      setFollow(row.follow_up_required);
      setDelay(row.delay_recommended);
      setSummary(row.consultation_summary ?? "");
      setAiNotes(row.ai_notes ?? "");
      setItemsText((row.checklist_items ?? []).join("\n"));
      setFlagsText((row.risk_flags ?? []).join("\n"));
    },
    [cc.recent]
  );

  useEffect(() => {
    if (cc.recent.length === 0) return;
    const preferred = cc.latest?.id ?? cc.recent[0].id;
    if (!editId || !cc.recent.some((r) => r.id === editId)) {
      setEditId(preferred);
      syncEditRow(preferred);
    }
  }, [cc.latest?.id, cc.recent, editId, syncEditRow]);

  const displayLatest = useMemo(() => cc.latest, [cc.latest]);

  return (
    <FiSection
      surfaceVariant="darkGlass"
      headingId="patient-twin-consultation-checklist-heading"
      title="Surgeon consultation checklist (HIE)"
      description="Stage 10 engine combines hair loss, progression, donor, recipient, therapy, and pathology presence into discussion-only checklist topics. Stored in hair_intelligence_consultation_checklists."
    >
      <p className="mb-3 rounded-md border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-100/95">
        Checklist intelligence supports clinician preparation and does not replace medical
        judgement. It does not recommend surgery, graft counts, hairline design, outcomes, or
        autonomous treatment decisions.
      </p>

      {message ? <p className="mb-2 text-xs text-amber-200/90">{message}</p> : null}

      {displayLatest ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${priorityBadgeClass(displayLatest.priority_level)}`}
          >
            Priority: {displayLatest.priority_level}
          </span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-200">
            Status: {displayLatest.checklist_status}
          </span>
        </div>
      ) : null}

      {displayLatest && displayLatest.checklist_items.length > 0 ? (
        <div className="mt-1">
          <FieldLabel>Checklist items</FieldLabel>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-300">
            {displayLatest.checklist_items.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {displayLatest && displayLatest.risk_flags.length > 0 ? (
        <div className="mt-4">
          <FieldLabel>Risk flags</FieldLabel>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-100/90">
            {displayLatest.risk_flags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {displayLatest ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Medication discussion</FieldLabel>
            <p className="mt-0.5 text-sm text-slate-200">
              {displayLatest.medication_discussion_required ? "Yes" : "No"}
            </p>
          </div>
          <div>
            <FieldLabel>Stabilisation discussion</FieldLabel>
            <p className="mt-0.5 text-sm text-slate-200">
              {displayLatest.stabilisation_discussion_required ? "Yes" : "No"}
            </p>
          </div>
          <div>
            <FieldLabel>Donor preservation discussion</FieldLabel>
            <p className="mt-0.5 text-sm text-slate-200">
              {displayLatest.donor_preservation_discussion_required ? "Yes" : "No"}
            </p>
          </div>
          <div>
            <FieldLabel>Expectation management</FieldLabel>
            <p className="mt-0.5 text-sm text-slate-200">
              {displayLatest.expectation_management_required ? "Yes" : "No"}
            </p>
          </div>
          <div>
            <FieldLabel>Consent complexity</FieldLabel>
            <p className="mt-0.5 text-sm text-slate-200">
              {displayLatest.consent_complexity_level ?? "—"}
            </p>
          </div>
          <div>
            <FieldLabel>Delay recommended (discussion)</FieldLabel>
            <p className="mt-0.5 text-sm text-slate-200">
              {displayLatest.delay_recommended ? "Yes" : "No"}
            </p>
          </div>
          <div>
            <FieldLabel>Review status</FieldLabel>
            <p className="mt-0.5 text-sm text-slate-200">{displayLatest.review_status}</p>
          </div>
          <div>
            <FieldLabel>Confidence</FieldLabel>
            <p className="mt-0.5 text-sm text-slate-200">
              {displayLatest.confidence_score.toFixed(2)}
            </p>
          </div>
        </div>
      ) : null}

      {displayLatest?.consultation_summary ? (
        <div className="mt-4">
          <FieldLabel>Consultation summary</FieldLabel>
          <p className="mt-1 text-sm text-slate-300">{displayLatest.consultation_summary}</p>
        </div>
      ) : null}

      {displayLatest?.ai_notes ? (
        <div className="mt-3">
          <FieldLabel>AI notes</FieldLabel>
          <p className="mt-1 text-xs text-slate-400">{displayLatest.ai_notes}</p>
        </div>
      ) : null}

      {!displayLatest ? (
        <p className="mt-3 text-sm text-[#94A3B8]">
          No consultation checklists yet for this patient.
        </p>
      ) : null}

      <div className="mt-5 border-t border-white/10 pt-4">
        <button
          type="button"
          disabled={pending}
          className="rounded-md bg-cyan-600/90 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50"
          onClick={() => {
            setMessage(null);
            start(async () => {
              const res = await generatePatientConsultationChecklistAction(tenantId, patientId, {});
              if (!res.ok) setMessage(res.error);
            });
          }}
        >
          Generate consultation checklist
        </button>
      </div>

      <div className="mt-6 border-t border-white/10 pt-4">
        <p className="text-sm font-medium text-white">Correct checklist</p>
        {cc.recent.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Generate a checklist first.</p>
        ) : (
          <>
            <div className="mt-2">
              <FieldLabel>Checklist row</FieldLabel>
              <select
                className="mt-1 w-full max-w-md rounded-md border border-white/10 bg-[#0f172a] px-2 py-2 text-sm text-slate-100"
                value={editId}
                onChange={(e) => {
                  const v = e.target.value;
                  setEditId(v);
                  syncEditRow(v);
                }}
              >
                {cc.recent.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.created_at.slice(0, 19)} — {r.priority_level}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <FieldLabel>Priority</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {HIE_CONSULTATION_PRIORITY_LEVELS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Checklist workflow status</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={checklistStatus}
                  onChange={(e) => setChecklistStatus(e.target.value)}
                >
                  {HIE_CONSULTATION_CHECKLIST_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Confidence 0–1</FieldLabel>
                <input
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={conf}
                  onChange={(e) => setConf(e.target.value)}
                />
              </div>
              <div>
                <FieldLabel>Consent complexity</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={consent}
                  onChange={(e) => setConsent(e.target.value)}
                >
                  {HIE_CONSULTATION_CONSENT_COMPLEXITY_LEVELS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" checked={med} onChange={(e) => setMed(e.target.checked)} />
                  Medication discussion required
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={stab}
                    onChange={(e) => setStab(e.target.checked)}
                  />
                  Stabilisation discussion required
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={donor}
                    onChange={(e) => setDonor(e.target.checked)}
                  />
                  Donor preservation discussion required
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={expect}
                    onChange={(e) => setExpect(e.target.checked)}
                  />
                  Expectation management required
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" checked={doc} onChange={(e) => setDoc(e.target.checked)} />
                  Documentation required
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={follow}
                    onChange={(e) => setFollow(e.target.checked)}
                  />
                  Follow-up required
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={delay}
                    onChange={(e) => setDelay(e.target.checked)}
                  />
                  Delay recommended (discussion flag)
                </label>
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Clinician review status</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                >
                  {HIE_CONSULTATION_REVIEW_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Checklist items (one per line)</FieldLabel>
                <textarea
                  className="mt-1 min-h-[96px] w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={itemsText}
                  onChange={(e) => setItemsText(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Risk flags (one per line)</FieldLabel>
                <textarea
                  className="mt-1 min-h-[72px] w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={flagsText}
                  onChange={(e) => setFlagsText(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Consultation summary</FieldLabel>
                <textarea
                  className="mt-1 min-h-[56px] w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>AI notes</FieldLabel>
                <textarea
                  className="mt-1 min-h-[56px] w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={aiNotes}
                  onChange={(e) => setAiNotes(e.target.value)}
                />
              </div>
            </div>
            <button
              type="button"
              disabled={pending || !editId}
              className="mt-3 w-full max-w-md rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15 disabled:opacity-50"
              onClick={() => {
                setMessage(null);
                start(async () => {
                  const c = Number(conf);
                  const items = itemsText
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, 60);
                  const flags = flagsText
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, 40);
                  const res = await updateConsultationChecklistReviewAction(
                    tenantId,
                    patientId,
                    editId,
                    {
                      review_status: review as (typeof HIE_CONSULTATION_REVIEW_STATUSES)[number],
                      priority_level: priority as (typeof HIE_CONSULTATION_PRIORITY_LEVELS)[number],
                      checklist_status:
                        checklistStatus as (typeof HIE_CONSULTATION_CHECKLIST_STATUSES)[number],
                      confidence_score: Number.isFinite(c) ? c : 0,
                      consent_complexity_level:
                        consent as (typeof HIE_CONSULTATION_CONSENT_COMPLEXITY_LEVELS)[number],
                      medication_discussion_required: med,
                      stabilisation_discussion_required: stab,
                      donor_preservation_discussion_required: donor,
                      expectation_management_required: expect,
                      documentation_required: doc,
                      follow_up_required: follow,
                      delay_recommended: delay,
                      consultation_summary: summary || null,
                      ai_notes: aiNotes || null,
                      checklist_items: items,
                      risk_flags: flags,
                    }
                  );
                  if (!res.ok) setMessage(res.error);
                });
              }}
            >
              Save checklist review
            </button>
          </>
        )}
      </div>
    </FiSection>
  );
}
