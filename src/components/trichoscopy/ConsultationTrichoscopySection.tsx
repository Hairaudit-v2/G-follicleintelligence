"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { FiCard } from "@/src/components/fi-design/FiCard";
import { fiOsLightFormSurfaceClassNames } from "@/src/components/fi-design/fiDesignTokens";
import { TRICHOSCOPY_INDICATION_CODES } from "@/src/lib/integrations/hliTrichoscopy/consultation/types";
import type { ConsultationTrichoscopyCardSummary } from "@/src/lib/integrations/hliTrichoscopy/consultation/types";
import type { TrichoscopyAcknowledgementState } from "@/src/lib/integrations/hliTrichoscopy/consultation/types";

const STATUS_LABELS: Record<string, string> = {
  not_required: "Not required",
  recommended: "Recommended",
  required_before_treatment: "Required before treatment",
  already_available: "Already available",
  requested: "Requested",
  in_progress: "In progress",
  ready_for_review: "Ready for review",
  reviewed: "Reviewed",
  insufficient: "Insufficient evidence",
  superseded: "Superseded pack available",
  withdrawn: "Withdrawn",
  failed: "Temporarily unavailable",
  deferred: "Deferred",
};

const INDICATION_LABELS: Record<string, string> = {
  suspected_androgenetic_alopecia: "Suspected androgenetic alopecia",
  diffuse_shedding: "Diffuse shedding",
  suspected_telogen_effluvium: "Suspected telogen effluvium",
  suspected_alopecia_areata: "Suspected alopecia areata",
  suspected_scarring_alopecia: "Suspected scarring alopecia",
  inflammatory_scalp_condition: "Inflammatory scalp condition",
  unexplained_density_reduction: "Unexplained density reduction",
  donor_area_assessment: "Donor-area assessment",
  treatment_response_baseline: "Treatment-response baseline",
  treatment_response_follow_up: "Treatment-response follow-up",
  diagnostic_uncertainty: "Diagnostic uncertainty",
  clinician_concern: "Clinician concern",
  patient_requested_assessment: "Patient-requested assessment",
  other: "Other",
};

const ACK_OPTIONS: { value: TrichoscopyAcknowledgementState; label: string }[] = [
  { value: "acknowledged", label: "Acknowledge" },
  { value: "accepted_into_assessment", label: "Accept into assessment" },
  { value: "accepted_with_qualification", label: "Accept with qualification" },
  { value: "not_clinically_significant", label: "Not clinically significant" },
  { value: "disagreed", label: "Disagree" },
  { value: "requires_more_evidence", label: "Needs more evidence" },
  { value: "escalated", label: "Escalate" },
];

export type ConsultationTrichoscopySectionProps = {
  tenantId: string;
  consultationId: string;
  patientId: string | null;
  initialAvailable: boolean;
  initialCard: ConsultationTrichoscopyCardSummary;
  initialIndication: Record<string, unknown> | null;
  initialFindings: Array<Record<string, unknown>>;
  initialReviews: Array<Record<string, unknown>>;
  patientSafeSummaryText: string | null;
  canRequest: boolean;
  canReview: boolean;
  canAccept: boolean;
  historicalReadOnly?: boolean;
};

