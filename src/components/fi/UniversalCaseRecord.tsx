import Link from "next/link";
import type { UniversalCaseRecordResult } from "@/src/lib/fi/foundation/caseRecord";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function readPersonEmail(metadata: Record<string, unknown>): string | null {
  const e = metadata.email_normalized ?? metadata.email;
  return typeof e === "string" && e.trim() ? e.trim() : null;
}

function readPersonPhone(metadata: Record<string, unknown>): string | null {
  const p = metadata.phone;
  return typeof p === "string" && p.trim() ? p.trim() : null;
}

function readPersonDisplayName(metadata: Record<string, unknown>): string | null {
  const d = metadata.display_name ?? metadata.full_name;
  return typeof d === "string" && d.trim() ? d.trim() : null;
}

export function UniversalCaseRecord({
  tenantId,
  record,
}: {
  tenantId: string;
  record: UniversalCaseRecordResult;
}) {
  const base = `/fi-admin/${tenantId}`;
  const c = record.case;
  const lp = record.linked_patient;
  const p = lp?.patient;
  const person = lp?.person;
  const displayName =
    p?.display_name ?? readPersonDisplayName(person?.metadata ?? {}) ?? "—";
  const email = p?.email ?? readPersonEmail(person?.metadata ?? {}) ?? "—";
  const phone = p?.phone ?? readPersonPhone(person?.metadata ?? {}) ?? "—";

  const patientRecordHref = c.foundation_patient_id
    ? `${base}/patients/${c.foundation_patient_id}`
    : c.global_patient_id
      ? `${base}/patients/${c.global_patient_id}`
      : null;

  return (
    <div className="space-y-8 text-sm">
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <Link href={`${base}/cases`} className="hover:text-slate-100 hover:underline">
          ← Patients
        </Link>
        <span className="text-gray-300">|</span>
        <Link href={`${base}/foundation-integrity`} className="hover:text-slate-100 hover:underline">
          Foundation integrity
        </Link>
      </div>

      <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4">
        <h2 className="mb-3 text-base font-medium text-slate-100">Patient header</h2>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs text-gray-500">Patient id</dt>
            <dd className="font-mono text-xs break-all">{c.case_id}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Patient type</dt>
            <dd>{c.case_type ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Status</dt>
            <dd>{c.status}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Source system</dt>
            <dd>{c.source_system ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Source patient id</dt>
            <dd className="font-mono text-xs break-all">{c.source_case_id ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Global patient id</dt>
            <dd className="font-mono text-xs break-all">{c.global_case_id ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">External id (fi_cases)</dt>
            <dd className="font-mono text-xs break-all">{c.external_id ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Created</dt>
            <dd>{fmtDate(c.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Updated</dt>
            <dd>{fmtDate(c.updated_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4">
        <h2 className="mb-3 text-base font-medium text-slate-100">Linked patient</h2>
        {!lp || (!p && lp.resolution_rows.length === 0) ? (
          <p className="text-gray-500">No foundation patient linked on this case.</p>
        ) : (
          <>
            <dl className="grid gap-2 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-xs text-gray-500">Display name</dt>
                <dd className="text-base font-medium text-slate-100">{displayName}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Email</dt>
                <dd>{email}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Phone</dt>
                <dd>{phone}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Foundation patient id</dt>
                <dd className="font-mono text-xs">{p?.foundation_patient_id ?? c.foundation_patient_id ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Person id</dt>
                <dd className="font-mono text-xs">{person?.person_id ?? c.person_id ?? "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-gray-500">Global patient id(s)</dt>
                <dd className="font-mono text-xs break-all">
                  {[
                    ...(c.global_patient_id ? [c.global_patient_id] : []),
                    ...(lp.global_patient_ids.filter((id) => id !== c.global_patient_id)),
                  ].length
                    ? Array.from(
                        new Set([
                          ...(c.global_patient_id ? [c.global_patient_id] : []),
                          ...lp.global_patient_ids,
                        ])
                      ).join(", ")
                    : "—"}
                </dd>
              </div>
            </dl>
            {patientRecordHref ? (
              <p className="mt-3">
                <Link href={patientRecordHref} className="text-blue-300 hover:underline">
                  Open universal patient record →
                </Link>
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4">
        <h2 className="mb-3 text-base font-medium text-slate-100">Clinic / organisation</h2>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-gray-500">Organisation</dt>
            <dd>{record.organisation?.name ?? record.case.organisation_name ?? record.case.organisation_id ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Clinic</dt>
            <dd>{record.clinic?.display_name ?? record.case.clinic_display_name ?? record.case.clinic_id ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">City</dt>
            <dd>{record.clinic?.city ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Country</dt>
            <dd>{record.clinic?.country ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4">
        <h2 className="mb-3 text-base font-medium text-slate-100">Timeline</h2>
        <p className="mb-2 text-xs text-gray-500">fi_timeline_events for this case, newest first (capped server-side).</p>
        {record.timeline_events.length === 0 ? (
          <p className="text-gray-500">No timeline events.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-left text-gray-500">
                  <th className="py-2 pr-3">Occurred</th>
                  <th className="py-2 pr-3">Kind</th>
                  <th className="py-2 pr-3">Title</th>
                  <th className="py-2 pr-3">Source</th>
                </tr>
              </thead>
              <tbody>
                {record.timeline_events.map((ev) => (
                  <tr key={ev.id} className="border-b border-white/[0.06]">
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(ev.occurred_at)}</td>
                    <td className="py-2 pr-3 font-mono">{ev.event_kind}</td>
                    <td className="py-2 pr-3">{ev.title ?? "—"}</td>
                    <td className="py-2 pr-3">{ev.source_system ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4">
        <h2 className="mb-3 text-base font-medium text-slate-100">Media (v_fi_media_unified)</h2>
        {record.media_unified.length === 0 ? (
          <p className="text-gray-500">No unified media rows for this case.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-left text-gray-500">
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">File</th>
                  <th className="py-2 pr-3">Storage</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Foundation patient</th>
                  <th className="py-2 pr-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {record.media_unified.map((m, idx) => (
                  <tr key={`${m.media_asset_id ?? ""}-${m.legacy_upload_id ?? ""}-${idx}`} className="border-b border-white/[0.06]">
                    <td className="py-2 pr-3 font-mono">{m.asset_type ?? "—"}</td>
                    <td className="py-2 pr-3">{m.file_name ?? "—"}</td>
                    <td className="py-2 pr-3 max-w-xs truncate font-mono" title={m.storage_path ?? ""}>
                      {m.storage_path ?? "—"}
                    </td>
                    <td className="py-2 pr-3">{m.source_system ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {m.foundation_patient_id ? (
                        <Link
                          href={`${base}/patients/${m.foundation_patient_id}`}
                          className="text-blue-300 hover:underline"
                        >
                          {m.foundation_patient_id.slice(0, 8)}…
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4">
        <h2 className="mb-3 text-base font-medium text-slate-100">Media (fi_media_assets)</h2>
        <p className="mb-2 text-xs text-gray-500">
          All rows for this case; supplemental rows are those not matched in the unified view by media asset id.
        </p>
        {record.media_assets_direct.length === 0 ? (
          <p className="text-gray-500">No fi_media_assets for this case.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-left text-gray-500">
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">File</th>
                  <th className="py-2 pr-3">Storage</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Patient id</th>
                  <th className="py-2 pr-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {record.media_assets_direct.map((m) => (
                  <tr key={m.id} className="border-b border-white/[0.06]">
                    <td className="py-2 pr-3 font-mono">{m.asset_type}</td>
                    <td className="py-2 pr-3">{m.filename}</td>
                    <td className="py-2 pr-3 max-w-xs truncate font-mono" title={m.storage_path}>
                      {m.storage_path}
                    </td>
                    <td className="py-2 pr-3">{m.source_system ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {m.patient_id ? (
                        <Link href={`${base}/patients/${m.patient_id}`} className="text-blue-300 hover:underline">
                          {m.patient_id.slice(0, 8)}…
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {record.media_assets_supplemental.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium text-slate-200">Supplemental (not in unified by asset id)</h3>
            <ul className="space-y-1 font-mono text-xs text-slate-300">
              {record.media_assets_supplemental.map((m) => (
                <li key={m.id}>
                  {m.filename} <span className="text-gray-500">({m.id.slice(0, 8)}…)</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {record.case_source_identifiers.length > 0 && (
        <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4">
          <h2 className="mb-2 text-base font-medium text-slate-100">Patient source identifiers</h2>
          <ul className="space-y-1 text-xs">
            {record.case_source_identifiers.map((s, i) => (
              <li key={`${s.provenance}-${s.source_system}-${s.source_case_id}-${i}`} className="font-mono">
                {s.source_system}:{s.source_case_id}
                <span className="ml-2 text-gray-500">
                  ({s.provenance}
                  {s.global_case_id ? ` · global_case ${s.global_case_id.slice(0, 8)}…` : ""})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lp && lp.patient_source_ids.length > 0 && (
        <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4">
          <h2 className="mb-2 text-base font-medium text-slate-100">Patient source identifiers</h2>
          <ul className="space-y-1 font-mono text-xs">
            {lp.patient_source_ids.map((s, i) => (
              <li key={`${s.source_system}-${s.source_patient_id}-${i}`}>
                {s.source_system}:{s.source_patient_id}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded border border-amber-400/20 bg-amber-400/10 p-4">
        <h2 className="mb-2 text-base font-medium text-amber-200">Resolution warnings</h2>
        {record.warnings.length === 0 ? (
          <p className="text-xs text-amber-300">No automated warnings for this snapshot.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-xs text-amber-200">
            {record.warnings.map((w, i) => (
              <li key={`${i}-${w.slice(0, 40)}`}>{w}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
