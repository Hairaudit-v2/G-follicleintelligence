"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  autosaveConsultationFormInstanceAction,
  completeConsultationFormInstanceAction,
  submitConsultationFormInstanceAction,
} from "@/lib/actions/fi-consultation-form-actions";
import { BodyAreaMapAnnotationsSummary } from "@/src/components/fi-admin/consultation-forms/BodyAreaMapField";
import { ConsultationCompletionSummaryCard } from "@/src/components/fi-admin/consultation-forms/ConsultationCompletionSummaryCard";
import { ConsultationFormFieldRenderer } from "@/src/components/fi-admin/consultation-forms/ConsultationFormFieldRenderer";
import { ConsultationFormSectionNav } from "@/src/components/fi-admin/consultation-forms/ConsultationFormSectionNav";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import type {
  ConsultationFormInstanceWithTemplate,
  ConsultationFormPersistenceContext,
} from "@/src/lib/consultationForms/consultationFormTypes";
import type { ConsultationCompletionSummary } from "@/src/lib/consultationForms/completion/consultationCompletionTypes";
import { buildHairTransplantCompletionSummary } from "@/src/lib/consultationForms/completion/hairTransplantCompletionRules";

const AUTOSAVE_MS = 900;

function cloneValues(v: Record<string, unknown>): Record<string, unknown> {
  return { ...v };
}

function parseStoredCompletion(raw: Record<string, unknown> | undefined): ConsultationCompletionSummary | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.consultationId !== "string" || typeof raw.completedAt !== "string") return null;
  return raw as unknown as ConsultationCompletionSummary;
}

