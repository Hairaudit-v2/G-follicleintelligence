"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { financialOsClasses } from "@/src/components/fi-admin/financial-os/financialOsUi";

export function ExpensePeriodFilterBar(props: {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [from, setFrom] = useState(props.periodStart);
  const [to, setTo] = useState(props.periodEnd);

  function apply(nextFrom: string, nextTo: string) {
    start(() => {
      const base = `/fi-admin/${props.tenantId}/financial/expenses`;
      const qs = new URLSearchParams();
      if (nextFrom) qs.set("from", nextFrom);
      if (nextTo) qs.set("to", nextTo);
      const q = qs.toString();
      router.push(q ? `${base}?${q}` : base);
      router.refresh();
    });
  }

  function preset(days: number | "ytd") {
    const end = new Date().toISOString().slice(0, 10);
    let start: string;
    if (days === "ytd") {
      start = `${end.slice(0, 4)}-01-01`;
    } else {
      const d = new Date(`${end}T00:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() - (days - 1));
      start = d.toISOString().slice(0, 10);
    }
    setFrom(start);
    setTo(end);
    apply(start, end);
  }

  return (
    <div className={`${financialOsClasses.formPanel} flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end`}>
      <label className={financialOsClasses.formLabel}>
        From
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className={financialOsClasses.input}
          disabled={pending}
        />
      </label>
      <label className={financialOsClasses.formLabel}>
        To
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={financialOsClasses.input}
          disabled={pending}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={financialOsClasses.primaryButton}
          disabled={pending}
          onClick={() => apply(from, to)}
        >
          {pending ? "Applying…" : "Apply range"}
        </button>
        <button
          type="button"
          className={financialOsClasses.secondaryButton}
          disabled={pending}
          onClick={() => preset(30)}
        >
          30d
        </button>
        <button
          type="button"
          className={financialOsClasses.secondaryButton}
          disabled={pending}
          onClick={() => preset(90)}
        >
          90d
        </button>
        <button
          type="button"
          className={financialOsClasses.secondaryButton}
          disabled={pending}
          onClick={() => preset("ytd")}
        >
          YTD
        </button>
      </div>
    </div>
  );
}
