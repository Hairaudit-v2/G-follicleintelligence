"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { FiSection } from "@/src/components/fi-design/FiSection";
import {
  classifyPatientHairLossAction,
  updateHairLossClassificationReviewAction,
} from "@/src/lib/actions/fi-hair-loss-classification-actions";
import {
  HIE_CLASSIFICATION_SYSTEMS,
  HIE_HAIR_LOSS_PATTERN_TYPES,
  HIE_HAIR_LOSS_REVIEW_STATUSES,
  HIE_SEX_CLASSIFICATIONS,
} from "@/src/lib/hair-intelligence/hairLossClassification/types";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{children}</p>
  );
}

export function PatientHairLossClassificationCard({
  tenantId,
  patientId,
  twin,
}: {
  tenantId: string;
  patientId: string;
  twin: PatientTwinV1;
}) {
  const { hair_loss } = twin.intelligence;
  const galleryIds = useMemo(
    () => twin.imaging.gallery.items.map((i) => i.id),
    [twin.imaging.gallery.items]
  );
  const [selectedImageId, setSelectedImageId] = useState(() => galleryIds[0] ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (galleryIds.length === 0) {
      setSelectedImageId("");
      return;
    }
    if (!galleryIds.includes(selectedImageId)) {
      setSelectedImageId(galleryIds[0]);
    }
  }, [galleryIds, selectedImageId]);

  const [editId, setEditId] = useState(() => hair_loss.latest?.id ?? "");
  const latest = hair_loss.latest;

  const [sys, setSys] = useState(latest?.classification_system ?? "norwood");
  const [pat, setPat] = useState(latest?.pattern_type ?? "male_pattern_baldness");
  const [grade, setGrade] = useState(latest?.classification_grade ?? "");
  const [conf, setConf] = useState(latest != null ? String(latest.confidence_score) : "0");
  const [sex, setSex] = useState(latest?.sex_classification ?? "unknown");
  const [review, setReview] = useState(latest?.review_status ?? "pending");
  const [notes, setNotes] = useState(latest?.ai_notes ?? "");

  const syncEditRow = (id: string) => {
    const row = hair_loss.recent.find((r) => r.id === id);
    if (!row) return;
    setSys(row.classification_system);
    setPat(row.pattern_type);
    setGrade(row.classification_grade);
    setConf(String(row.confidence_score));
    setSex(row.sex_classification ?? "unknown");
    setReview(row.review_status);
    setNotes(row.ai_notes ?? "");
  };

  useEffect(() => {
    if (hair_loss.recent.length === 0) return;
    const preferred = hair_loss.latest?.id ?? hair_loss.recent[0].id;
    if (!editId || !hair_loss.recent.some((r) => r.id === editId)) {
      setEditId(preferred);
      const row = hair_loss.recent.find((r) => r.id === preferred);
      if (row) {
        setSys(row.classification_system);
        setPat(row.pattern_type);
        setGrade(row.classification_grade);
        setConf(String(row.confidence_score));
        setSex(row.sex_classification ?? "unknown");
        setReview(row.review_status);
        setNotes(row.ai_notes ?? "");
      }
    }
  }, [hair_loss.latest?.id, hair_loss.recent, editId]);

  return (
    <FiSection
      surfaceVariant="darkGlass"
      headingId="patient-twin-hair-loss-heading"
      title="Hair loss pattern (HIE)"
      description="Stage 9A shared classifier — Norwood / Ludwig / Sinclair / Olsen pattern read from clinical photos. Stored in hair_intelligence_hair_loss_classifications (not on fi_patient_images)."
    >
      {message ? <p className="mb-2 text-xs text-amber-200/90">{message}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel>AI pattern</FieldLabel>
          <p className="mt-0.5 text-sm font-medium text-white">
            {latest ? latest.pattern_type.replace(/_/g, " ") : "—"}
          </p>
        </div>
        <div>
          <FieldLabel>Classification system</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">
            {latest ? latest.classification_system : "—"}
          </p>
        </div>
        <div>
          <FieldLabel>Grade</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">
            {latest ? latest.classification_grade : "—"}
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
          <FieldLabel>Review status</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">{latest ? latest.review_status : "—"}</p>
        </div>
        <div>
          <FieldLabel>Sex presentation (AI)</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">{latest?.sex_classification ?? "—"}</p>
        </div>
      </div>

      {latest ? (
        <div className="mt-4 grid gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-slate-300 sm:grid-cols-5">
          <div>
            <FieldLabel>Frontal</FieldLabel>
            <p className="mt-0.5 text-white">{latest.frontal_loss_score ?? "—"}</p>
          </div>
          <div>
            <FieldLabel>Temporal</FieldLabel>
            <p className="mt-0.5 text-white">{latest.temporal_recession_score ?? "—"}</p>
          </div>
          <div>
            <FieldLabel>Mid scalp</FieldLabel>
            <p className="mt-0.5 text-white">{latest.mid_scalp_score ?? "—"}</p>
          </div>
          <div>
            <FieldLabel>Crown</FieldLabel>
            <p className="mt-0.5 text-white">{latest.crown_loss_score ?? "—"}</p>
          </div>
          <div>
            <FieldLabel>Diffuse</FieldLabel>
            <p className="mt-0.5 text-white">{latest.diffuse_thinning_score ?? "—"}</p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-[#94A3B8]">
          No hair loss classification runs yet for this patient.
        </p>
      )}

      <div className="mt-5 border-t border-white/10 pt-4">
        <FieldLabel>Select scalp image</FieldLabel>
        <select
          className="mt-1 w-full max-w-md rounded-md border border-white/10 bg-[#0f172a] px-2 py-2 text-sm text-slate-100"
          value={selectedImageId}
          onChange={(e) => setSelectedImageId(e.target.value)}
        >
          {galleryIds.length === 0 ? (
            <option value="">No images in Twin gallery</option>
          ) : (
            galleryIds.map((id) => (
              <option key={id} value={id}>
                {id.slice(0, 8)}…
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
              const res = await classifyPatientHairLossAction(
                tenantId,
                patientId,
                selectedImageId,
                {}
              );
              if (!res.ok) setMessage(res.error);
            });
          }}
        >
          Analyze hair loss
        </button>
      </div>

      <div className="mt-6 border-t border-white/10 pt-4">
        <p className="text-sm font-medium text-white">Correct classification</p>
        {hair_loss.recent.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Run an analysis first.</p>
        ) : (
          <>
            <div className="mt-2">
              <FieldLabel>Classification row</FieldLabel>
              <select
                className="mt-1 w-full max-w-md rounded-md border border-white/10 bg-[#0f172a] px-2 py-2 text-sm text-slate-100"
                value={editId}
                onChange={(e) => {
                  const v = e.target.value;
                  setEditId(v);
                  syncEditRow(v);
                }}
              >
                {hair_loss.recent.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.created_at.slice(0, 19)} — {r.classification_system} {r.classification_grade}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <FieldLabel>System</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={sys}
                  onChange={(e) => setSys(e.target.value)}
                >
                  {HIE_CLASSIFICATION_SYSTEMS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Pattern</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={pat}
                  onChange={(e) => setPat(e.target.value)}
                >
                  {HIE_HAIR_LOSS_PATTERN_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Grade</FieldLabel>
                <input
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="e.g. V or III Vertex"
                />
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
                <FieldLabel>Sex presentation</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                >
                  {HIE_SEX_CLASSIFICATIONS.map((s) => (
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
                  {HIE_HAIR_LOSS_REVIEW_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Notes</FieldLabel>
                <textarea
                  className="mt-1 min-h-[72px] w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
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
                  const res = await updateHairLossClassificationReviewAction(
                    tenantId,
                    patientId,
                    editId,
                    {
                      review_status: review as (typeof HIE_HAIR_LOSS_REVIEW_STATUSES)[number],
                      classification_system: sys as (typeof HIE_CLASSIFICATION_SYSTEMS)[number],
                      pattern_type: pat as (typeof HIE_HAIR_LOSS_PATTERN_TYPES)[number],
                      classification_grade: grade,
                      confidence_score: Number.isFinite(c) ? c : 0,
                      ai_notes: notes || null,
                      sex_classification: sex as (typeof HIE_SEX_CLASSIFICATIONS)[number],
                    }
                  );
                  if (!res.ok) setMessage(res.error);
                });
              }}
            >
              Save classification review
            </button>
          </>
        )}
      </div>
    </FiSection>
  );
}
