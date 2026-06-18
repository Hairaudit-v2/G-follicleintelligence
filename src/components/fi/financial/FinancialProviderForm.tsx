"use client";

import { useState, useTransition } from "react";

import { createFinanceProviderAction } from "@/lib/actions/financial-os-finance-actions";
import { FinancialOsFeedbackText, FinancialOsFormPanel, financialOsClasses, type FinancialOsFeedback } from "@/src/components/fi-admin/financial-os/financialOsUi";

const PROVIDER_TYPES = [
  { value: "medical_financing", label: "Medical financing" },
  { value: "bnpl", label: "Buy now pay later" },
  { value: "super_release", label: "Super release" },
  { value: "international_financing", label: "International financing" },
  { value: "custom", label: "Custom" },
] as const;

export function FinancialProviderForm(props: { tenantId: string; canMutate: boolean }) {
  const [name, setName] = useState("");
  const [providerType, setProviderType] = useState<(typeof PROVIDER_TYPES)[number]["value"]>("custom");
  const [countryCode, setCountryCode] = useState("AU");
  const [isActive, setIsActive] = useState(true);
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [pending, start] = useTransition();

  if (!props.canMutate) {
    return <p className={financialOsClasses.mutedMeta}>Finance or manager role required to manage financing providers.</p>;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    start(async () => {
      const res = await createFinanceProviderAction(props.tenantId, {
        name: name.trim(),
        provider_type: providerType,
        country_code: countryCode.trim() || null,
        is_active: isActive,
      });
      if (!res.ok) {
        setFeedback({ message: res.error, tone: "error" });
        return;
      }
      setName("");
      setFeedback({ message: "Provider created.", tone: "success" });
    });
  }

  return (
    <FinancialOsFormPanel title="Add tenant provider">
      <form onSubmit={onSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={financialOsClasses.formLabel}>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className={financialOsClasses.input} required />
          </label>
          <label className={financialOsClasses.formLabel}>
            Type
            <select
              value={providerType}
              onChange={(e) => setProviderType(e.target.value as (typeof PROVIDER_TYPES)[number]["value"])}
              className={financialOsClasses.select}
            >
              {PROVIDER_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className={financialOsClasses.formLabel}>
            Country code
            <input value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className={financialOsClasses.input} />
          </label>
          <label className={`${financialOsClasses.checkboxLabel} pt-5`}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active for new applications
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="submit" disabled={pending} className={financialOsClasses.primaryButton}>
            {pending ? "Saving…" : "Create provider"}
          </button>
          <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} />
        </div>
      </form>
    </FinancialOsFormPanel>
  );
}
