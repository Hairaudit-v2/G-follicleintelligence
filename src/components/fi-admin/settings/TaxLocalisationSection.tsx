"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ChangeEvent, type Dispatch, type SetStateAction } from "react";

import { saveTaxLocalisationSettingsAction } from "@/lib/actions/fi-tax-localisation-actions";
import { defaultTaxProfileForCountry, inferDefaultCurrencyForCountry } from "@/src/lib/taxLocalisation/taxLocalisationDefaults";
import { primaryConsumptionTaxLabel } from "@/src/lib/taxLocalisation/taxLocalisationPolicy";
import type {
  AustraliaTaxProfile,
  FiClinicOption,
  FiTaxCountryRegion,
  FiTaxCurrency,
  FiTaxLocalisationDocument,
  IndiaTaxProfile,
  NewZealandTaxProfile,
} from "@/src/lib/taxLocalisation/taxLocalisationTypes";
import { FI_TAX_COUNTRY_LABELS, FI_TAX_COUNTRY_REGIONS, FI_TAX_CURRENCY_LABELS, FI_TAX_CURRENCIES } from "@/src/lib/taxLocalisation/taxLocalisationTypes";

const inputClass =
  "w-full rounded-lg border border-white/[0.1] bg-[#081020]/85 px-2 py-1.5 text-sm text-[#F8FAFC] shadow-inner outline-none transition placeholder:text-[#475569] focus:border-[#22C1FF]/45 focus:ring-2 focus:ring-[#22C1FF]/20";

const labelClass = "grid gap-1 text-xs font-medium text-[#CBD5E1]";

const sectionTitle = "text-sm font-semibold text-[#F8FAFC]";

