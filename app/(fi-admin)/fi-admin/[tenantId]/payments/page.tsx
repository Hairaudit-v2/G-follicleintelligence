import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { readFiPaymentsEnabled } from "@/src/lib/payments/fiPaymentEnv.server";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { calendarDateStringFromInstant } from "@/src/lib/calendar/calendarTimezone";
import { loadPaymentsInboxSnapshot, type PaymentsInboxFilters } from "@/src/lib/revenueOs/paymentsInboxLoader.server";

export const metadata: Metadata = {
  title: "Payments inbox",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function formatMoney(cents: number, currency: string): string {
  const v = cents / 100;
  return `${currency} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseFilters(sp: Record<string, string | string[] | undefined>): PaymentsInboxFilters {
  const g = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v.trim() : "";
  };
  const clinicId = g("clinic") || null;
  const patientQuery = g("patient") || null;
  const dueFrom = g("due_from") || null;
  const dueTo = g("due_to") || null;
  const caseLinkedOnly = g("case") === "1";
  const st = g("status");
  const invoiceStatuses = st ? st.split(",").map((x) => x.trim()).filter(Boolean) : null;
  return { clinicId, patientQuery, dueFrom, dueTo, caseLinkedOnly, invoiceStatuses };
}

export default async function TenantPaymentsInboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);
  if (!readFiPaymentsEnabled()) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-slate-700">
        <h1 className="text-lg font-semibold text-slate-900">Payments</h1>
        <p className="mt-2">RevenueOS payments are disabled for this deployment (<code className="rounded bg-slate-100 px-1">FI_PAYMENTS_ENABLED</code>).</p>
      </div>
    );
  }

  const sp = (await searchParams) ?? {};
  const filters = parseFilters(sp);
  const cal = await loadTenantOperationalCalendarSettings(tid);
  const todayYmd = calendarDateStringFromInstant(new Date(), cal.calendarTimezone);
  const snap = await loadPaymentsInboxSnapshot(tid, filters, todayYmd);

  const baseHref = `/fi-admin/${tid}/payments`;

  function RowList(props: { rows: typeof snap.overdue }) {
    if (!props.rows.length) {
      return (
        <p className="text-xs text-slate-500" aria-live="polite">
          None.
        </p>
      );
    }
    return (
      <ul className="divide-y divide-slate-100 rounded border border-slate-200 text-xs">
        {props.rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-2 py-2">
            <div>
              <p className="font-medium text-slate-900">{r.title ?? r.invoice_kind}</p>
              <p className="text-slate-600">
                {r.invoice_kind} · {r.status}
                {r.case_id ? " · case-linked" : ""}
                {r.patient_label ? ` · ${r.patient_label}` : ""}
              </p>
              {r.due_date ? <p className="text-slate-500">Due {r.due_date}</p> : null}
            </div>
            <div className="text-right font-semibold text-slate-900">{formatMoney(r.balance_due_cents, r.currency)}</div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 text-slate-900">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">RevenueOS</p>
        <h1 className="text-xl font-semibold">Payments inbox</h1>
        <p className="text-sm text-slate-600">Operational view for clinic staff — today in tenant calendar: {todayYmd}.</p>
        <p className="text-sm">
          <Link href={`/fi-admin/${tid}/settings/payments`} className="text-blue-600 hover:underline">
            Settings → Payments
          </Link>
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
        <form className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" method="get" action={baseHref}>
          <label className="text-xs text-slate-600">
            Clinic
            <select name="clinic" className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" defaultValue={filters.clinicId ?? ""}>
              <option value="">All clinics</option>
              {snap.clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Patient search
            <input
              name="patient"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="Name contains…"
              defaultValue={filters.patientQuery ?? ""}
            />
          </label>
          <label className="text-xs text-slate-600">
            Invoice status (comma-separated)
            <input
              name="status"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="issued,partially_paid"
              defaultValue={filters.invoiceStatuses?.join(",") ?? ""}
            />
          </label>
          <label className="text-xs text-slate-600">
            Due from
            <input name="due_from" type="date" className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" defaultValue={filters.dueFrom ?? ""} />
          </label>
          <label className="text-xs text-slate-600">
            Due to
            <input name="due_to" type="date" className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" defaultValue={filters.dueTo ?? ""} />
          </label>
          <label className="flex items-end gap-2 text-xs text-slate-600">
            <span className="flex items-center gap-2 pb-2">
              <input type="checkbox" name="case" value="1" defaultChecked={filters.caseLinkedOnly} />
              Case-linked only
            </span>
          </label>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
            <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
              Apply filters
            </button>
            <Link href={baseHref} className="text-sm text-blue-600 hover:underline">
              Clear
            </Link>
          </div>
        </form>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold text-slate-900">Overdue invoices</h2>
          <div className="mt-2">
            <RowList rows={snap.overdue} />
          </div>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-slate-900">Unpaid issued invoices</h2>
          <div className="mt-2">
            <RowList rows={snap.unpaidIssued} />
          </div>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-slate-900">Partially paid invoices</h2>
          <div className="mt-2">
            <RowList rows={snap.partiallyPaid} />
          </div>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-slate-900">Failed payment requests (Stripe checkout)</h2>
          <div className="mt-2">
            {!snap.failedPaymentRequests.length ? (
              <p className="text-xs text-slate-500">None.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded border border-slate-200 text-xs">
                {snap.failedPaymentRequests.map((p) => (
                  <li key={p.id} className="px-2 py-2">
                    <p className="font-medium text-slate-900">{p.invoice_title ?? "Invoice"}</p>
                    <p className="text-slate-600">
                      {p.status} · {formatMoney(p.total_cents, p.currency)}
                    </p>
                    {p.failure_at ? <p className="text-slate-500">Failed {p.failure_at.slice(0, 19)}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-slate-900">Payments received today</h2>
          <div className="mt-2">
            {!snap.paymentsToday.length ? (
              <p className="text-xs text-slate-500">None.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded border border-slate-200 text-xs">
                {snap.paymentsToday.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 px-2 py-2">
                    <span className="text-slate-600">{p.created_at.slice(0, 19)}</span>
                    <span className="font-semibold">{formatMoney(p.total_cents, p.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <section className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Payments received this week (from {snap.weekStartYmd})</h2>
          <div className="mt-2">
            {!snap.paymentsThisWeek.length ? (
              <p className="text-xs text-slate-500">None.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded border border-slate-200 text-xs">
                {snap.paymentsThisWeek.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 px-2 py-2">
                    <span className="text-slate-600">{p.created_at.slice(0, 19)}</span>
                    <span className="font-semibold">{formatMoney(p.total_cents, p.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
