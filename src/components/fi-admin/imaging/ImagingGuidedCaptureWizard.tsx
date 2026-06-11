"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createImagingProtocolSessionAction,
  finishGuidedProtocolSessionAction,
  skipGuidedProtocolSlotAction,
} from "@/lib/actions/fi-imaging-actions";
import { inferCaptureDeviceType } from "@/src/lib/imagingOs/imagingOsConstants";
import type { ImagingOsPatientPayload } from "@/src/lib/imagingOs/imagingOsLoad.server";
import { buildGuidedImageUploadFields } from "@/src/lib/imagingOs/imagingOsGuidedFields";
import {
  defaultSlotInstruction,
  isSessionMarkedComplete,
  missingRequiredSlotSlugs,
  nextRecommendedSlotSlug,
  slotIsSatisfied,
} from "@/src/lib/imagingOs/imagingOsProtocol";

const GUIDED_TEMPLATE_SLUGS = [
  "hair_loss_consultation",
  "hair_transplant_planning",
  "surgery_day",
  "follow_up_review",
  "trichoscopy_review",
] as const;

type GuidedSessionApi = {
  completionPercent: number;
  sessionCompleted: boolean;
  missingRequired: string[];
  nextSlotSlug: string | null;
};

function firstOpenSessionId(sessions: ImagingOsPatientPayload["protocolSessions"]): string {
  for (const s of sessions) {
    if (!isSessionMarkedComplete(s.progress)) return s.id;
  }
  return "";
}