export function ConsultationFormRunner({
  tenantId,
  consultationId,
  patientId,
  caseId,
  initialInstance,
}: {
  tenantId: string;
  consultationId: string;
  /** Foundation patient id when linked on the consultation (required to save voice notes to fi_clinical_notes). */
  patientId?: string | null;
  caseId?: string | null;
  initialInstance: ConsultationFormInstanceWithTemplate;
}) {
  const router = useRouter();
  const tid = tenantId.trim();
  const cid = consultationId.trim();
  const base = `/fi-admin/${tid}/consultations/${cid}`;

  const schema = initialInstance.template_version.schema;
  const sections = schema.sections ?? [];

  const persistence: ConsultationFormPersistenceContext | null = useMemo(
    () => ({
      tenantId: tid,
      consultationId: cid,
      formInstanceId: initialInstance.id,
      patientId: patientId?.trim() ? patientId.trim() : null,
      caseId: caseId?.trim() ? caseId.trim() : null,
    }),
    [tid, cid, initialInstance.id, patientId, caseId]
  );

  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id ?? "");
  const [values, setValues] = useState<Record<string, unknown>>(() => cloneValues(initialInstance.values));
  const [status, setStatus] = useState(initialInstance.status);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busySubmit, setBusySubmit] = useState(false);
  const [busyComplete, setBusyComplete] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJson = useRef(JSON.stringify(initialInstance.values));

  useEffect(() => {
    setValues(cloneValues(initialInstance.values));
    setStatus(initialInstance.status);
    lastSavedJson.current = JSON.stringify(initialInstance.values);
  }, [initialInstance.id, initialInstance.updated_at, initialInstance.status, initialInstance.completed_at]);

  const canEdit = status === "draft";

  const scheduleAutosave = useCallback(
    (nextValues: Record<string, unknown>) => {
      if (!canEdit) return;
      const json = JSON.stringify(nextValues);
      if (json === lastSavedJson.current) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      setAutosaveState("idle");
      timerRef.current = setTimeout(() => {
        void (async () => {
          setAutosaveState("saving");
          setAutosaveError(null);
          const res = await autosaveConsultationFormInstanceAction(tid, cid, initialInstance.id, { values: nextValues });
          if (!res.ok) {
            setAutosaveState("error");
            setAutosaveError(res.error);
            return;
          }
          lastSavedJson.current = json;
          setAutosaveState("saved");
          router.refresh();
        })();
      }, AUTOSAVE_MS);
    },
    [canEdit, cid, initialInstance.id, router, tid]
  );

  const onFieldChange = useCallback(
    (fieldId: string, next: unknown) => {
      setValues((prev) => {
        const merged = { ...prev, [fieldId]: next };
        scheduleAutosave(merged);
        return merged;
      });
    },
    [scheduleAutosave]
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const bodyAreaMapFields = useMemo(
    () =>
      sections.flatMap((sec) =>
        sec.fields.filter((f) => f.type === "body_area_map").map((f) => ({ id: f.id, label: f.label, views: f.bodyAreaMapViews }))
      ),
    [sections]
  );

  const persistedCompletion = useMemo(
    () => parseStoredCompletion(initialInstance.completion_summary),
    [initialInstance.completion_summary]
  );

  const formIsCompleted = initialInstance.status === "locked" && Boolean(initialInstance.completed_at);

  const previewCompletionSummary = useMemo(
    () =>
      buildHairTransplantCompletionSummary({
        consultationId: cid,
        formInstanceId: initialInstance.id,
        templateSlug: initialInstance.template.slug,
        values,
        completedAt: new Date().toISOString(),
      }),
    [cid, initialInstance.id, initialInstance.template.slug, values]
  );

  const displayCompletionSummary: ConsultationCompletionSummary | null = useMemo(() => {
    if (formIsCompleted && persistedCompletion) return persistedCompletion;
    if (formIsCompleted) return previewCompletionSummary;
    if (initialInstance.status === "submitted" && !initialInstance.completed_at) return previewCompletionSummary;
    return null;
  }, [
    formIsCompleted,
    persistedCompletion,
    previewCompletionSummary,
    initialInstance.status,
    initialInstance.completed_at,
  ]);

  const showCompleteConsultationCta =
    initialInstance.status === "submitted" && !initialInstance.completed_at;

  const showCompletionSection =
    initialInstance.status === "submitted" || initialInstance.status === "locked";

  const onCompleteConsultation = useCallback(async () => {
    if (!showCompleteConsultationCta) return;
    setCompleteError(null);
    setBusyComplete(true);
    try {
      const res = await completeConsultationFormInstanceAction(tid, cid, { formInstanceId: initialInstance.id });
      if (!res.ok) {
        setCompleteError(res.error);
        return;
      }
      setStatus("locked");
      router.refresh();
    } finally {
      setBusyComplete(false);
    }
  }, [cid, initialInstance.id, router, showCompleteConsultationCta, tid]);

  const onSubmit = useCallback(async () => {
    if (!canEdit) return;
    setSubmitError(null);
    setBusySubmit(true);
    try {
      const res = await submitConsultationFormInstanceAction(tid, cid, initialInstance.id, { values });
      if (!res.ok) {
        setSubmitError(res.error);
        return;
      }
      setStatus("submitted");
      lastSavedJson.current = JSON.stringify(values);
      router.refresh();
    } finally {
      setBusySubmit(false);
    }
  }, [canEdit, cid, initialInstance.id, router, tid, values]);

  const autosaveLabel = useMemo(() => {
    if (!canEdit) {
      if (initialInstance.completed_at) return "Consultation completed";
      if (status === "submitted") return "Submitted — complete consultation below";
      return "Locked";
    }
    if (autosaveState === "saving") return "Saving draft…";
    if (autosaveState === "error") return "Autosave failed";
    if (autosaveState === "saved") return "Draft saved";
    return "Autosave on pause";
  }, [autosaveState, canEdit, initialInstance.completed_at, status]);

  return (
    <div className="space-y-5">
      <FiCard>
        <FiPageHeader
          eyebrow="ConsultationOS · Guided form"
          title={initialInstance.template.name}
          description={`Version ${initialInstance.template_version.version} · ${initialInstance.channel.replace(/_/g, " ")} · Status: ${status}`}
          secondaryAction={
            <Link
              href={base}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-2"
            >
              Back to consultation workspace
            </Link>
          }
          primaryAction={
            canEdit ? (
              <button
                type="button"
                onClick={() => void onSubmit()}
                disabled={busySubmit}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busySubmit ? "Submitting…" : "Submit form"}
              </button>
            ) : null
          }
        />
        <p className="mt-3 text-xs font-medium text-slate-500" aria-live="polite">
          {autosaveLabel}
          {autosaveError?.trim() ? ` — ${autosaveError.trim()}` : null}
        </p>
        {submitError?.trim() ? (
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
            {submitError.trim()}
          </p>
        ) : null}
        {completeError?.trim() ? (
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
            {completeError.trim()}
          </p>
        ) : null}
        {!canEdit && bodyAreaMapFields.length > 0 ? (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Area map summary
            </h3>
            {bodyAreaMapFields.map((f) => (
              <BodyAreaMapAnnotationsSummary
                key={f.id}
                fieldLabel={f.label}
                value={values[f.id]}
                allowedViews={f.views}
              />
            ))}
          </div>
        ) : null}
      </FiCard>

      {showCompletionSection && displayCompletionSummary ? (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
            Consultation completion
          </h2>
          <ConsultationCompletionSummaryCard
            summary={displayCompletionSummary}
            isPreview={showCompleteConsultationCta}
            showHandoffPlaceholders={formIsCompleted}
          />
          {showCompleteConsultationCta ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void onCompleteConsultation()}
                disabled={busyComplete}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyComplete ? "Completing…" : "Complete consultation"}
              </button>
              <p className="max-w-xl text-xs text-slate-500 dark:text-slate-400">
                Finalizes the guided consultation: locks this form, stores the summary on the consultation record, and
                records a timeline event when a case is linked. Does not create quotes, tasks, or pathology requests
                automatically.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,240px)_1fr]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <ConsultationFormSectionNav
            sections={sections.map((s) => ({ id: s.id, title: s.title }))}
            activeSectionId={activeSection?.id ?? ""}
            onSelect={setActiveSectionId}
          />
        </aside>
        <FiCard className="space-y-6 p-4 sm:p-6">
          {activeSection ? (
            <>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{activeSection.title}</h2>
                {activeSection.description?.trim() ? (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{activeSection.description}</p>
                ) : null}
              </div>
              <div className="space-y-5">
                {activeSection.fields.map((field) => (
                  <ConsultationFormFieldRenderer
                    key={field.id}
                    field={field}
                    values={values}
                    value={values[field.id]}
                    disabled={!canEdit}
                    persistence={persistence}
                    onChange={(next) => onFieldChange(field.id, next)}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-600">This form has no sections.</p>
          )}
        </FiCard>
      </div>
    </div>
  );
}
