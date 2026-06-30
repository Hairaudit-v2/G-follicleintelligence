"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  autosaveConsultationFormInstanceAction,
  completeConsultationFormInstanceAction,
  submitConsultationFormInstanceAction,
} from "@/lib/actions/fi-consultation-form-actions";
import { BodyAreaMapAnnotationsSummary } from "@/src/components/fi-admin/consultation-forms/BodyAreaMapField";
import { ConsultationCompletionSummaryCard } from "@/src/components/fi-admin/consultation-forms/ConsultationCompletionSummaryCard";
import { ConsultationHandoffPanel } from "@/src/components/fi-admin/consultation-forms/ConsultationHandoffPanel";
import { ConsultationFormFieldRenderer } from "@/src/components/fi-admin/consultation-forms/ConsultationFormFieldRenderer";
import { ConsultationFormSectionNav } from "@/src/components/fi-admin/consultation-forms/ConsultationFormSectionNav";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { fiOsLightFormSurfaceClassNames } from "@/src/components/fi-design/fiDesignTokens";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { evaluateConsultationFormCondition } from "@/src/lib/consultationForms/consultationFormCondition";
import type {
  ConsultationFormInstanceWithTemplate,
  ConsultationFormPersistenceContext,
} from "@/src/lib/consultationForms/consultationFormTypes";
import type { ConsultationCompletionSummary } from "@/src/lib/consultationForms/completion/consultationCompletionTypes";
import { buildConsultationCompletionSummary } from "@/src/lib/consultationForms/completion/buildConsultationCompletionSummary";
import type { ConsultationHandoffInitialIds } from "@/src/lib/consultationForms/handoff/consultationHandoffTypes";

const AUTOSAVE_MS = 900;

function cloneValues(v: Record<string, unknown>): Record<string, unknown> {
  return { ...v };
}

function parseStoredCompletion(raw: Record<string, unknown> | undefined): ConsultationCompletionSummary | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.consultationId !== "string" || typeof raw.completedAt !== "string") return null;
  return raw as unknown as ConsultationCompletionSummary;
}

type WorkflowPhase = "editing" | "review" | "complete";

