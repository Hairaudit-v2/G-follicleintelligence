"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { FiSection } from "@/src/components/fi-design/FiSection";
import {
  assessPatientRecipientCandidacyAction,
  updateRecipientAssessmentReviewAction,
} from "@/src/lib/actions/fi-recipient-intelligence-actions";
import {
  HIE_RECIPIENT_QUALITY_RATINGS,
  HIE_RECIPIENT_AREA_IMAGE_CATEGORIES,
  HIE_RECIPIENT_REVIEW_STATUSES,
  HIE_RECIPIENT_RISK_LEVELS,
  HIE_RECIPIENT_SURGICAL_TIMING_RISKS,
} from "@/src/lib/hair-intelligence/recipientCandidacy/types";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

const RECIPIENT_TAG_SET = new Set<string>(HIE_RECIPIENT_AREA_IMAGE_CATEGORIES);

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{children}</p>
  );
}

export function PatientRecipientCandidacyCard({
  tenantId,
  patientId,
  twin,
}: {
  tenantId: string;
  patientId: string;
  twin: PatientTwinV1;
}) {
  const { recipient_candidacy: rc } = twin.intelligence;
  const recipientPreferredIds = useMemo(
    () =>
      twin.imaging.gallery.items
        .filter((i) => i.ai_image_category && RECIPIENT_TAG_SET.has(i.ai_image_category))
        .map((i) => i.id),
    [twin.imaging.gallery.items]
  );
  const allGalleryIds = useMemo(
    () => twin.imaging.gallery.items.map((i) => i.id),
    [twin.imaging.gallery.items]
  );
  const selectableIds = recipientPreferredIds.length > 0 ? recipientPreferredIds : allGalleryIds;

  const [selectedImageId, setSelectedImageId] = useState(() => selectableIds[0] ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (selectableIds.length === 0) {
      setSelectedImageId("");
      return;
    }
    if (!selectableIds.includes(selectedImageId)) {
      setSelectedImageId(selectableIds[0]);
    }
  }, [selectableIds, selectedImageId]);

  const [editId, setEditId] = useState(() => rc.latest?.id ?? "");
  const latest = rc.latest;

  const [quality, setQuality] = useState(latest?.recipient_quality_rating ?? "unknown");
  const [conf, setConf] = useState(latest != null ? String(latest.confidence_score) : "0");
  const [diffuse, setDiffuse] = useState(latest?.diffuse_thinning_risk ?? "unknown");
  const [shock, setShock] = useState(latest?.shock_loss_risk ?? "unknown");
  const [density, setDensity] = useState(latest?.density_expectation_risk ?? "unknown");
  const [timing, setTiming] = useState(latest?.surgical_timing_risk ?? "unknown");
  const [expect, setExpect] = useState(latest?.patient_expectation_risk ?? "unknown");
  const [medStab, setMedStab] = useState(latest?.medication_stabilisation_needed ?? false);
  const [pathRev, setPathRev] = useState(latest?.pathology_review_recommended ?? false);
  const [docGap, setDocGap] = useState(latest?.documentation_gap_detected ?? false);
  const [review, setReview] = useState(latest?.review_status ?? "pending");
  const [summary, setSummary] = useState(latest?.candidacy_summary ?? "");
  const [aiNotes, setAiNotes] = useState(latest?.ai_notes ?? "");
  const [topicsText, setTopicsText] = useState(() => (latest?.review_topics ?? []).join("\n"));

  const syncEditRow = useCallback(
    (id: string) => {
      const row = rc.recent.find((r) => r.id === id);
      if (!row) return;
      setQuality(row.recipient_quality_rating);
      setConf(String(row.confidence_score));
      setDiffuse(row.diffuse_thinning_risk ?? "unknown");
      setShock(row.shock_loss_risk ?? "unknown");
      setDensity(row.density_expectation_risk ?? "unknown");
      setTiming(row.surgical_timing_risk ?? "unknown");
      setExpect(row.patient_expectation_risk ?? "unknown");
      setMedStab(row.medication_stabilisation_needed);
      setPathRev(row.pathology_review_recommended);
      setDocGap(row.documentation_gap_detected);
      setReview(row.review_status);
      setSummary(row.candidacy_summary ?? "");
      setAiNotes(row.ai_notes ?? "");
      setTopicsText((row.review_topics ?? []).join("\n"));
    },
    [rc.recent]
  );

  useEffect(() => {
    if (rc.recent.length === 0) return;
    const preferred = rc.latest?.id ?? rc.recent[0].id;
    if (!editId || !rc.recent.some((r) => r.id === editId)) {
      setEditId(preferred);
      syncEditRow(preferred);
    }
  }, [rc.latest?.id, rc.recent, editId, syncEditRow]);

  return (
    <FiSection
      surfaceVariant="darkGlass"
      headingId="patient-twin-recipient-candidacy-heading"
      title="Recipient & surgical candidacy review (HIE)"
      description="Stage 9D review signals from recipient-area photographs plus hair loss, progression, donor, therapy, and pathology presence. Stored in hair_intelligence_recipient_candidacy_reviews."
    >
      <p className="mb-3 rounded-md border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-100/95">
        Recipient intelligence provides clinician review support only and does not replace surgical
        judgement. It does not create surgical plans, recommend graft numbers, design hairlines, or
        predict outcomes.
      </p>

      {message ? <p className="mb-2 text-xs text-amber-200/90">{message}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel>Recipient quality</FieldLabel>
          <p className="mt-0.5 text-sm font-medium text-white">
            {latest ? latest.recipient_quality_rating.replace(/_/g, " ") : "—"}
          </p>
        </div>
        <div>
          <FieldLabel>Diffuse thinning risk</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">{latest?.diffuse_thinning_risk ?? "—"}</p>
        </div>
        <div>
          <FieldLabel>Shock loss risk</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">{latest?.shock_loss_risk ?? "—"}</p>
        </div>
        <div>
          <FieldLabel>Density expectation risk</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">{latest?.density_expectation_risk ?? "—"}</p>
        </div>
        <div>
          <FieldLabel>Surgical timing risk</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">
            {latest?.surgical_timing_risk?.replace(/_/g, " ") ?? "—"}
          </p>
        </div>
        <div>
          <FieldLabel>Medication stabilisation needed</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">
            {latest != null ? (latest.medication_stabilisation_needed ? "Yes" : "No") : "—"}
          </p>
        </div>
        <div>
          <FieldLabel>Pathology review recommended</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">
            {latest != null ? (latest.pathology_review_recommended ? "Yes" : "No") : "—"}
          </p>
        </div>
        <div>
          <FieldLabel>Expectation risk</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">{latest?.patient_expectation_risk ?? "—"}</p>
        </div>
        <div>
          <FieldLabel>Confidence</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">
            {latest != null && latest.confidence_score != null
              ? latest.confidence_score.toFixed(2)
              : "—"}
          </p>
        </div>
        <div>
          <FieldLabel>Review status</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">{latest ? latest.review_status : "—"}</p>
        </div>
      </div>

      {latest && latest.review_topics.length > 0 ? (
        <div className="mt-4">
          <FieldLabel>Review topics</FieldLabel>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-300">
            {latest.review_topics.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {latest?.candidacy_summary ? (
        <div className="mt-4">
          <FieldLabel>Candidacy summary</FieldLabel>
          <p className="mt-1 text-sm text-slate-300">{latest.candidacy_summary}</p>
        </div>
      ) : null}

      {latest?.ai_notes ? (
        <div className="mt-3">
          <FieldLabel>AI notes</FieldLabel>
          <p className="mt-1 text-xs text-slate-400">{latest.ai_notes}</p>
        </div>
      ) : null}

      {!latest ? (
        <p className="mt-3 text-sm text-[#94A3B8]">
          No recipient candidacy reviews yet for this patient.
        </p>
      ) : null}

      <div className="mt-5 border-t border-white/10 pt-4">
        <FieldLabel>Select recipient-area image</FieldLabel>
        {recipientPreferredIds.length === 0 && allGalleryIds.length > 0 ? (
          <p className="mt-1 text-xs text-amber-200/80">
            No images are AI-tagged as front/crown/top yet; you can still run on any gallery image
            that shows the recipient area.
          </p>
        ) : null}
        <select
          className="mt-1 w-full max-w-md rounded-md border border-white/10 bg-[#0f172a] px-2 py-2 text-sm text-slate-100"
          value={selectedImageId}
          onChange={(e) => setSelectedImageId(e.target.value)}
        >
          {selectableIds.length === 0 ? (
            <option value="">No images in Twin gallery</option>
          ) : (
            selectableIds.map((id) => (
              <option key={id} value={id}>
                {id.slice(0, 8)}…{recipientPreferredIds.includes(id) ? " (recipient view)" : ""}
              </option>
            ))
          )}
        </select>
        <button
          type="button"
          disabled={pending || !selectedImageId}
          className="mt-3 rounded-md bg-cyan-600/90 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50"
          onClick={() => {
            setMessage(null);
            start(async () => {
              const res = await assessPatientRecipientCandidacyAction(
                tenantId,
                patientId,
                selectedImageId,
                {}
              );
              if (!res.ok) setMessage(res.error);
            });
          }}
        >
          Assess surgical candidacy
        </button>
      </div>

      <div className="mt-6 border-t border-white/10 pt-4">
        <p className="text-sm font-medium text-white">Correct assessment</p>
        {rc.recent.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Run an assessment first.</p>
        ) : (
          <>
            <div className="mt-2">
              <FieldLabel>Review row</FieldLabel>
              <select
                className="mt-1 w-full max-w-md rounded-md border border-white/10 bg-[#0f172a] px-2 py-2 text-sm text-slate-100"
                value={editId}
                onChange={(e) => {
                  const v = e.target.value;
                  setEditId(v);
                  syncEditRow(v);
                }}
              >
                {rc.recent.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.created_at.slice(0, 19)} — {r.recipient_quality_rating}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <FieldLabel>Recipient quality</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                >
                  {HIE_RECIPIENT_QUALITY_RATINGS.map((s) => (
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
                <FieldLabel>Diffuse thinning</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={diffuse}
                  onChange={(e) => setDiffuse(e.target.value)}
                >
                  {HIE_RECIPIENT_RISK_LEVELS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Shock loss</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={shock}
                  onChange={(e) => setShock(e.target.value)}
                >
                  {HIE_RECIPIENT_RISK_LEVELS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Density expectation</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={density}
                  onChange={(e) => setDensity(e.target.value)}
                >
                  {HIE_RECIPIENT_RISK_LEVELS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Surgical timing</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={timing}
                  onChange={(e) => setTiming(e.target.value)}
                >
                  {HIE_RECIPIENT_SURGICAL_TIMING_RISKS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Expectation risk</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={expect}
                  onChange={(e) => setExpect(e.target.value)}
                >
                  {HIE_RECIPIENT_RISK_LEVELS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={medStab}
                    onChange={(e) => setMedStab(e.target.checked)}
                  />
                  Medication stabilisation needed
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={pathRev}
                    onChange={(e) => setPathRev(e.target.checked)}
                  />
                  Pathology review recommended
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={docGap}
                    onChange={(e) => setDocGap(e.target.checked)}
                  />
                  Documentation gap
                </label>
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Review status</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                >
                  {HIE_RECIPIENT_REVIEW_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Review topics (one per line)</FieldLabel>
                <textarea
                  className="mt-1 min-h-[72px] w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={topicsText}
                  onChange={(e) => setTopicsText(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Candidacy summary</FieldLabel>
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
                  const topics = topicsText
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, 40);
                  const res = await updateRecipientAssessmentReviewAction(
                    tenantId,
                    patientId,
                    editId,
                    {
                      review_status: review as (typeof HIE_RECIPIENT_REVIEW_STATUSES)[number],
                      recipient_quality_rating:
                        quality as (typeof HIE_RECIPIENT_QUALITY_RATINGS)[number],
                      confidence_score: Number.isFinite(c) ? c : 0,
                      diffuse_thinning_risk: diffuse as (typeof HIE_RECIPIENT_RISK_LEVELS)[number],
                      shock_loss_risk: shock as (typeof HIE_RECIPIENT_RISK_LEVELS)[number],
                      density_expectation_risk:
                        density as (typeof HIE_RECIPIENT_RISK_LEVELS)[number],
                      surgical_timing_risk:
                        timing as (typeof HIE_RECIPIENT_SURGICAL_TIMING_RISKS)[number],
                      patient_expectation_risk:
                        expect as (typeof HIE_RECIPIENT_RISK_LEVELS)[number],
                      medication_stabilisation_needed: medStab,
                      pathology_review_recommended: pathRev,
                      documentation_gap_detected: docGap,
                      candidacy_summary: summary || null,
                      ai_notes: aiNotes || null,
                      review_topics: topics,
                    }
                  );
                  if (!res.ok) setMessage(res.error);
                });
              }}
            >
              Save assessment review
            </button>
          </>
        )}
      </div>
    </FiSection>
  );
}
