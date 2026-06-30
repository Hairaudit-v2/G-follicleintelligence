import Link from "next/link";
import type { UniversalPatientRecordResult } from "@/src/lib/fi/foundation/patientRecord";

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

export function UniversalPatientRecord({
  tenantId,
  patientSlug,
  record,
}: {
  tenantId: string;
  /** Raw id from the URL (foundation or global). */
  patientSlug: string;
  record: UniversalPatientRecordResult;
}) {
  const base = `/fi-admin/${tenantId}`;
  const p = record.patient;
  const person = record.person;
  const headerName =
    p?.display_name ?? readPersonDisplayName(person?.metadata ?? {}) ?? "Unknown patient";
  const headerEmail = p?.email ?? readPersonEmail(person?.metadata ?? {}) ?? "—";
  const headerPhone = p?.phone ?? readPersonPhone(person?.metadata ?? {}) ?? "—";
  const sourceSystems = Array.from(new Set(record.resolution_rows.map((r) => r.source_system).filter(Boolean)));

  return (
    <div className="space-y-8 text-sm">
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <Link href={`${base}/foundation-integrity`} className="hover:text-slate-100 hover:underline">
          ← Foundation integrity
        </Link>
        <span className="text-gray-300">|</span>
        <Link href={`${base}/cases`} className="hover:text-slate-100 hover:underline">
          Patients
        </Link>
      </div>

      <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4">
        <h2 className="mb-3 text-base font-medium text-slate-100">Patient header</h2>
        <p className="text-lg font-semibold text-slate-100">{headerName}</p>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-gray-500">Email</dt>
            <dd>{headerEmail}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Phone</dt>
            <dd>{headerPhone}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Source system(s)</dt>
            <dd>{sourceSystems.length ? sourceSystems.join(", ") : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">URL id (ambiguous)</dt>
            <dd className="font-mono text-xs">{patientSlug}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Foundation patient id</dt>
            <dd className="font-mono text-xs">{p?.foundation_patient_id ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Person id</dt>
            <dd className="font-mono text-xs">{record.anchor.person_id ?? person?.person_id ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-gray-500">Global patient id(s)</dt>
            <dd className="font-mono text-xs break-all">
              {record.linked_global_patient_ids.length ? record.linked_global_patient_ids.join(", ") : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Anchor mode</dt>
            <dd className="capitalize">{record.anchor.mode.replace(/_/g, " ")}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4">
        <h2 className="mb-3 text-base font-medium text-slate-100">Clinical timeline</h2>
        <p className="mb-2 text-xs text-gray-500">fi_timeline_events, newest first. Source is read from event detail when present.</p>
        {record.timeline_events.length === 0 ? (
          <p className="text-gray-500">No timeline rows for resolved clinical patients.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-left text-gray-500">
                  <th className="py-2 pr-3">Occurred</th>
                  <th className="py-2 pr-3">Kind</th>
                  <th className="py-2 pr-3">Title</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Patient</th>
                </tr>
              </thead>
              <tbody>
                {record.timeline_events.map((ev) => (
                  <tr key={ev.id} className="border-b border-white/[0.06]">
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(ev.occurred_at)}</td>
                    <td className="py-2 pr-3 font-mono">{ev.event_kind}</td>
                    <td className="py-2 pr-3">{ev.title ?? "—"}</td>
                    <td className="py-2 pr-3">{ev.source_system ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono">
                      <Link href={`${base}/cases/${ev.case_id}`} className="text-blue-300 hover:underline">
                        {ev.case_id.slice(0, 8)}…
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4">
        <h2 className="mb-3 text-base font-medium text-slate-100">Clinical patients</h2>
        {record.cases.length === 0 ? (
          <p className="text-gray-500">No clinical patients in scope.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-left text-gray-500">
                  <th className="py-2 pr-3">Patient id</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Global case</th>
                  <th className="py-2 pr-3">External id</th>
                  <th className="py-2 pr-3">Clinic</th>
                  <th className="py-2 pr-3">Organisation</th>
                </tr>
              </thead>
              <tbody>
                {record.cases.map((c) => (
                  <tr key={c.case_id} className="border-b border-white/[0.06]">
                    <td className="py-2 pr-3 font-mono">
                      <Link href={`${base}/cases/${c.case_id}`} className="text-blue-300 hover:underline">
                        {c.case_id.slice(0, 8)}…
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{c.case_type ?? "—"}</td>
                    <td className="py-2 pr-3">{c.status}</td>
                    <td className="py-2 pr-3">{c.source_system ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{c.global_case_id ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{c.external_id ?? "—"}</td>
                    <td className="py-2 pr-3">{c.clinic_display_name ?? c.clinic_id ?? "—"}</td>
                    <td className="py-2 pr-3">{c.organisation_name ?? c.organisation_id ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4">
        <h2 className="mb-3 text-base font-medium text-slate-100">Media (unified view)</h2>
        <p className="mb-2 text-xs text-gray-500">v_fi_media_unified — legacy uploads and fi_media_assets.</p>
        {record.media_unified.length === 0 ? (
          <p className="text-gray-500">No media rows in scope.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-left text-gray-500">
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">File</th>
                  <th className="py-2 pr-3">Storage path</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Patient</th>
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
                    <td className="py-2 pr-3 font-mono">
                      {m.case_id ? (
                        <Link href={`${base}/cases/${m.case_id}`} className="text-blue-300 hover:underline">
                          {m.case_id.slice(0, 8)}…
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
        <p className="mb-2 text-xs text-gray-500">Direct rows tied to resolved patient ids or case ids in scope.</p>
        {record.media_assets_direct.length === 0 ? (
          <p className="text-gray-500">No fi_media_assets rows in scope.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-left text-gray-500">
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">File</th>
                  <th className="py-2 pr-3">Storage path</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Patient</th>
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
                    <td className="py-2 pr-3 font-mono">
                      {m.case_id ? (
                        <Link href={`${base}/cases/${m.case_id}`} className="text-blue-300 hover:underline">
                          {m.case_id.slice(0, 8)}…
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

      <section className="rounded border border-amber-400/20 bg-amber-400/10 p-4">
        <h2 className="mb-2 text-base font-medium text-amber-200">Resolution warnings</h2>
        {record.warnings.length === 0 ? (
          <p className="text-xs text-amber-300">No automated warnings for this snapshot.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-xs text-amber-200">
            {record.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </section>

      {record.source_identifiers.length > 0 && (
        <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4">
          <h2 className="mb-2 text-base font-medium text-slate-100">Source identifiers (fi_patient_source_ids)</h2>
          <ul className="space-y-1 font-mono text-xs">
            {record.source_identifiers.map((s, i) => (
              <li key={`${s.source_system}-${s.source_patient_id}-${i}`}>
                {s.source_system}:{s.source_patient_id}
                <span className="ml-2 text-gray-500">({fmtDate(s.created_at)})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