export function TaxLocalisationSection(props: {
  tenantId: string;
  clinicId: string | null;
  clinics: FiClinicOption[];
  initialDocument: FiTaxLocalisationDocument;
  canEdit: boolean;
}) {
  const { tenantId, clinics, canEdit } = props;
  const router = useRouter();
  const [doc, setDoc] = useState(props.initialDocument);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const clinicId = props.clinicId;

  const taxLabel = useMemo(() => primaryConsumptionTaxLabel(doc.countryRegion), [doc.countryRegion]);

  function setCountry(next: FiTaxCountryRegion) {
    setDoc((d) => {
      const currency = inferDefaultCurrencyForCountry(next);
      return {
        ...d,
        countryRegion: next,
        currency,
        taxProfile: defaultTaxProfileForCountry(next),
      };
    });
  }

  function onClinicScopeChange(nextClinicId: string) {
    const q = nextClinicId === "" ? "" : `?clinicId=${encodeURIComponent(nextClinicId)}`;
    router.push(`/fi-admin/${tenantId}/settings/tax-localisation${q}`);
  }

  function save() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await saveTaxLocalisationSettingsAction({
        tenantId,
        clinicId,
        document: doc,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setMsg("Saved.");
      router.refresh();
    });
  }

  const disabled = !canEdit;

  return (
    <div className="space-y-6">
      {!canEdit ? (
        <div
          className="rounded-lg border border-amber-600/35 bg-amber-950/30 px-3 py-2 text-xs text-amber-100/95"
          role="status"
        >
          View only — your role can review tax and localisation values but cannot save changes. Ask a clinic or finance
          admin to update settings.
        </div>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <span className={labelClass}>Scope</span>
          <select
            className={`${inputClass} max-w-md`}
            value={clinicId ?? ""}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => onClinicScopeChange(e.target.value)}
            disabled={clinics.length === 0}
          >
            <option value="">Tenant default (all clinics)</option>
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
          {clinics.length === 0 ? (
            <p className="text-xs text-[#94A3B8]">No clinics in this tenant — settings apply at tenant level only.</p>
          ) : null}
        </div>
        {canEdit ? (
          <button
            type="button"
            disabled={pending}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            onClick={() => void save()}
          >
            {pending ? "Saving…" : "Save settings"}
          </button>
        ) : (
          <p className="text-xs text-amber-200/90">View only — finance or clinic admin access required to edit.</p>
        )}
      </div>
      {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}
      {err ? <p className="text-sm text-red-400">{err}</p> : null}

      <div className="rounded-xl border border-white/[0.08] bg-[#0b1426]/80 p-4">
        <h2 className={sectionTitle}>Country & currency</h2>
        <p className="mt-1 text-xs text-[#94A3B8]">
          Defaults follow the selected country; you can override currency and rates where regulations allow.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Country / region
            <select
              className={inputClass}
              value={doc.countryRegion}
              disabled={disabled}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setCountry(e.target.value as FiTaxCountryRegion)}
            >
              {(FI_TAX_COUNTRY_REGIONS as readonly FiTaxCountryRegion[]).map((c) => (
                <option key={c} value={c}>
                  {FI_TAX_COUNTRY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Currency
            <select
              className={inputClass}
              value={doc.currency}
              disabled={disabled}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setDoc((d) => ({ ...d, currency: e.target.value as FiTaxCurrency }))
              }
            >
              {(FI_TAX_CURRENCIES as readonly FiTaxCurrency[]).map((c) => (
                <option key={c} value={c}>
                  {FI_TAX_CURRENCY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Effective from (for scheduled rate or rule changes)
            <input
              type="datetime-local"
              className={inputClass}
              disabled={disabled}
              value={toLocalInput(doc.effectiveFrom)}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setDoc((d) => ({ ...d, effectiveFrom: fromLocalInput(e.target.value) }))
              }
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-[#0b1426]/80 p-4">
        <h2 className={sectionTitle}>
          Tax system — {taxLabel} ({FI_TAX_COUNTRY_LABELS[doc.countryRegion]})
        </h2>
        <div className="mt-3">{renderTaxProfileEditor(doc, setDoc, disabled)}</div>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-[#0b1426]/80 p-4">
        <h2 className={sectionTitle}>Invoice settings</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Invoice prefix
            <input
              className={inputClass}
              disabled={disabled}
              value={doc.invoiceSettings.invoicePrefix}
              onChange={(e) => setDoc((d) => ({ ...d, invoiceSettings: { ...d.invoiceSettings, invoicePrefix: e.target.value } }))}
            />
          </label>
          <label className={labelClass}>
            Starting invoice number
            <input
              type="number"
              className={inputClass}
              disabled={disabled}
              value={doc.invoiceSettings.startingInvoiceNumber}
              onChange={(e) =>
                setDoc((d) => ({
                  ...d,
                  invoiceSettings: {
                    ...d.invoiceSettings,
                    startingInvoiceNumber: Number(e.target.value) || 0,
                  },
                }))
              }
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Payment terms
            <input
              className={inputClass}
              disabled={disabled}
              value={doc.invoiceSettings.paymentTerms}
              onChange={(e) =>
                setDoc((d) => ({ ...d, invoiceSettings: { ...d.invoiceSettings, paymentTerms: e.target.value } }))
              }
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-[#CBD5E1]">
            <input
              type="checkbox"
              disabled={disabled}
              checked={doc.invoiceSettings.showTaxBreakdown}
              onChange={(e) =>
                setDoc((d) => ({
                  ...d,
                  invoiceSettings: { ...d.invoiceSettings, showTaxBreakdown: e.target.checked },
                }))
              }
            />
            Show tax breakdown on invoices
          </label>
          <label className="flex items-center gap-2 text-sm text-[#CBD5E1]">
            <input
              type="checkbox"
              disabled={disabled}
              checked={doc.invoiceSettings.showBusinessRegistrationNumber}
              onChange={(e) =>
                setDoc((d) => ({
                  ...d,
                  invoiceSettings: { ...d.invoiceSettings, showBusinessRegistrationNumber: e.target.checked },
                }))
              }
            />
            Show business registration number on invoices
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-[#0b1426]/80 p-4">
        <h2 className={sectionTitle}>Receipt settings</h2>
        <div className="mt-3 grid gap-3">
          <label className={labelClass}>
            Clinic legal entity name
            <input
              className={inputClass}
              disabled={disabled}
              value={doc.receiptSettings.legalEntityName}
              onChange={(e) =>
                setDoc((d) => ({ ...d, receiptSettings: { ...d.receiptSettings, legalEntityName: e.target.value } }))
              }
            />
          </label>
          <label className={labelClass}>
            Trading name
            <input
              className={inputClass}
              disabled={disabled}
              value={doc.receiptSettings.tradingName}
              onChange={(e) =>
                setDoc((d) => ({ ...d, receiptSettings: { ...d.receiptSettings, tradingName: e.target.value } }))
              }
            />
          </label>
          <label className={labelClass}>
            Registered address
            <textarea
              className={`${inputClass} min-h-[72px]`}
              disabled={disabled}
              value={doc.receiptSettings.registeredAddress}
              onChange={(e) =>
                setDoc((d) => ({ ...d, receiptSettings: { ...d.receiptSettings, registeredAddress: e.target.value } }))
              }
            />
          </label>
          <label className={labelClass}>
            Tax footer text
            <textarea
              className={`${inputClass} min-h-[56px]`}
              disabled={disabled}
              value={doc.receiptSettings.taxFooterText}
              onChange={(e) =>
                setDoc((d) => ({ ...d, receiptSettings: { ...d.receiptSettings, taxFooterText: e.target.value } }))
              }
            />
          </label>
          <label className={labelClass}>
            Refund policy link (optional)
            <input
              className={inputClass}
              disabled={disabled}
              value={doc.receiptSettings.refundPolicyUrl}
              onChange={(e) =>
                setDoc((d) => ({ ...d, receiptSettings: { ...d.receiptSettings, refundPolicyUrl: e.target.value } }))
              }
            />
          </label>
        </div>
      </div>

      <p className="text-xs text-[#64748B]">
        Quotes, invoices, and finance dashboards should load these values from{" "}
        <code className="rounded bg-[#141C33] px-1 text-[11px] text-[#22C1FF]">resolveTaxLocalisationDocumentOrDefault</code> in
        server code — avoid hard-coding tax rules in presentational components.
      </p>
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function renderTaxProfileEditor(
  doc: FiTaxLocalisationDocument,
  setDoc: Dispatch<SetStateAction<FiTaxLocalisationDocument>>,
  disabled: boolean
) {
  switch (doc.countryRegion) {
    case "AU": {
      const p = doc.taxProfile as AustraliaTaxProfile & { country: "AU" };
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            ABN
            <input
              className={inputClass}
              disabled={disabled}
              value={p.abn}
              onChange={(e) =>
                setDoc((d) => ({
                  ...d,
                  taxProfile: { ...(d.taxProfile as typeof p), country: "AU", abn: e.target.value },
                }))
              }
            />
          </label>
          <label className={labelClass}>
            Business name
            <input
              className={inputClass}
              disabled={disabled}
              value={p.businessName}
              onChange={(e) =>
                setDoc((d) => ({
                  ...d,
                  taxProfile: { ...(d.taxProfile as typeof p), country: "AU", businessName: e.target.value },
                }))
              }
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-[#CBD5E1] sm:col-span-2">
            <input
              type="checkbox"
              disabled={disabled}
              checked={p.gstRegistered}
              onChange={(e) =>
                setDoc((d) => ({
                  ...d,
                  taxProfile: { ...(d.taxProfile as typeof p), country: "AU", gstRegistered: e.target.checked },
                }))
              }
            />
            GST registered
          </label>
          <label className={labelClass}>
            GST rate default (%)
            <input
              type="number"
              step="0.01"
              className={inputClass}
              disabled={disabled}
              value={p.gstRatePercent}
              onChange={(e) =>
                setDoc((d) => ({
                  ...d,
                  taxProfile: {
                    ...(d.taxProfile as typeof p),
                    country: "AU",
                    gstRatePercent: Number(e.target.value) || 0,
                  },
                }))
              }
            />
          </label>
        </div>
      );
    }
    case "IN": {
      const p = doc.taxProfile as IndiaTaxProfile & { country: "IN" };
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            GSTIN
            <input
              className={inputClass}
              disabled={disabled}
              value={p.gstin}
              onChange={(e) =>
                setDoc((d) => ({
                  ...d,
                  taxProfile: { ...(d.taxProfile as typeof p), country: "IN", gstin: e.target.value },
                }))
              }
            />
          </label>
          <label className={labelClass}>
            State
            <input
              className={inputClass}
              disabled={disabled}
              value={p.state}
              onChange={(e) =>
                setDoc((d) => ({
                  ...d,
                  taxProfile: { ...(d.taxProfile as typeof p), country: "IN", state: e.target.value },
                }))
              }
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Place of supply
            <input
              className={inputClass}
              disabled={disabled}
              value={p.placeOfSupply}
              onChange={(e) =>
                setDoc((d) => ({
                  ...d,
                  taxProfile: { ...(d.taxProfile as typeof p), country: "IN", placeOfSupply: e.target.value },
                }))
              }
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            CGST / SGST / IGST handling
            <select
              className={inputClass}
              disabled={disabled}
              value={p.gstHandling}
              onChange={(e) =>
                setDoc((d) => ({
                  ...d,
                  taxProfile: {
                    ...(d.taxProfile as typeof p),
                    country: "IN",
                    gstHandling: e.target.value as IndiaTaxProfile["gstHandling"],
                  },
                }))
              }
            >
              <option value="cgst_sgst">CGST + SGST (intra-state)</option>
              <option value="igst">IGST (inter-state)</option>
              <option value="mixed">Mixed / manual per invoice</option>
            </select>
          </label>
          <label className={labelClass}>
            Default CGST (%)
            <input
              type="number"
              step="0.01"
              className={inputClass}
              disabled={disabled}
              value={p.defaultCgstPercent}
              onChange={(e) =>
                setDoc((d) => ({
                  ...d,
                  taxProfile: {
                    ...(d.taxProfile as typeof p),
                    country: "IN",
                    defaultCgstPercent: Number(e.target.value) || 0,
                  },
                }))
              }
            />
          </label>
          <label className={labelClass}>
            Default SGST (%)
            <input
              type="number"
              step="0.01"
              className={inputClass}
              disabled={disabled}
              value={p.defaultSgstPercent}
              onChange={(e) =>
                setDoc((d) => ({
                  ...d,
                  taxProfile: {
                    ...(d.taxProfile as typeof p),
                    country: "IN",
                    defaultSgstPercent: Number(e.target.value) || 0,
                  },
                }))
              }
            />
          </label>
          <label className={labelClass}>
            Default IGST (%)
            <input
              type="number"
              step="0.01"
              className={inputClass}
              disabled={disabled}
              value={p.defaultIgstPercent}
              onChange={(e) =>
                setDoc((d) => ({
                  ...d,
                  taxProfile: {
                    ...(d.taxProfile as typeof p),
                    country: "IN",
                    defaultIgstPercent: Number(e.target.value) || 0,
                  },
                }))
              }
            />
          </label>
        </div>
      );
    }
    case "NZ": {
      const p = doc.taxProfile as NewZealandTaxProfile & { country: "NZ" };
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            GST number
            <input
              className={inputClass}
              disabled={disabled}
              value={p.gstNumber}
              onChange={(e) =>
                setDoc((d) => ({
                  ...d,
                  taxProfile: { ...(d.taxProfile as typeof p), country: "NZ", gstNumber: e.target.value },
                }))
              }
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-[#CBD5E1] sm:col-span-2">
            <input
              type="checkbox"
              disabled={disabled}
              checked={p.gstRegistered}
              onChange={(e) =>
                setDoc((d) => ({
                  ...d,
                  taxProfile: { ...(d.taxProfile as typeof p), country: "NZ", gstRegistered: e.target.checked },
                }))
              }
            />
            GST registered
          </label>
          <label className={labelClass}>
            GST rate default (%)
            <input
              type="number"
              step="0.01"
              className={inputClass}
              disabled={disabled}
              value={p.gstRatePercent}
              onChange={(e) =>
                setDoc((d) => ({
                  ...d,
                  taxProfile: {
                    ...(d.taxProfile as typeof p),
                    country: "NZ",
                    gstRatePercent: Number(e.target.value) || 0,
                  },
                }))
              }
            />
          </label>
        </div>
      );
    }
    default:
      return (
        <p className="text-sm text-[#94A3B8]">
          For {FI_TAX_COUNTRY_LABELS[doc.countryRegion]}, configure generic tax labels in receipts and invoices; extend{" "}
          <code className="text-xs text-[#22C1FF]">tax_profile</code> when country-specific rules are added.
        </p>
      );
  }
}