export function ImagingGuidedCaptureWizard({
  tenantId,
  patientId,
  adminKey,
  initial,
}: {
  tenantId: string;
  patientId: string;
  adminKey: string;
  initial: ImagingOsPatientPayload;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sessionId, setSessionId] = useState<string>(() => firstOpenSessionId(initial.protocolSessions));
  const [slotOverride, setSlotOverride] = useState<string | null>(null);
  const [replaceNext, setReplaceNext] = useState(false);
  const [clinicIdInput, setClinicIdInput] = useState("");
  const [staffIdInput, setStaffIdInput] = useState("");
  const [lastPreviewUrl, setLastPreviewUrl] = useState<string | null>(null);
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSessionId((prev) => {
      if (prev && initial.protocolSessions.some((s) => s.id === prev)) return prev;
      return firstOpenSessionId(initial.protocolSessions);
    });
  }, [initial.protocolSessions]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (lastPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(lastPreviewUrl);
    };
  }, [lastPreviewUrl]);

  const withAdmin = useCallback(
    <T extends Record<string, unknown>>(body: T): T & { adminKey?: string } => {
      const k = adminKey.trim();
      return k ? { ...body, adminKey: k } : body;
    },
    [adminKey]
  );

  const currentSession = useMemo(
    () => initial.protocolSessions.find((s) => s.id === sessionId) ?? null,
    [initial.protocolSessions, sessionId]
  );

  const template = useMemo(
    () => initial.protocolTemplates.find((t) => t.slug === currentSession?.template_slug) ?? null,
    [initial.protocolTemplates, currentSession?.template_slug]
  );

  const slots = template?.slots ?? [];
  const progress = currentSession?.progress ?? {};

  const computedNext = useMemo(() => {
    if (!slots.length) return null;
    return nextRecommendedSlotSlug(slots, progress);
  }, [slots, progress]);

  const currentSlug = slotOverride ?? computedNext ?? slots[0]?.slug ?? null;
  const currentSlot = slots.find((s) => s.slug === currentSlug) ?? null;

  const missing = useMemo(() => missingRequiredSlotSlugs(slots, progress), [slots, progress]);
  const pct = currentSession?.completion_percent ?? 0;
  const sessionComplete = currentSession ? isSessionMarkedComplete(progress) : false;

  const showFlash = useCallback((kind: "success" | "error", text: string) => {
    setToast({ kind, text });
  }, []);

  const uploadFile = useCallback(
    (file: File | null) => {
      if (!file || !currentSession || !currentSlug || sessionComplete) return;

      if (lastPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(lastPreviewUrl);
      const preview = URL.createObjectURL(file);
      setLastPreviewUrl(preview);

      const slot = slots.find((s) => s.slug === currentSlug);
      const fields = buildGuidedImageUploadFields({
        templateSlug: currentSession.template_slug,
        slotSlug: currentSlug,
        deviceType: inferCaptureDeviceType(typeof navigator !== "undefined" ? navigator.userAgent : ""),
        clinicId: clinicIdInput.trim() || null,
        capturedByStaffId: staffIdInput.trim() || null,
        suggestedRegion: slot?.suggested_region ?? null,
      });

      const fd = new FormData();
      fd.set("file", file);
      fd.set("image_category", "scalp");
      fd.set("protocol_session_id", currentSession.id);
      fd.set("imaging_library_axis", fields.imaging_library_axis);
      fd.set("visit_type", fields.visit_type);
      fd.set("imaging_protocol_template_slug", fields.imaging_protocol_template_slug);
      fd.set("imaging_protocol_slot_slug", fields.imaging_protocol_slot_slug);
      if (fields.anatomical_region) fd.set("anatomical_region", fields.anatomical_region);
      fd.set("device_type", fields.device_type);
      if (fields.clinic_id) fd.set("clinic_id", fields.clinic_id);
      if (fields.captured_by_staff_id) fd.set("captured_by_staff_id", fields.captured_by_staff_id);
      if (replaceNext) fd.set("guided_replace", "1");
      const k = adminKey.trim();
      if (k) fd.set("adminKey", k);

      startTransition(async () => {
        const res = await fetch(
          `/api/tenants/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(patientId)}/images`,
          { method: "POST", body: fd, credentials: "include" }
        );
        const j = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          guided_session?: GuidedSessionApi;
        };
        if (!res.ok || !j.ok) {
          showFlash("error", j.error ?? `Upload failed (${res.status}).`);
          return;
        }
        const g = j.guided_session;
        if (g) {
          showFlash("success", g.sessionCompleted ? "Session complete — all required views captured." : "Image saved.");
          if (g.nextSlotSlug) setSlotOverride(g.nextSlotSlug);
          else setSlotOverride(null);
        } else {
          showFlash("success", "Image saved.");
        }
        setReplaceNext(false);
        router.refresh();
        if (camRef.current) camRef.current.value = "";
        if (libRef.current) libRef.current.value = "";
      });
    },
    [
      adminKey,
      clinicIdInput,
      currentSession,
      currentSlug,
      lastPreviewUrl,
      patientId,
      replaceNext,
      router,
      sessionComplete,
      showFlash,
      slots,
      staffIdInput,
      tenantId,
    ]
  );

  const onStartTemplate = useCallback(
    (templateSlug: string) => {
      startTransition(async () => {
        const res = await createImagingProtocolSessionAction(tenantId, patientId, withAdmin({ templateSlug }));
        if (!res.ok) {
          showFlash("error", res.error);
          return;
        }
        setSessionId(res.sessionId);
        setSlotOverride(null);
        showFlash("success", "Guided session started.");
        router.refresh();
      });
    },
    [patientId, router, showFlash, tenantId, withAdmin]
  );

  const onSkip = useCallback(() => {
    if (!currentSession || !currentSlug || !skipReason.trim()) return;
    const slot = slots.find((s) => s.slug === currentSlug);
    if (!slot || slot.required !== false) return;
    startTransition(async () => {
      const res = await skipGuidedProtocolSlotAction(
        tenantId,
        patientId,
        withAdmin({ sessionId: currentSession.id, slotSlug: currentSlug, reason: skipReason.trim() })
      );
      if (!res.ok) {
        showFlash("error", res.error);
        return;
      }
      showFlash("success", res.sessionCompleted ? "Optional slot skipped — session complete." : "Slot skipped.");
      if (res.nextSlotSlug) setSlotOverride(res.nextSlotSlug);
      else setSlotOverride(null);
      setSkipOpen(false);
      setSkipReason("");
      router.refresh();
    });
  }, [currentSession, currentSlug, patientId, router, showFlash, skipReason, slots, tenantId, withAdmin]);

  const onFinish = useCallback(() => {
    if (!currentSession || sessionComplete) return;
    startTransition(async () => {
      const res = await finishGuidedProtocolSessionAction(
        tenantId,
        patientId,
        withAdmin({ sessionId: currentSession.id })
      );
      if (!res.ok) {
        showFlash("error", res.error);
        return;
      }
      showFlash("success", "Session finished.");
      router.refresh();
    });
  }, [currentSession, patientId, router, sessionComplete, showFlash, tenantId, withAdmin]);

  const orderedTemplates = useMemo(() => {
    const bySlug = new Map(initial.protocolTemplates.map((t) => [t.slug, t]));
    const out: typeof initial.protocolTemplates = [];
    for (const slug of GUIDED_TEMPLATE_SLUGS) {
      const row = bySlug.get(slug);
      if (row) out.push(row);
    }
    return out;
  }, [initial.protocolTemplates]);

  return (
    <section className="space-y-6 rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-4 sm:p-6">
      {toast ? (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            toast.kind === "success" ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200" : "bg-red-50 text-red-900 ring-1 ring-red-200"
          }`}
        >
          {toast.text}
        </div>
      ) : null}

      <header className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-gray-900 sm:text-xl">Guided clinical capture</h2>
        <p className="max-w-2xl text-sm text-gray-600">
          Touch-friendly workflow for iPad and phones. Uses the device camera or photo library; images stay in private
          patient storage with signed thumbnails only.
        </p>
      </header>

      {!currentSession ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
          <p className="text-sm font-medium text-gray-800">No active session</p>
          <p className="mt-1 text-xs text-gray-600">Choose a protocol template to begin guided capture.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {orderedTemplates.map((t) => (
              <button
                key={t.slug}
                type="button"
                disabled={pending}
                onClick={() => onStartTemplate(t.slug)}
                className="min-h-[48px] rounded-lg border border-gray-300 bg-white px-4 py-3 text-left text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50"
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="block min-w-0 flex-1 text-xs font-medium text-gray-700">
              Active session
              <select
                value={sessionId}
                onChange={(e) => {
                  setSessionId(e.target.value);
                  setSlotOverride(null);
                }}
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                {initial.protocolSessions.map((s) => {
                  const tpl = initial.protocolTemplates.find((t) => t.slug === s.template_slug);
                  const done = isSessionMarkedComplete(s.progress);
                  return (
                    <option key={s.id} value={s.id}>
                      {(tpl?.name ?? s.template_slug).slice(0, 64)} {done ? "· complete" : "· active"}
                    </option>
                  );
                })}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || sessionComplete}
                onClick={onFinish}
                className="min-h-[44px] min-w-[140px] rounded-lg border border-gray-800 bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-gray-800 disabled:bg-gray-400"
              >
                Finish session
              </button>
            </div>
          </div>

          {sessionComplete ? (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
              This session is marked complete. Start a new session from the protocols tab or pick another active session
              above.
            </p>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Session progress</h3>
              <div className="flex items-center gap-3">
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-semibold tabular-nums text-gray-900">{pct}%</span>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Missing (required)</h3>
                {missing.length === 0 ? (
                  <p className="mt-1 text-sm text-emerald-700">None — all required slots satisfied.</p>
                ) : (
                  <ul className="mt-1 list-inside list-disc text-sm text-gray-800">
                    {missing.map((slug) => (
                      <li key={slug}>{slots.find((s) => s.slug === slug)?.label ?? slug}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Optional metadata</h3>
              <label className="block text-xs text-gray-600">
                Clinic ID (UUID)
                <input
                  value={clinicIdInput}
                  onChange={(e) => setClinicIdInput(e.target.value)}
                  className="mt-1 block w-full min-h-[44px] rounded-lg border border-gray-300 px-3 font-mono text-sm"
                  placeholder="Optional"
                  autoComplete="off"
                />
              </label>
              <label className="block text-xs text-gray-600">
                Capturing staff ID (UUID)
                <input
                  value={staffIdInput}
                  onChange={(e) => setStaffIdInput(e.target.value)}
                  className="mt-1 block w-full min-h-[44px] rounded-lg border border-gray-300 px-3 font-mono text-sm"
                  placeholder="Optional"
                  autoComplete="off"
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border-2 border-gray-900 bg-gray-900 p-4 text-white sm:p-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-400">Current slot</h3>
            {currentSlot ? (
              <>
                <p className="mt-2 text-xl font-semibold sm:text-2xl">{currentSlot.label}</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-300">{defaultSlotInstruction(currentSlot)}</p>
                <p className="mt-3 text-xs text-gray-400">
                  Status:{" "}
                  <span className="font-medium text-white">
                    {slotIsSatisfied(currentSlot, progress) ? "Captured" : "Not captured"}
                  </span>
                  {currentSlot.required === false ? <span className="text-gray-500"> · Optional</span> : null}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-gray-400">No slots in this template.</p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => uploadFile(e.target.files?.[0] ?? null)} />
              <input ref={libRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadFile(e.target.files?.[0] ?? null)} />
              <button
                type="button"
                disabled={pending || !currentSlot || sessionComplete}
                onClick={() => camRef.current?.click()}
                className="min-h-[52px] flex-1 rounded-xl bg-white px-4 text-base font-semibold text-gray-900 shadow hover:bg-gray-100 disabled:opacity-40"
              >
                {pending ? "Uploading…" : "Take photo"}
              </button>
              <button
                type="button"
                disabled={pending || !currentSlot || sessionComplete}
                onClick={() => libRef.current?.click()}
                className="min-h-[52px] flex-1 rounded-xl border border-white/40 px-4 text-base font-semibold text-white hover:bg-white/10 disabled:opacity-40"
              >
                From library
              </button>
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={replaceNext} onChange={(e) => setReplaceNext(e.target.checked)} className="h-5 w-5 rounded border-gray-500" />
              Retake / replace for this slot (archives the previous image for this slot)
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Captured</h3>
              {lastPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lastPreviewUrl} alt="Latest capture preview" className="mt-2 h-40 w-full rounded-lg object-cover" />
              ) : (
                <p className="mt-2 text-sm text-gray-500">After each upload, a thumbnail preview appears here.</p>
              )}
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Slot checklist</h3>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-sm">
                {slots.map((s) => {
                  const ok = slotIsSatisfied(s, progress);
                  const active = s.slug === currentSlug;
                  return (
                    <li key={s.slug}>
                      <button
                        type="button"
                        disabled={sessionComplete}
                        onClick={() => setSlotOverride(s.slug)}
                        className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left ${
                          active ? "bg-gray-900 text-white" : ok ? "bg-emerald-50 text-emerald-900" : "bg-gray-50 hover:bg-gray-100"
                        }`}
                      >
                        <span className="pr-2">{s.label}</span>
                        <span className="shrink-0 text-xs font-medium">{ok ? "Done" : "Open"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {currentSlot?.required === false && !slotIsSatisfied(currentSlot, progress) ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || sessionComplete}
                onClick={() => setSkipOpen(true)}
                className="min-h-[44px] rounded-lg border border-gray-400 bg-white px-4 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                Skip with reason…
              </button>
            </div>
          ) : null}

          {skipOpen ? (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
              <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
                <h4 className="text-base font-semibold text-gray-900">Skip optional slot</h4>
                <p className="mt-1 text-xs text-gray-600">Required views cannot be skipped.</p>
                <textarea
                  value={skipReason}
                  onChange={(e) => setSkipReason(e.target.value)}
                  rows={3}
                  className="mt-3 w-full rounded-lg border border-gray-300 p-2 text-sm"
                  placeholder="Clinical reason (visible in session progress metadata)"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setSkipOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={pending || !skipReason.trim()}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-400"
                    onClick={onSkip}
                  >
                    Confirm skip
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Start another guided session</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {orderedTemplates.map((t) => (
                <button
                  key={`extra-${t.slug}`}
                  type="button"
                  disabled={pending}
                  onClick={() => onStartTemplate(t.slug)}
                  className="min-h-[40px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-50"
                >
                  + {t.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {!currentSession ? (
        <p className="text-center text-xs text-gray-500">Sessions you create here also appear under the Protocols tab.</p>
      ) : null}

      {pending ? <p className="text-center text-xs text-gray-500">Working…</p> : null}
    </section>
  );
}