export function ConsultationTrichoscopySection(props: ConsultationTrichoscopySectionProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndications, setSelectedIndications] = useState<string[]>(
    Array.isArray(props.initialIndication?.indication_codes)
      ? (props.initialIndication!.indication_codes as string[])
      : ["clinician_concern"]
  );
  const [clinicianQuestion, setClinicianQuestion] = useState(
    props.initialIndication?.clinician_question
      ? String(props.initialIndication.clinician_question)
      : ""
  );
  const [consentCapture, setConsentCapture] = useState(
    Boolean(props.initialIndication?.patient_consent_capture)
  );
  const [consentTransfer, setConsentTransfer] = useState(
    Boolean(props.initialIndication?.patient_consent_transfer)
  );
  const [waitForTreatment, setWaitForTreatment] = useState(
    Boolean(props.initialIndication?.wait_for_treatment_planning)
  );
  const [urgency, setUrgency] = useState<"routine" | "priority" | "urgent">(
    props.initialIndication?.urgency === "priority" ||
      props.initialIndication?.urgency === "urgent"
      ? (props.initialIndication.urgency as "priority" | "urgent")
      : "routine"
  );

  const reviewByFinding = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const r of props.initialReviews) {
      map.set(String(r.finding_id), r);
    }
    return map;
  }, [props.initialReviews]);

  const card = props.initialCard;
  const patientHref = props.patientId
    ? `/fi-admin/${props.tenantId}/patients/${props.patientId}/trichoscopy?consultationId=${props.consultationId}`
    : null;
  const apiBase = `/api/fi-admin/${props.tenantId}/consultations/${props.consultationId}/trichoscopy`;

  async function postJson(path: string, body: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Action failed");
      return false;
    }
    router.refresh();
    return true;
  }

  function toggleIndication(code: string) {
    setSelectedIndications((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  if (!props.initialAvailable && card.failureKind) {
    return (
      <FiCard className="border-amber-500/20 bg-amber-500/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/80">
          Trichoscopy
        </p>
        <p className="mt-2 text-sm text-slate-300">
          {card.integrationMessage ??
            "Trichoscopy information is temporarily unavailable. You may continue documenting the consultation and return to this section later."}
        </p>
      </FiCard>
    );
  }

  return (
    <section className="space-y-3" aria-labelledby="consultation-trichoscopy-heading">
      <FiCard className="border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Trichoscopy
            </p>
            <h2
              id="consultation-trichoscopy-heading"
              className="mt-1 text-base font-semibold text-slate-100"
            >
              {STATUS_LABELS[card.consultationStatus] ?? card.consultationStatus}
            </h2>
            <p className={fiOsLightFormSurfaceClassNames.helper}>
              Specialist HLI evidence supports — never replaces — the FiOS consultation record.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-cyan-400/40"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Collapse" : "Expand review"}
          </button>
        </div>

        <dl className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-slate-500">Readiness</dt>
            <dd>{card.readinessState.replace(/_/g, " ")}</dd>
          </div>
          {card.evidencePackVersion ? (
            <div>
              <dt className="text-slate-500">Evidence pack</dt>
              <dd>v{card.evidencePackVersion}</dd>
            </div>
          ) : null}
          {card.pinnedPackVersion ? (
            <div>
              <dt className="text-slate-500">Pinned for decision</dt>
              <dd>v{card.pinnedPackVersion}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-slate-500">Significant findings</dt>
            <dd>{card.significantFindingsCount}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Unresolved actions</dt>
            <dd>{card.unresolvedActionCount}</dd>
          </div>
          {card.lastSyncedAt ? (
            <div>
              <dt className="text-slate-500">Last sync</dt>
              <dd>{new Date(card.lastSyncedAt).toLocaleString()}</dd>
            </div>
          ) : null}
          {card.evidenceQuality ? (
            <div>
              <dt className="text-slate-500">Evidence quality</dt>
              <dd>{card.evidenceQuality}</dd>
            </div>
          ) : null}
        </dl>

        {card.blocking ? (
          <p className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Completion may be blocked: {card.blockingReasonCodes.join(", ").replace(/_/g, " ")}
          </p>
        ) : null}

        {card.integrationMessage ? (
          <p className="mt-3 rounded border border-slate-500/30 bg-slate-500/10 px-3 py-2 text-xs text-slate-200">
            {card.integrationMessage}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {props.canRequest && !props.historicalReadOnly ? (
            <button
              type="button"
              disabled={pending || !props.patientId}
              className="inline-flex rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              onClick={() => setShowRequest(true)}
            >
              Request assessment
            </button>
          ) : null}
          {props.canRequest && !props.historicalReadOnly ? (
            <button
              type="button"
              disabled={pending}
              className="inline-flex rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs font-medium text-slate-100"
              onClick={() =>
                startTransition(async () => {
                  await postJson("/not-required", { reason: "Clinician marked not required" });
                })
              }
            >
              Mark not required
            </button>
          ) : null}
          {props.canRequest && !props.historicalReadOnly ? (
            <button
              type="button"
              disabled={pending}
              className="inline-flex rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs font-medium text-slate-100"
              onClick={() =>
                startTransition(async () => {
                  await postJson("/defer", { reason: "Deferred during consultation" });
                })
              }
            >
              Defer
            </button>
          ) : null}
          {patientHref ? (
            <Link
              href={`${patientHref}&action=request`}
              className="inline-flex rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-cyan-400/40"
            >
              Open HLI workspace
            </Link>
          ) : (
            <span className="inline-flex rounded-lg border border-dashed border-white/[0.08] px-3 py-1.5 text-xs text-slate-500">
              Link a patient first
            </span>
          )}
        </div>

        {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
      </FiCard>

      {showRequest ? (
        <FiCard className="space-y-3 border-cyan-500/20 bg-[#0B1220] p-4">
          <h3 className="text-sm font-semibold text-slate-100">Request HLI Trichoscopy</h3>
          <p className={fiOsLightFormSurfaceClassNames.helper}>
            Indication codes are clinical context for HLI, not confirmed diagnoses. Consent is
            required before submission.
          </p>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-slate-400">Indications</legend>
            <div className="grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
              {TRICHOSCOPY_INDICATION_CODES.map((code) => (
                <label key={code} className="flex items-start gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={selectedIndications.includes(code)}
                    onChange={() => toggleIndication(code)}
                  />
                  <span>{INDICATION_LABELS[code] ?? code}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block text-xs font-medium text-slate-400">
            Clinician question
            <textarea
              className="mt-1 w-full rounded-lg border border-white/[0.1] bg-[#081020] px-3 py-2 text-sm text-slate-100"
              rows={3}
              value={clinicianQuestion}
              onChange={(e) => setClinicianQuestion(e.target.value)}
            />
          </label>

          <div className="flex flex-wrap gap-4 text-xs text-slate-300">
            <label className="flex items-center gap-2">
              Urgency
              <select
                className="rounded border border-white/[0.1] bg-[#081020] px-2 py-1"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as typeof urgency)}
              >
                <option value="routine">Routine</option>
                <option value="priority">Priority</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={waitForTreatment}
                onChange={(e) => setWaitForTreatment(e.target.checked)}
              />
              Wait for treatment planning
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={consentCapture}
                onChange={(e) => setConsentCapture(e.target.checked)}
              />
              Consent — capture
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={consentTransfer}
                onChange={(e) => setConsentTransfer(e.target.checked)}
              />
              Consent — transfer to HLI
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || selectedIndications.length === 0}
              className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              onClick={() =>
                startTransition(async () => {
                  const okInd = await postJson("/indication", {
                    indicationCodes: selectedIndications,
                    clinicianQuestion,
                    urgency,
                    waitForTreatmentPlanning: waitForTreatment,
                    patientConsentCapture: consentCapture,
                    patientConsentTransfer: consentTransfer,
                  });
                  if (!okInd) return;
                  const okReq = await postJson("/request", {
                    requestMode: "new_assessment",
                    clinicalQuestion: clinicianQuestion || undefined,
                    urgency: urgency === "routine" ? "routine" : "priority",
                    clientRequestId: crypto.randomUUID(),
                  });
                  if (okReq) setShowRequest(false);
                })
              }
            >
              Submit request
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs text-slate-200"
              onClick={() => setShowRequest(false)}
            >
              Cancel
            </button>
          </div>
        </FiCard>
      ) : null}

      {expanded ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <FiCard className="space-y-2 p-4">
            <h3 className="text-sm font-semibold text-slate-100">Clinical context</h3>
            <p className="text-xs text-slate-400">
              {(Array.isArray(props.initialIndication?.indication_codes)
                ? (props.initialIndication!.indication_codes as string[])
                : []
              )
                .map((c) => INDICATION_LABELS[c] ?? c)
                .join(" · ") || "No indication captured yet."}
            </p>
            {props.initialIndication?.clinician_question ? (
              <p className="text-sm text-slate-300">
                {String(props.initialIndication.clinician_question)}
              </p>
            ) : null}
          </FiCard>

          <FiCard className="space-y-2 p-4">
            <h3 className="text-sm font-semibold text-slate-100">Evidence</h3>
            <p className="text-xs text-slate-400">
              Pack {card.evidencePackVersion ? `v${card.evidencePackVersion}` : "not yet received"}
              {card.evidenceQuality ? ` · Quality: ${card.evidenceQuality}` : ""}
            </p>
            {props.patientSafeSummaryText ? (
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
                {props.patientSafeSummaryText}
              </p>
            ) : (
              <p className="text-xs text-slate-500">Patient-safe summary appears after review.</p>
            )}
          </FiCard>

          <FiCard className="space-y-3 p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-100">Structured findings</h3>
            {!props.initialFindings.length ? (
              <p className="text-xs text-slate-500">
                No structured findings imported yet. Assessment remains optional for documentation.
              </p>
            ) : (
              <ul className="space-y-3">
                {props.initialFindings.map((f) => {
                  const id = String(f.id);
                  const review = reviewByFinding.get(id);
                  const canAct =
                    (props.canReview || props.canAccept) && !props.historicalReadOnly;
                  return (
                    <li
                      key={id}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-100">
                            {String(f.finding_code).replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-slate-500">
                            {String(f.finding_domain).replace(/_/g, " ")}
                            {f.observed_region ? ` · ${String(f.observed_region)}` : ""}
                            {f.is_escalation ? " · Escalation" : ""}
                          </p>
                          {review ? (
                            <p className="mt-1 text-xs text-cyan-200/90">
                              Review: {String(review.acknowledgement_state).replace(/_/g, " ")}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-slate-500">Not reviewed</p>
                          )}
                        </div>
                        {canAct ? (
                          <div className="flex flex-wrap gap-1">
                            {ACK_OPTIONS.filter((opt) => {
                              if (
                                opt.value === "accepted_into_assessment" ||
                                opt.value === "accepted_with_qualification"
                              ) {
                                return props.canAccept;
                              }
                              return props.canReview || props.canAccept;
                            }).map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                disabled={pending}
                                className="rounded border border-white/[0.1] px-2 py-1 text-[10px] text-slate-200 hover:border-cyan-400/40"
                                onClick={() =>
                                  startTransition(async () => {
                                    await postJson(`/findings/${id}/review`, {
                                      acknowledgementState: opt.value,
                                    });
                                  })
                                }
                              >
                                {opt.label}
                              </button>
                            ))}
                            {props.canAccept ? (
                              <button
                                type="button"
                                disabled={pending || !review}
                                className="rounded border border-cyan-500/30 px-2 py-1 text-[10px] text-cyan-100 disabled:opacity-40"
                                onClick={() =>
                                  startTransition(async () => {
                                    await postJson("/actions", {
                                      decisionKind: "investigation",
                                      findingId: id,
                                      findingReviewId: review ? String(review.id) : undefined,
                                      targetEntityType: "pathology_recommendation",
                                      investigationCategory: "iron_studies",
                                      decisionSummary:
                                        "Clinician-selected investigation linked to trichoscopy finding",
                                    });
                                  })
                                }
                              >
                                Link investigation
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </FiCard>
        </div>
      ) : null}
    </section>
  );
}
