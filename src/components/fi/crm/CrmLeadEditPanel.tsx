"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { updateCrmLeadDetailsAction } from "@/lib/actions/fi-crm-actions";
import {
  CRM_LEAD_DETAIL_PRIORITY_VALUES,
  CRM_LEAD_DETAIL_STATUS_VALUES,
  parseCrmLeadAdminMetadataMergeJson,
  parseCrmLeadMetadataJsonInput,
} from "@/src/lib/crm/crmLeadDetailsPolicy";
import type {
  CrmShellClinicOption,
  CrmShellOrgOption,
  CrmShellUserPickerOption,
  FiCrmLeadRow,
} from "@/src/lib/crm/types";

function statusSelectOptions(current: string): string[] {
  const s = new Set<string>(CRM_LEAD_DETAIL_STATUS_VALUES);
  const c = current.trim();
  if (c) s.add(c);
  return Array.from(s);
}

function prioritySelectOptions(current: string | null): string[] {
  const s = new Set<string>(CRM_LEAD_DETAIL_PRIORITY_VALUES);
  const c = (current ?? "").trim();
  if (c) s.add(c);
  return Array.from(s);
}

type FieldKey = "summary" | "metadata" | "adminMerge" | "status" | "priority";

export function CrmLeadEditPanel({
  tenantId,
  lead,
  owners,
  organisations,
  clinics,
}: {
  tenantId: string;
  lead: FiCrmLeadRow;
  owners: CrmShellUserPickerOption[];
  organisations: CrmShellOrgOption[];
  clinics: CrmShellClinicOption[];
}) {
  const router = useRouter();
  const [summary, setSummary] = useState(lead.summary ?? "");
  const [status, setStatus] = useState(lead.status);
  const [priority, setPriority] = useState(lead.priority ?? "");
  const [ownerId, setOwnerId] = useState(lead.primary_owner_user_id ?? "");
  const [organisationId, setOrganisationId] = useState(lead.organisation_id ?? "");
  const [clinicId, setClinicId] = useState(lead.clinic_id ?? "");
  const [metadataRaw, setMetadataRaw] = useState(() =>
    JSON.stringify(lead.metadata ?? {}, null, 2)
  );
  const [adminMergeRaw, setAdminMergeRaw] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const statusOpts = useMemo(() => statusSelectOptions(lead.status), [lead.status]);
  const priorityOpts = useMemo(() => prioritySelectOptions(lead.priority), [lead.priority]);

  useEffect(() => {
    setSummary(lead.summary ?? "");
    setStatus(lead.status);
    setPriority(lead.priority ?? "");
    setOwnerId(lead.primary_owner_user_id ?? "");
    setOrganisationId(lead.organisation_id ?? "");
    setClinicId(lead.clinic_id ?? "");
    setMetadataRaw(JSON.stringify(lead.metadata ?? {}, null, 2));
    setFieldErrors({});
    setFormError(null);
  }, [
    lead.id,
    lead.updated_at,
    lead.summary,
    lead.status,
    lead.priority,
    lead.primary_owner_user_id,
    lead.organisation_id,
    lead.clinic_id,
    lead.metadata,
  ]);

  const clinicsForOrg = useMemo(() => {
    if (!organisationId) return clinics;
    return clinics.filter((c) => !c.organisation_id || c.organisation_id === organisationId);
  }, [clinics, organisationId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const nextErr: Partial<Record<FieldKey, string>> = {};
    if (!summary.trim()) nextErr.summary = "Lead title / summary is required.";

    if (
      !CRM_LEAD_DETAIL_STATUS_VALUES.includes(
        status as (typeof CRM_LEAD_DETAIL_STATUS_VALUES)[number]
      )
    ) {
      nextErr.status =
        "Pick a standard status from the list (legacy values cannot be saved until changed).";
    }
    if (
      priority.trim() !== "" &&
      !CRM_LEAD_DETAIL_PRIORITY_VALUES.includes(
        priority as (typeof CRM_LEAD_DETAIL_PRIORITY_VALUES)[number]
      )
    ) {
      nextErr.priority =
        "Pick a standard priority or None (legacy values cannot be saved until changed).";
    }

    let metadata: Record<string, unknown> = {};
    try {
      metadata = parseCrmLeadMetadataJsonInput(metadataRaw);
    } catch (err) {
      nextErr.metadata = err instanceof Error ? err.message : "Invalid metadata.";
    }

    let adminMerge: Record<string, unknown> | undefined;
    if (adminMergeRaw.trim()) {
      try {
        adminMerge = parseCrmLeadAdminMetadataMergeJson(adminMergeRaw);
        if (Object.keys(adminMerge).length > 0 && !adminKey.trim()) {
          nextErr.adminMerge = "FI admin key is required to apply the admin metadata merge.";
        }
      } catch (err) {
        nextErr.adminMerge = err instanceof Error ? err.message : "Invalid admin merge JSON.";
      }
    }

    setFieldErrors(nextErr);
    if (Object.keys(nextErr).length > 0) return;

    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        summary: summary.trim(),
        status,
        priority: priority.trim() === "" ? null : priority.trim(),
        primaryOwnerUserId: ownerId.trim() === "" ? null : ownerId.trim(),
        organisationId: organisationId.trim() === "" ? null : organisationId.trim(),
        clinicId: clinicId.trim() === "" ? null : clinicId.trim(),
        metadata,
      };
      if (adminMerge && Object.keys(adminMerge).length > 0) {
        body.adminMetadataMerge = adminMerge;
      }
      if (adminKey.trim()) body.adminKey = adminKey.trim();

      const r = await updateCrmLeadDetailsAction(tenantId, lead.id, body);
      if (!r.ok) {
        setFormError(r.error);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
      <h2 className="mb-1 text-sm font-semibold text-slate-100">Edit lead details</h2>
      <p className="mb-4 text-xs text-slate-400">
        Updates summary, status, priority, owner, and scope. Pipeline stage is unchanged here — use{" "}
        <strong>Move stage</strong> below.
      </p>
      <form onSubmit={onSubmit} className="grid max-w-2xl gap-3 text-sm">
        <label className="block">
          <span className="text-xs font-medium text-slate-300">Summary *</span>
          <textarea
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value);
              if (fieldErrors.summary) setFieldErrors((p) => ({ ...p, summary: undefined }));
            }}
            rows={2}
            className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5"
          />
          {fieldErrors.summary ? (
            <p className="mt-1 text-xs text-rose-300">{fieldErrors.summary}</p>
          ) : null}
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-300">Status</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                if (fieldErrors.status) setFieldErrors((p) => ({ ...p, status: undefined }));
              }}
              className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5"
            >
              {statusOpts.map((s) => (
                <option key={s} value={s}>
                  {s}
                  {!CRM_LEAD_DETAIL_STATUS_VALUES.includes(
                    s as (typeof CRM_LEAD_DETAIL_STATUS_VALUES)[number]
                  )
                    ? " (legacy)"
                    : ""}
                </option>
              ))}
            </select>
            {fieldErrors.status ? (
              <p className="mt-1 text-xs text-rose-300">{fieldErrors.status}</p>
            ) : null}
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-300">Priority</span>
            <select
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                if (fieldErrors.priority) setFieldErrors((p) => ({ ...p, priority: undefined }));
              }}
              className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5"
            >
              <option value="">None</option>
              {priorityOpts.map((p) => (
                <option key={p} value={p}>
                  {p}
                  {!CRM_LEAD_DETAIL_PRIORITY_VALUES.includes(
                    p as (typeof CRM_LEAD_DETAIL_PRIORITY_VALUES)[number]
                  )
                    ? " (legacy)"
                    : ""}
                </option>
              ))}
            </select>
            {fieldErrors.priority ? (
              <p className="mt-1 text-xs text-rose-300">{fieldErrors.priority}</p>
            ) : null}
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-slate-300">Primary owner</span>
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5"
          >
            <option value="">Unassigned</option>
            {ownerId && !owners.some((o) => o.id === ownerId) ? (
              <option value={ownerId}>Unknown user ({ownerId.slice(0, 8)}…)</option>
            ) : null}
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.email ?? o.id}
              </option>
            ))}
          </select>
        </label>

        {(organisations.length > 0 ||
          clinics.length > 0 ||
          organisationId !== "" ||
          clinicId !== "") && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-300">Organisation</span>
              <select
                value={organisationId}
                onChange={(e) => {
                  setOrganisationId(e.target.value);
                  setClinicId((cur) => {
                    const c = clinics.find((x) => x.id === cur);
                    if (!c) return "";
                    if (e.target.value && c.organisation_id && c.organisation_id !== e.target.value)
                      return "";
                    return cur;
                  });
                }}
                className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5"
              >
                <option value="">Tenant default</option>
                {organisationId && !organisations.some((o) => o.id === organisationId) ? (
                  <option value={organisationId}>
                    Unknown organisation ({organisationId.slice(0, 8)}…)
                  </option>
                ) : null}
                {organisations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-300">Clinic</span>
              <select
                value={clinicId}
                onChange={(e) => setClinicId(e.target.value)}
                className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5"
              >
                <option value="">None</option>
                {clinicId && !clinicsForOrg.some((c) => c.id === clinicId) ? (
                  <option value={clinicId}>Unknown clinic ({clinicId.slice(0, 8)}…)</option>
                ) : null}
                {clinicsForOrg.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <label className="block">
          <span className="text-xs font-medium text-slate-300">Metadata (JSON object)</span>
          <textarea
            value={metadataRaw}
            onChange={(e) => {
              setMetadataRaw(e.target.value);
              if (fieldErrors.metadata) setFieldErrors((p) => ({ ...p, metadata: undefined }));
            }}
            rows={5}
            spellCheck={false}
            className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5 font-mono text-xs"
          />
          {fieldErrors.metadata ? (
            <p className="mt-1 text-xs text-rose-300">{fieldErrors.metadata}</p>
          ) : null}
        </label>

        <div className="rounded border border-dashed border-slate-700 bg-white/[0.03] p-3">
          <p className="mb-2 text-xs font-medium text-slate-200">
            FI admin — optional metadata merge
          </p>
          <p className="mb-2 text-xs text-slate-400">
            Shallow-merged onto metadata when the FI admin key below matches{" "}
            <code className="rounded bg-white/[0.06] px-0.5">FI_ADMIN_API_KEY</code>.
          </p>
          <textarea
            value={adminMergeRaw}
            onChange={(e) => {
              setAdminMergeRaw(e.target.value);
              if (fieldErrors.adminMerge) setFieldErrors((p) => ({ ...p, adminMerge: undefined }));
            }}
            rows={3}
            spellCheck={false}
            placeholder='{"internal_flag": true}'
            className="w-full rounded border border-slate-700 px-2 py-1.5 font-mono text-xs"
          />
          {fieldErrors.adminMerge ? (
            <p className="mt-1 text-xs text-rose-300">{fieldErrors.adminMerge}</p>
          ) : null}
        </div>

        <label className="block">
          <span className="text-xs text-slate-400">FI admin key (optional)</span>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5"
            autoComplete="off"
          />
        </label>

        {formError ? (
          <div
            className="rounded border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300"
            role="alert"
          >
            {formError}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="w-fit rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save lead details"}
        </button>
      </form>
    </section>
  );
}
