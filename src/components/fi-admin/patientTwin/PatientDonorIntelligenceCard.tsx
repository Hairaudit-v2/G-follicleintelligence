"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { FiSection } from "@/src/components/fi-design/FiSection";
import {
  assessPatientDonorImageAction,
  updateDonorAssessmentReviewAction,
} from "@/src/lib/actions/fi-donor-intelligence-actions";
import {
  HIE_DONOR_DENSITY_BANDS,
  HIE_DONOR_QUALITY_RATINGS,
  HIE_DONOR_REGIONS,
  HIE_DONOR_REVIEW_STATUSES,
  HIE_DONOR_RISK_LEVELS,
  HIE_EXTRACTION_CAUTION_LEVELS,
  HIE_LIFETIME_GRAFT_BUDGET_BANDS,
  HIE_SAFE_DONOR_CAPACITY_BANDS,
} from "@/src/lib/hair-intelligence/donorIntelligence/types";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{children}</p>
  );
}

export function PatientDonorIntelligenceCard({
  tenantId,
  patientId,
  twin,
}: {
  tenantId: string;
  patientId: string;
  twin: PatientTwinV1;
}) {
  const { donor } = twin.intelligence;
  const donorPreferredIds = useMemo(
    () =>
      twin.imaging.gallery.items.filter((i) => i.ai_image_category === "donor").map((i) => i.id),
    [twin.imaging.gallery.items]
  );
  const allGalleryIds = useMemo(
    () => twin.imaging.gallery.items.map((i) => i.id),
    [twin.imaging.gallery.items]
  );
  const selectableIds = donorPreferredIds.length > 0 ? donorPreferredIds : allGalleryIds;

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

  const [editId, setEditId] = useState(() => donor.latest?.id ?? "");
  const latest = donor.latest;

  const [region, setRegion] = useState(latest?.donor_region ?? "unknown");
  const [quality, setQuality] = useState(latest?.donor_quality_rating ?? "unknown");
  const [conf, setConf] = useState(latest != null ? String(latest.confidence_score) : "0");
  const [density, setDensity] = useState(latest?.estimated_density_band ?? "unknown");
  const [mini, setMini] = useState(latest?.miniaturisation_risk ?? "unknown");
  const [retro, setRetro] = useState(latest?.retrograde_risk ?? "unknown");
  const [over, setOver] = useState(latest?.overharvesting_risk ?? "unknown");
  const [cap, setCap] = useState(latest?.safe_donor_capacity_band ?? "unknown");
  const [budget, setBudget] = useState(latest?.lifetime_graft_budget_band ?? "unknown");
  const [extract, setExtract] = useState(latest?.extraction_caution_level ?? "unknown");
  const [review, setReview] = useState(latest?.review_status ?? "pending");
  const [clinical, setClinical] = useState(latest?.clinical_observations ?? "");
  const [aiNotes, setAiNotes] = useState(latest?.ai_notes ?? "");

  const syncEditRow = (id: string) => {
    const row = donor.recent.find((r) => r.id === id);
    if (!row) return;
    setRegion(row.donor_region);
    setQuality(row.donor_quality_rating);
    setConf(String(row.confidence_score));
    setDensity(row.estimated_density_band ?? "unknown");
    setMini(row.miniaturisation_risk ?? "unknown");
    setRetro(row.retrograde_risk ?? "unknown");
    setOver(row.overharvesting_risk ?? "unknown");
    setCap(row.safe_donor_capacity_band ?? "unknown");
    setBudget(row.lifetime_graft_budget_band ?? "unknown");
    setExtract(row.extraction_caution_level ?? "unknown");
    setReview(row.review_status);
    setClinical(row.clinical_observations ?? "");
    setAiNotes(row.ai_notes ?? "");
  };

  useEffect(() => {
    if (donor.recent.length === 0) return;
    const preferred = donor.latest?.id ?? donor.recent[0].id;
    if (!editId || !donor.recent.some((r) => r.id === editId)) {
      setEditId(preferred);
      const row = donor.recent.find((r) => r.id === preferred);
      if (row) {
        setRegion(row.donor_region);
        setQuality(row.donor_quality_rating);
        setConf(String(row.confidence_score));
        setDensity(row.estimated_density_band ?? "unknown");
        setMini(row.miniaturisation_risk ?? "unknown");
        setRetro(row.retrograde_risk ?? "unknown");
        setOver(row.overharvesting_risk ?? "unknown");
        setCap(row.safe_donor_capacity_band ?? "unknown");
        setBudget(row.lifetime_graft_budget_band ?? "unknown");
        setExtract(row.extraction_caution_level ?? "unknown");
        setReview(row.review_status);
        setClinical(row.clinical_observations ?? "");
        setAiNotes(row.ai_notes ?? "");
      }
    }
  }, [donor.latest?.id, donor.recent, editId]);

  return (
    <FiSection
      surfaceVariant="darkGlass"
      headingId="patient-twin-donor-heading"
      title="Donor intelligence (HIE)"
      description="Stage 9C shared donor-zone bands from clinical donor photographs. Stored in hair_intelligence_donor_assessments."
    >
      <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95">
        Donor intelligence is image-based decision support and does not replace clinical density
        measurement or surgical judgement.
      </p>

      {message ? <p className="mb-2 text-xs text-amber-200/90">{message}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel>Donor quality</FieldLabel>
          <p className="mt-0.5 text-sm font-medium text-white">
            {latest ? latest.donor_quality_rating.replace(/_/g, " ") : "—"}
          </p>
        </div>
        <div>
          <FieldLabel>Donor region</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">
            {latest ? latest.donor_region.replace(/_/g, " ") : "—"}
          </p>
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
          <FieldLabel>Density band</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">
            {latest?.estimated_density_band?.replace(/_/g, " ") ?? "—"}
          </p>
        </div>
        <div>
          <FieldLabel>Miniaturisation risk</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">{latest?.miniaturisation_risk ?? "—"}</p>
        </div>
        <div>
          <FieldLabel>Retrograde risk</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">{latest?.retrograde_risk ?? "—"}</p>
        </div>
        <div>
          <FieldLabel>Overharvesting risk</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">{latest?.overharvesting_risk ?? "—"}</p>
        </div>
        <div>
          <FieldLabel>Safe donor capacity band</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">
            {latest?.safe_donor_capacity_band?.replace(/_/g, " ") ?? "—"}
          </p>
        </div>
        <div>
          <FieldLabel>Lifetime graft budget band</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">
            {latest?.lifetime_graft_budget_band?.replace(/_/g, " ") ?? "—"}
          </p>
        </div>
        <div>
          <FieldLabel>Extraction caution</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">{latest?.extraction_caution_level ?? "—"}</p>
        </div>
        <div>
          <FieldLabel>Review status</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">{latest ? latest.review_status : "—"}</p>
        </div>
      </div>

      {latest?.clinical_observations ? (
        <div className="mt-4">
          <FieldLabel>Clinical observations</FieldLabel>
          <p className="mt-1 text-sm text-slate-300">{latest.clinical_observations}</p>
        </div>
      ) : null}
      {latest?.ai_notes ? (
        <div className="mt-3">
          <FieldLabel>AI notes</FieldLabel>
          <p className="mt-1 text-xs text-slate-400">{latest.ai_notes}</p>
        </div>
      ) : null}

      {!latest ? (
        <p className="mt-3 text-sm text-[#94A3B8]">No donor assessments yet for this patient.</p>
      ) : null}

      <div className="mt-5 border-t border-white/10 pt-4">
        <FieldLabel>Select donor image</FieldLabel>
        {donorPreferredIds.length === 0 && allGalleryIds.length > 0 ? (
          <p className="mt-1 text-xs text-amber-200/80">
            No images are AI-tagged as donor yet; you can still run an assessment on any gallery
            image if it shows the donor area.
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
                {id.slice(0, 8)}…{donorPreferredIds.includes(id) ? " (donor)" : ""}
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
              const res = await assessPatientDonorImageAction(
                tenantId,
                patientId,
                selectedImageId,
                {}
              );
              if (!res.ok) setMessage(res.error);
            });
          }}
        >
          Assess donor image
        </button>
      </div>

      <div className="mt-6 border-t border-white/10 pt-4">
        <p className="text-sm font-medium text-white">Correct assessment</p>
        {donor.recent.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Run an assessment first.</p>
        ) : (
          <>
            <div className="mt-2">
              <FieldLabel>Assessment row</FieldLabel>
              <select
                className="mt-1 w-full max-w-md rounded-md border border-white/10 bg-[#0f172a] px-2 py-2 text-sm text-slate-100"
                value={editId}
                onChange={(e) => {
                  const v = e.target.value;
                  setEditId(v);
                  syncEditRow(v);
                }}
              >
                {donor.recent.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.created_at.slice(0, 19)} — {r.donor_quality_rating} / {r.donor_region}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <FieldLabel>Region</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  {HIE_DONOR_REGIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Quality</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                >
                  {HIE_DONOR_QUALITY_RATINGS.map((s) => (
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
                <FieldLabel>Density band</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={density}
                  onChange={(e) => setDensity(e.target.value)}
                >
                  {HIE_DONOR_DENSITY_BANDS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Miniaturisation</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={mini}
                  onChange={(e) => setMini(e.target.value)}
                >
                  {HIE_DONOR_RISK_LEVELS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Retrograde</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={retro}
                  onChange={(e) => setRetro(e.target.value)}
                >
                  {HIE_DONOR_RISK_LEVELS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Overharvesting</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={over}
                  onChange={(e) => setOver(e.target.value)}
                >
                  {HIE_DONOR_RISK_LEVELS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Safe capacity band</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={cap}
                  onChange={(e) => setCap(e.target.value)}
                >
                  {HIE_SAFE_DONOR_CAPACITY_BANDS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Lifetime budget band</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                >
                  {HIE_LIFETIME_GRAFT_BUDGET_BANDS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Extraction caution</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={extract}
                  onChange={(e) => setExtract(e.target.value)}
                >
                  {HIE_EXTRACTION_CAUTION_LEVELS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Review status</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                >
                  {HIE_DONOR_REVIEW_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Clinical observations</FieldLabel>
                <textarea
                  className="mt-1 min-h-[56px] w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={clinical}
                  onChange={(e) => setClinical(e.target.value)}
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
                  const res = await updateDonorAssessmentReviewAction(tenantId, patientId, editId, {
                    review_status: review as (typeof HIE_DONOR_REVIEW_STATUSES)[number],
                    donor_region: region as (typeof HIE_DONOR_REGIONS)[number],
                    donor_quality_rating: quality as (typeof HIE_DONOR_QUALITY_RATINGS)[number],
                    confidence_score: Number.isFinite(c) ? c : 0,
                    estimated_density_band: density as (typeof HIE_DONOR_DENSITY_BANDS)[number],
                    miniaturisation_risk: mini as (typeof HIE_DONOR_RISK_LEVELS)[number],
                    retrograde_risk: retro as (typeof HIE_DONOR_RISK_LEVELS)[number],
                    overharvesting_risk: over as (typeof HIE_DONOR_RISK_LEVELS)[number],
                    safe_donor_capacity_band: cap as (typeof HIE_SAFE_DONOR_CAPACITY_BANDS)[number],
                    lifetime_graft_budget_band:
                      budget as (typeof HIE_LIFETIME_GRAFT_BUDGET_BANDS)[number],
                    extraction_caution_level:
                      extract as (typeof HIE_EXTRACTION_CAUTION_LEVELS)[number],
                    clinical_observations: clinical || null,
                    ai_notes: aiNotes || null,
                  });
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
