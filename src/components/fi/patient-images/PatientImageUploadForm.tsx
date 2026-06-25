"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { IMAGING_ANATOMICAL_REGIONS, IMAGING_LIBRARY_AXES } from "@/src/lib/imagingOs/imagingOsConstants";
import { PATIENT_IMAGE_CATEGORIES } from "@/src/lib/patientImages/patientImagePolicy";
import type { PatientProfileBookingCard, PatientProfileCaseCard, PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";

export function PatientImageUploadForm({
  tenantId,
  patientId,
  data,
}: {
  tenantId: string;
  patientId: string;
  data: PatientProfileFoundationData;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const allBookings = [...data.bookings.upcoming, ...data.bookings.past];

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setMsg(null);
      const form = e.currentTarget;
      const fd = new FormData(form);
      const file = fd.get("file");
      if (!(file instanceof File) || !file.size) {
        setMsg("Choose a file to upload.");
        return;
      }
      startTransition(async () => {
        try {
          fd.set("capture_type", "upload");
          fd.set("capture_source", "profile_upload_form");
          const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(patientId)}/images`, {
            method: "POST",
            body: fd,
            credentials: "include",
          });
          const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
          if (!res.ok || !j.ok) {
            setMsg(j.error ?? `Upload failed (${res.status}).`);
            return;
          }
          setMsg("Uploaded.");
          form.reset();
          router.refresh();
        } catch (err) {
          setMsg(err instanceof Error ? err.message : "Upload failed.");
        }
      });
    },
    [patientId, router, tenantId]
  );

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded border border-gray-100 bg-gray-50/80 p-3">
      <p className="text-xs font-medium text-gray-800">Upload</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs text-gray-700">
          File (max 20 MB, JPEG/PNG/WebP/HEIC)
          <input
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            capture="environment"
            required
            className="mt-1 block w-full text-sm"
          />
        </label>
        <label className="block text-xs text-gray-700">
          Imaging library axis
          <select name="imaging_library_axis" defaultValue="general_clinical" className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm">
            {IMAGING_LIBRARY_AXES.map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-700">
          Anatomical region (optional)
          <select name="anatomical_region" defaultValue="" className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm">
            <option value="">—</option>
            {IMAGING_ANATOMICAL_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-700">
          Image category
          <select name="image_category" defaultValue="scalp" className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm">
            {PATIENT_IMAGE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-700 sm:col-span-2">
          Caption (optional)
          <input name="caption" type="text" className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm" />
        </label>
        <label className="block text-xs text-gray-700">
          Taken at (optional)
          <input name="taken_at" type="datetime-local" className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm" />
        </label>
        <label className="block text-xs text-gray-700">
          Link patient (optional)
          <select name="case_id" defaultValue="" className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm">
            <option value="">—</option>
            {data.cases.map((c: PatientProfileCaseCard) => (
              <option key={c.id} value={c.id}>
                {c.case_type ?? "Patient"} · {c.id.slice(0, 8)}…
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-700">
          Link booking (optional)
          <select name="booking_id" defaultValue="" className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm">
            <option value="">—</option>
            {allBookings.map((b: PatientProfileBookingCard) => (
              <option key={b.id} value={b.id}>
                {b.booking_type} · {b.start_at.slice(0, 16)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-700">
          Link lead (optional)
          <select name="lead_id" defaultValue="" className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm">
            <option value="">—</option>
            {data.leads.map((row) => (
              <option key={row.lead.id} value={row.lead.id}>
                {row.lead.summary?.slice(0, 40) ?? row.lead.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-700 sm:col-span-2">
          Metadata JSON object (optional)
          <textarea
            name="metadata"
            rows={3}
            spellCheck={false}
            defaultValue="{}"
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 font-mono text-xs"
          />
        </label>
      </div>
      {msg ? <p className="text-xs text-gray-700">{msg}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {pending ? "Uploading…" : "Upload image"}
      </button>
    </form>
  );
}
