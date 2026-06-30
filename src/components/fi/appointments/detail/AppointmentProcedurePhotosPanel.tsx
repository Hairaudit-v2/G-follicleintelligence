"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { LeadPhotoGalleryPanel } from "@/src/components/fi/crm/detail/LeadPhotoGalleryPanel";
import { PATIENT_IMAGE_CATEGORIES } from "@/src/lib/patientImages/patientImagePolicy";
import type { PatientImagesProfileBundle } from "@/src/lib/patientImages/patientImageTypes";
import { appointmentCardClass } from "../shared";

const PROCEDURE_CATEGORIES = ["before", "after", "post_op", "progress", "donor", "scalp"] as const;

export function AppointmentProcedurePhotosPanel({
  tenantId,
  patientId,
  bookingId,
  leadId,
  caseId,
  bundle,
}: {
  tenantId: string;
  patientId: string | null;
  bookingId: string;
  leadId: string | null;
  caseId: string | null;
  bundle: PatientImagesProfileBundle | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!patientId) {
        setMsg("Link a patient to upload procedure photos.");
        return;
      }
      setMsg(null);
      const form = e.currentTarget;
      const fd = new FormData(form);
      const file = fd.get("file");
      if (!(file instanceof File) || !file.size) {
        setMsg("Choose a file to upload.");
        return;
      }
      fd.set("booking_id", bookingId);
      if (leadId) fd.set("lead_id", leadId);
      if (caseId) fd.set("case_id", caseId);
      startTransition(async () => {
        try {
          const res = await fetch(
            `/api/tenants/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(patientId)}/images`,
            { method: "POST", body: fd, credentials: "include" }
          );
          const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
          if (!res.ok || !j.ok) {
            setMsg(j.error ?? `Upload failed (${res.status}).`);
            return;
          }
          setMsg("Uploaded — refresh gallery below.");
          form.reset();
          router.refresh();
        } catch (err) {
          setMsg(err instanceof Error ? err.message : "Upload failed.");
        }
      });
    },
    [bookingId, caseId, leadId, patientId, router, tenantId]
  );

  return (
    <div className="space-y-4">
      <section className={appointmentCardClass}>
        <h2 className="text-sm font-semibold text-slate-100">Upload during / after procedure</h2>
        <p className="mt-1 text-xs text-slate-400">
          Images are tagged and linked to this appointment. Prefer <strong>before</strong>, <strong>after</strong>, or{" "}
          <strong>post_op</strong> categories for Evolved Hair Clinics workflows.
        </p>
        {!patientId ? (
          <p className="mt-2 text-sm text-amber-200">Link a patient on this appointment to enable uploads.</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-3 space-y-3 rounded border border-white/[0.06] bg-white/[0.03] p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-xs text-slate-300">
                File
                <input
                  name="file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  required
                  className="mt-1 block w-full text-sm"
                />
              </label>
              <label className="block text-xs text-slate-300">
                Category
                <select
                  name="image_category"
                  defaultValue="post_op"
                  className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
                >
                  {PROCEDURE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  {PATIENT_IMAGE_CATEGORIES.filter(
                    (c) => !(PROCEDURE_CATEGORIES as readonly string[]).includes(c)
                  ).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-300 sm:col-span-2">
                Caption
                <input name="caption" type="text" className="mt-1 block w-full rounded border border-slate-700 px-2 py-1.5 text-sm" />
              </label>
              <input type="hidden" name="booking_id" value={bookingId} />
              {leadId ? <input type="hidden" name="lead_id" value={leadId} /> : null}
              {caseId ? <input type="hidden" name="case_id" value={caseId} /> : null}
            </div>
            {msg ? <p className="text-xs text-slate-300">{msg}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {pending ? "Uploading…" : "Upload photo"}
            </button>
          </form>
        )}
      </section>
      <LeadPhotoGalleryPanel tenantId={tenantId} patientId={patientId} bundle={bundle} />
    </div>
  );
}