function ConsultationWorkflowStepper({ phase }: { phase: WorkflowPhase }) {
  const steps: { id: WorkflowPhase; n: number; title: string }[] = [
    { id: "editing", n: 1, title: "Edit consultation" },
    { id: "review", n: 2, title: "Review summary" },
    { id: "complete", n: 3, title: "Approve & complete" },
  ];
  const activeIdx = phase === "editing" ? 0 : phase === "review" ? 1 : 2;
  return (
    <nav aria-label="Consultation workflow" className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <ol className="flex flex-wrap items-stretch gap-2 sm:gap-3">
        {steps.map((s, i) => {
          const active = i === activeIdx;
          const done = i < activeIdx;
          return (
            <li
              key={s.id}
              className={cn(
                "flex min-h-[44px] min-w-[140px] flex-1 flex-col justify-center rounded-lg border px-3 py-2 text-left text-xs sm:text-sm",
                active && "border-sky-500 bg-cyan-500/10 font-semibold text-cyan-200 shadow-sm",
                done && !active && "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
                !active && !done && "border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md text-slate-400"
              )}
            >
              <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Step {s.n}</span>
              <span className="mt-0.5 leading-snug">{s.title}</span>
              {done ? <span className="mt-1 text-[0.65rem] font-medium text-emerald-300">Done</span> : null}
              {active ? <span className="mt-1 text-[0.65rem] font-medium text-cyan-200">Current</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function ConsultationFormRunner({
  tenantId,
  consultationId,
  patientId,
  caseId,
  leadId,
  handoffInitial,
  initialInstance,
}: {
  tenantId: string;
  consultationId: string;
  /** Foundation patient id when linked on the consultation (required to save voice notes to fi_clinical_notes). */
  patientId?: string | null;
  caseId?: string | null;
  leadId?: string | null;
  handoffInitial?: ConsultationHandoffInitialIds;
  initialInstance: ConsultationFormInstanceWithTemplate;
}) {
  const router = useRouter();
  const tid = tenantId.trim();
  const cid = consultationId.trim();
  const base = `/fi-admin/${tid}/consultations/${cid}`;

  const schema = initialInstance.template_version.schema;
  const sections = useMemo(() => schema.sections ?? [], [schema]);

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

  const [activeSectionId, setActiveSectionId] = useState(() => sections[0]?.id ?? "");

  const [values, setValues] = useState<Record<string, unknown>>(() => cloneValues(initialInstance.values));

  const visibleSections = useMemo(
    () => sections.filter((s) => evaluateConsultationFormCondition(s.showWhen, values)),
    [sections, values]
  );

  const activeSection = useMemo(
    () => visibleSections.find((s) => s.id === activeSectionId) ?? visibleSections[0] ?? null,
    [visibleSections, activeSectionId]
  );

  useEffect(() => {
    if (!sections.length) return;
    if (!visibleSections.length) return;
    setActiveSectionId((prev) => (visibleSections.some((s) => s.id === prev) ? prev : visibleSections[0]!.id));
  }, [sections, visibleSections]);

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
  }, [
    initialInstance.id,
    initialInstance.updated_at,
    initialInstance.status,
    initialInstance.completed_at,
    initialInstance.values,
  ]);

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

  const formIsLocked = status === "locked" || initialInstance.status === "locked";

  const handoffState = handoffInitial ?? {
    followUpTaskId: null,
    quoteId: null,
    pathologyRequestId: null,
    surgeryPlanId: null,
  };

  const canShowHandoffs = useMemo(
    () => formIsLocked && Boolean(persistedCompletion) && persistedCompletion!.source === "rules_v1",
    [formIsLocked, persistedCompletion]
  );

  const previewCompletionSummary = useMemo(
    () =>
      buildConsultationCompletionSummary({
        consultationId: cid,
        formInstanceId: initialInstance.id,
        templateSlug: initialInstance.template.slug,
        values,
        completedAt: new Date().toISOString(),
      }),
    [cid, initialInstance.id, initialInstance.template.slug, values]
  );

  const displayCompletionSummary: ConsultationCompletionSummary | null = useMemo(() => {
    if (formIsLocked && persistedCompletion) return persistedCompletion;
    if (formIsLocked) return previewCompletionSummary;
    if (!formIsLocked && status === "submitted") return previewCompletionSummary;
    return null;
  }, [
    formIsLocked,
    persistedCompletion,
    previewCompletionSummary,
    status,
  ]);

  const showCompleteConsultationCta =
    initialInstance.status === "submitted" && !initialInstance.completed_at;

  const workflowPhase: WorkflowPhase = useMemo(() => {
    if (status === "draft") return "editing";
    if (status === "locked" || initialInstance.status === "locked") return "complete";
    if (status === "submitted") return "review";
    return "complete";
  }, [status, initialInstance.status]);

  const templateSlug = initialInstance.template.slug;

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
      await router.refresh();
      if (typeof document !== "undefined") {
        requestAnimationFrame(() => {
          document.getElementById("consultation-guided-handoffs")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
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
      if (status === "submitted") return "Submitted — review summary, then complete consultation";
      return "Locked";
    }
    if (autosaveState === "saving") return "Saving draft…";
    if (autosaveState === "error") return "Autosave failed";
    if (autosaveState === "saved") return "Draft saved";
    return "Autosave on pause";
  }, [autosaveState, canEdit, initialInstance.completed_at, status]);

  const areaMapReadOnlyBlock =
    !canEdit && bodyAreaMapFields.length > 0 ? (
      <div className="space-y-3 border-t border-white/[0.08] pt-4">
        <h3 className={fiOsLightFormSurfaceClassNames.panelCaption}>Area map summary</h3>
        {bodyAreaMapFields.map((f) => (
          <BodyAreaMapAnnotationsSummary
            key={f.id}
            fieldLabel={f.label}
            value={values[f.id]}
            allowedViews={f.views}
          />
        ))}
      </div>
    ) : null;

  const formWorkspace = (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,240px)_1fr]">
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <ConsultationFormSectionNav
          sections={visibleSections.map((s) => ({ id: s.id, title: s.title }))}
          activeSectionId={activeSectionId}
          onSelect={setActiveSectionId}
        />
      </aside>
      <FiCard className="space-y-6 p-4 sm:p-6">
        {activeSection ? (
          <>
            <div>
              <h2 className={fiOsLightFormSurfaceClassNames.sectionTitle}>{activeSection.title}</h2>
              {activeSection.description?.trim() ? (
                <p className={`mt-1 ${fiOsLightFormSurfaceClassNames.bodyMuted}`}>{activeSection.description}</p>
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
                  sectionId={activeSection.id}
                  templateSlug={templateSlug}
                  onChange={(next) => onFieldChange(field.id, next)}
                />
              ))}
            </div>
          </>
        ) : (
          <p className={fiOsLightFormSurfaceClassNames.bodyMuted}>This form has no sections.</p>
        )}
      </FiCard>
    </div>
  );

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
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md px-4 py-2.5 text-sm font-semibold text-slate-200 shadow-lg shadow-black/40 transition hover:border-slate-700 hover:bg-white/[0.03] focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-2"
            >
              Back to consultation hub
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
          <p className="mt-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300" role="alert">
            {submitError.trim()}
          </p>
        ) : null}
        {completeError?.trim() ? (
          <p className="mt-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300" role="alert">
            {completeError.trim()}
          </p>
        ) : null}
      </FiCard>

      <ConsultationWorkflowStepper phase={workflowPhase} />

      {workflowPhase === "review" && displayCompletionSummary ? (
        <section className="space-y-4" aria-labelledby="consultation-review-heading">
          <h2 id="consultation-review-heading" className={fiOsLightFormSurfaceClassNames.panelCaption}>
            Clinical review
          </h2>
          <ConsultationCompletionSummaryCard summary={displayCompletionSummary} isPreview={showCompleteConsultationCta} />
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
              <p className={`max-w-xl ${fiOsLightFormSurfaceClassNames.helper}`}>
                Locks this form, persists the rules-based snapshot, and unlocks routing plus optional CRM, pathology, and
                SurgeryOS hand-offs. Nothing downstream runs automatically.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {workflowPhase === "complete" ? (
        <div className="space-y-6">
          <FiCard className="space-y-3 p-4 sm:p-5">
            <h3 className={fiOsLightFormSurfaceClassNames.panelCaption}>Pathway complete</h3>
            <p className={`text-sm ${fiOsLightFormSurfaceClassNames.body}`}>
              The consultation intelligence summary and routing tiles are on the{" "}
              <Link href={base} className="font-semibold text-cyan-300 underline">
                consultation hub
              </Link>
              .
            </p>
          </FiCard>
          {canShowHandoffs && persistedCompletion ? (
            <div id="consultation-guided-handoffs" className="scroll-mt-4">
              <ConsultationHandoffPanel
                tenantId={tid}
                consultationId={cid}
                formInstanceId={initialInstance.id}
                summary={persistedCompletion}
                leadId={leadId}
                patientId={patientId}
                caseId={caseId}
                handoffInitial={handoffState}
              />
            </div>
          ) : null}
          <details className="rounded-xl border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-3 shadow-lg shadow-black/40">
            <summary className="cursor-pointer select-none text-sm font-semibold text-slate-100">
              Chart snapshot and guided form record
            </summary>
            <div className="mt-4 space-y-6">
              {persistedCompletion ? <ConsultationCompletionSummaryCard summary={persistedCompletion} /> : null}
              {areaMapReadOnlyBlock}
              {formWorkspace}
            </div>
          </details>
        </div>
      ) : null}

      {workflowPhase === "review" ? (
        <details
          className="rounded-xl border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-3 shadow-lg shadow-black/40"
          open
        >
          <summary className="cursor-pointer select-none text-sm font-semibold text-slate-100">
            Guided form answers (read-only)
          </summary>
          <div className="mt-4 space-y-6">
            {areaMapReadOnlyBlock}
            {formWorkspace}
          </div>
        </details>
      ) : null}

      {workflowPhase === "editing" ? formWorkspace : null}
    </div>
  );
}
