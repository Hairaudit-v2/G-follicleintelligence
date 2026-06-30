"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { crmCreateLeadAction } from "@/lib/actions/fi-crm-actions";
import type { CrmShellClinicOption, CrmShellOrgOption } from "@/src/lib/crm/types";
import { useCrmLeadSlideOver } from "./LeadSlideOver";

type OwnerOpt = { id: string; email: string | null };

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

function hasPersonResolveSignal(p: {
  email: string;
  phone: string;
  displayName: string;
  sourcePersonId: string;
  sourcePatientId: string;
}): boolean {
  const email = p.email.trim();
  const phone = p.phone.trim();
  const displayName = p.displayName.trim();
  return Boolean(
    p.sourcePersonId.trim() ||
      p.sourcePatientId.trim() ||
      email.length > 0 ||
      phone.length > 0 ||
      displayName.length > 0
  );
}

type FieldKey = "summary" | "personId" | "personResolve" | "sourcePair" | "personMetadata";

export function CrmCreateLeadPanel({
  tenantId,
  owners,
  organisations,
  clinics,
}: {
  tenantId: string;
  owners: OwnerOpt[];
  organisations: CrmShellOrgOption[];
  clinics: CrmShellClinicOption[];
}) {
  const { operatorFiUserId: defaultOwnerUserId } = useCrmLeadSlideOver();
  const router = useRouter();
  const [personMode, setPersonMode] = useState<"resolve" | "link">("resolve");
  const [adminKey, setAdminKey] = useState("");
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState("");
  const [primaryOwnerUserId, setPrimaryOwnerUserId] = useState(defaultOwnerUserId);
  const [organisationId, setOrganisationId] = useState("");
  const [clinicId, setClinicId] = useState("");
  const [sourceSystem, setSourceSystem] = useState("");
  const [sourceLeadId, setSourceLeadId] = useState("");
  const [personId, setPersonId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [personSourceSystem, setPersonSourceSystem] = useState("fi_crm");
  const [sourcePersonId, setSourcePersonId] = useState("");
  const [personMetadataRaw, setPersonMetadataRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const clinicsForOrg = useMemo(() => {
    if (!organisationId) return clinics;
    return clinics.filter((c) => !c.organisation_id || c.organisation_id === organisationId);
  }, [clinics, organisationId]);

  function clearField(key: FieldKey) {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const nextErrors: Partial<Record<FieldKey, string>> = {};

    const sum = summary.trim();
    if (!sum) {
      nextErrors.summary = "Add a short lead title or summary.";
    }

    const ss = sourceSystem.trim();
    const sl = sourceLeadId.trim();
    if ((ss && !sl) || (!ss && sl)) {
      nextErrors.sourcePair = "Enter both a source system and a source lead id, or leave both empty.";
    }

    if (personMode === "link") {
      const pid = personId.trim();
      if (!pid) {
        nextErrors.personId = "Paste the existing person id, or switch to “New / matched person”.";
      } else if (!isUuid(pid)) {
        nextErrors.personId = "That does not look like a valid UUID.";
      }
    } else {
      const resolveInput = {
        email,
        phone,
        displayName,
        sourcePersonId: sourcePersonId,
        sourcePatientId: "",
      };
      if (!hasPersonResolveSignal(resolveInput)) {
        nextErrors.personResolve = "Enter at least an email, phone, display name, or external person id so we can find or create the person.";
      }
    }

    let personMetadata: Record<string, unknown> | undefined;
    const metaRaw = personMetadataRaw.trim();
    if (metaRaw) {
      try {
        const parsed: unknown = JSON.parse(metaRaw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          nextErrors.personMetadata = "Metadata must be a JSON object.";
        } else {
          personMetadata = parsed as Record<string, unknown>;
        }
      } catch {
        nextErrors.personMetadata = "Metadata must be valid JSON.";
      }
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        summary: sum,
        status: status.trim() || "open",
      };
      if (adminKey.trim()) body.adminKey = adminKey.trim();
      const owner = primaryOwnerUserId.trim();
      if (owner) body.primaryOwnerUserId = owner;
      const pri = priority.trim();
      if (pri) body.priority = pri;
      const oid = organisationId.trim();
      if (oid) body.organisationId = oid;
      const cid = clinicId.trim();
      if (cid) body.clinicId = cid;
      if (ss && sl) {
        body.sourceSystem = ss;
        body.sourceLeadId = sl;
      }

      if (personMode === "link") {
        body.personId = personId.trim();
      } else {
        const p: Record<string, unknown> = {};
        const em = email.trim();
        const ph = phone.trim();
        const dn = displayName.trim();
        const psys = personSourceSystem.trim();
        const spid = sourcePersonId.trim();
        if (em) p.email = em;
        if (ph) p.phone = ph;
        if (dn) p.display_name = dn;
        if (psys) p.source_system = psys;
        if (spid) p.source_person_id = spid;
        if (personMetadata) p.metadata = personMetadata;
        body.person = p;
      }

      const r = await crmCreateLeadAction(tenantId, body);
      if (!r.ok) {
        setFormError(r.error);
        return;
      }
      router.push(`/fi-admin/${tenantId}/crm/leads/${r.lead.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
      <h2 className="mb-1 text-sm font-semibold text-slate-100">Create lead</h2>
      <p className="mb-4 text-xs text-slate-400">
        Internal workflow — uses the gated CRM server action. Choose <strong>New / matched person</strong> to resolve or
        create <code className="rounded bg-white/[0.06] px-0.5">fi_persons</code> from contact fields, or{" "}
        <strong>Existing person</strong> to attach by UUID.
      </p>

      <form onSubmit={onSubmit} className="grid max-w-2xl gap-4 text-sm">
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="personMode"
              checked={personMode === "resolve"}
              onChange={() => {
                setPersonMode("resolve");
                setFieldErrors({});
              }}
            />
            <span>New / matched person</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="personMode"
              checked={personMode === "link"}
              onChange={() => {
                setPersonMode("link");
                setFieldErrors({});
              }}
            />
            <span>Existing person (UUID)</span>
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-slate-300">Lead title / summary *</span>
          <input
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value);
              clearField("summary");
            }}
            className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5"
            placeholder="e.g. FUE consult — follow up Monday"
            autoComplete="off"
          />
          {fieldErrors.summary ? <p className="mt-1 text-xs text-rose-300">{fieldErrors.summary}</p> : null}
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-300">Status</span>
            <input
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5"
              placeholder="open"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-300">Priority</span>
            <input
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5"
              placeholder="normal, high, …"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-slate-300">Owner</span>
          <select
            value={primaryOwnerUserId}
            onChange={(e) => setPrimaryOwnerUserId(e.target.value)}
            className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5"
          >
            <option value="">Unassigned</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.email ?? o.id}
              </option>
            ))}
          </select>
        </label>

        {(organisations.length > 0 || clinics.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-300">Organisation scope</span>
              <select
                value={organisationId}
                onChange={(e) => {
                  setOrganisationId(e.target.value);
                  setClinicId((cur) => {
                    const c = clinics.find((x) => x.id === cur);
                    if (!c) return "";
                    if (e.target.value && c.organisation_id && c.organisation_id !== e.target.value) return "";
                    return cur;
                  });
                }}
                className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5"
              >
                <option value="">Tenant default (no org)</option>
                {organisations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-300">Clinic scope</span>
              <select
                value={clinicId}
                onChange={(e) => setClinicId(e.target.value)}
                className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5"
              >
                <option value="">No clinic</option>
                {clinicsForOrg.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name}
                    {c.organisation_id ? "" : " (no org)"}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-300">External source system</span>
            <input
              value={sourceSystem}
              onChange={(e) => {
                setSourceSystem(e.target.value);
                clearField("sourcePair");
              }}
              className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5"
              placeholder="hubspot, meta_ads, …"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-300">External source lead id</span>
            <input
              value={sourceLeadId}
              onChange={(e) => {
                setSourceLeadId(e.target.value);
                clearField("sourcePair");
              }}
              className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5"
              placeholder="Upstream lead / deal id"
            />
          </label>
        </div>
        {fieldErrors.sourcePair ? <p className="text-xs text-rose-300">{fieldErrors.sourcePair}</p> : null}

        {personMode === "link" ? (
          <label className="block">
            <span className="text-xs font-medium text-slate-300">Person id *</span>
            <input
              value={personId}
              onChange={(e) => {
                setPersonId(e.target.value);
                clearField("personId");
              }}
              className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5 font-mono text-xs"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              spellCheck={false}
            />
            {fieldErrors.personId ? <p className="mt-1 text-xs text-rose-300">{fieldErrors.personId}</p> : null}
          </label>
        ) : (
          <div className="space-y-3 rounded border border-white/[0.06] bg-white/[0.03] p-3">
            <p className="text-xs font-medium text-slate-200">Person</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-xs text-slate-400">Display name</span>
                <input
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    clearField("personResolve");
                  }}
                  className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearField("personResolve");
                  }}
                  className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">Phone</span>
                <input
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    clearField("personResolve");
                  }}
                  className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">Person source system</span>
                <input
                  value={personSourceSystem}
                  onChange={(e) => setPersonSourceSystem(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5"
                  placeholder="fi_crm"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">External person id (optional)</span>
                <input
                  value={sourcePersonId}
                  onChange={(e) => {
                    setSourcePersonId(e.target.value);
                    clearField("personResolve");
                  }}
                  className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs text-slate-400">Extra person metadata (JSON object, optional)</span>
              <textarea
                value={personMetadataRaw}
                onChange={(e) => {
                  setPersonMetadataRaw(e.target.value);
                  clearField("personMetadata");
                }}
                rows={2}
                className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5 font-mono text-xs"
                placeholder='{"segment":"web_form"}'
              />
              {fieldErrors.personMetadata ? <p className="mt-1 text-xs text-rose-300">{fieldErrors.personMetadata}</p> : null}
            </label>
            {fieldErrors.personResolve ? <p className="text-xs text-rose-300">{fieldErrors.personResolve}</p> : null}
          </div>
        )}

        <label className="block">
          <span className="text-xs text-slate-400">FI admin key (optional — same as Configuration)</span>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5"
            autoComplete="off"
          />
        </label>

        {formError ? (
          <div className="rounded border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300" role="alert">
            {formError}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="w-fit rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create lead"}
        </button>
      </form>
    </section>
  );
}
