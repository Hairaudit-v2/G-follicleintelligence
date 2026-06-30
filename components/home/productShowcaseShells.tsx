import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { HomeProductShowcaseShell } from "@/lib/marketing/homePageContent";

const shellBase =
  "relative h-full min-h-[168px] w-full overflow-hidden rounded-b-[10px] bg-[linear-gradient(145deg,rgb(8_12_20)_0%,rgb(5_8_14)_55%,rgb(4_7_12)_100%)] sm:min-h-[188px]";

function ShellChrome({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(shellBase, className)}>{children}</div>;
}

function FakeSidebar({ narrow }: { narrow?: boolean }) {
  return (
    <div
      className={cn(
        "shrink-0 border-r border-white/[0.06] bg-[rgb(6_9_15_/0.92)]",
        narrow ? "w-[18%] max-w-[3.25rem]" : "w-[22%] max-w-[4.5rem]"
      )}
      aria-hidden
    >
      <div className="flex flex-col gap-1.5 p-2">
        <div className="h-2 w-full rounded bg-white/[0.07]" />
        <div className="h-2 w-[72%] rounded bg-white/[0.05]" />
        <div className="mt-2 h-2 w-full rounded bg-amber-400/18" />
        <div className="h-2 w-[55%] rounded bg-white/[0.05]" />
        <div className="h-2 w-full rounded bg-white/[0.05]" />
        <div className="h-2 w-[80%] rounded bg-white/[0.05]" />
      </div>
    </div>
  );
}

function TopBar({ title }: { title: string }) {
  return (
    <div
      className="flex items-center justify-between border-b border-white/[0.06] bg-[rgb(7_10_16_/0.95)] px-2 py-1.5 sm:px-2.5"
      aria-hidden
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate font-mono text-[7px] font-medium uppercase tracking-[0.14em] text-amber-200/55 sm:text-[8px]">
          {title}
        </span>
      </div>
      <div className="flex gap-1">
        <span className="h-1.5 w-6 rounded-full bg-white/[0.06]" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/25" />
      </div>
    </div>
  );
}

export function ProductShowcaseShell({ variant }: { variant: HomeProductShowcaseShell }) {
  switch (variant) {
    case "clinic-calendar":
      return (
        <ShellChrome>
          <TopBar title="ClinicOS · Schedule & staff" />
          <div className="flex h-[calc(100%-1.75rem)]">
            <FakeSidebar />
            <div className="flex min-w-0 flex-1 flex-col p-2 sm:p-2.5">
              <div className="flex gap-1">
                {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
                  <div
                    key={d}
                    className="flex-1 text-center font-mono text-[6px] font-semibold uppercase tracking-wider text-white/35 sm:text-[7px]"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="mt-2 grid flex-1 grid-cols-5 gap-1">
                {Array.from({ length: 15 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded border border-white/[0.05] bg-white/[0.02]",
                      i === 7 &&
                        "border-amber-400/35 bg-amber-400/[0.12] shadow-[inset_0_0_0_1px_rgb(212_175_55_/0.12)]",
                      i === 11 && "border-white/[0.08] bg-white/[0.04]"
                    )}
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="h-1.5 flex-1 rounded-full bg-white/[0.05]" />
                <span className="font-mono text-[5px] font-semibold uppercase tracking-wider text-emerald-400/45 sm:text-[6px]">
                  3 on
                </span>
                <span className="h-1.5 w-8 rounded-full bg-amber-400/25" />
              </div>
            </div>
          </div>
        </ShellChrome>
      );

    case "crm-pipeline":
      return (
        <ShellChrome>
          <TopBar title="LeadFlowOS · Pipeline & tasks" />
          <div className="flex h-[calc(100%-1.75rem)] flex-col gap-1.5 p-2 sm:p-2.5">
            <div className="flex gap-1">
              {["Follow-up", "Call", "Email"].map((t, ti) => (
                <span
                  key={t}
                  className={cn(
                    "rounded border px-1 py-0.5 font-mono text-[5px] font-semibold uppercase tracking-wider sm:text-[6px]",
                    ti === 0
                      ? "border-amber-400/25 bg-amber-400/10 text-amber-100/80"
                      : "border-white/[0.06] bg-white/[0.03] text-white/40"
                  )}
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="flex min-h-0 flex-1 gap-1.5 sm:gap-2">
              {[
                { label: "New", n: 4, hot: 1 },
                { label: "Qualified", n: 3, hot: 0 },
                { label: "Booked", n: 2, hot: 1 },
              ].map((col) => (
                <div
                  key={col.label}
                  className="flex min-w-0 flex-1 flex-col rounded-lg border border-white/[0.06] bg-white/[0.02] p-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[6px] font-semibold uppercase tracking-wider text-white/45 sm:text-[7px]">
                      {col.label}
                    </span>
                    <span className="rounded bg-white/[0.06] px-1 py-px font-mono text-[6px] text-white/55">
                      {col.n}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-1 flex-col gap-1">
                    {Array.from({ length: col.n }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "rounded border border-white/[0.05] bg-[rgb(8_11_18_/0.9)] p-1.5",
                          col.hot === i && "border-amber-400/30 bg-amber-400/[0.08]"
                        )}
                      >
                        <div className="h-1 w-[55%] rounded bg-white/[0.12]" />
                        <div className="mt-1 h-0.5 w-[35%] rounded bg-white/[0.06]" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ShellChrome>
      );

    case "patient-twin":
      return (
        <ShellChrome>
          <TopBar title="PatientOS / FoundationOS · Twin" />
          <div className="flex h-[calc(100%-1.75rem)]">
            <FakeSidebar narrow />
            <div className="flex min-w-0 flex-1 flex-col gap-2 p-2 sm:p-2.5">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 shrink-0 rounded-full border border-amber-400/25 bg-gradient-to-br from-amber-200/25 to-amber-900/20 shadow-[0_0_24px_rgb(212_175_55_/0.12)]" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="h-1.5 w-[40%] max-w-[7rem] rounded bg-white/[0.12]" />
                  <div className="h-1 w-[28%] max-w-[5rem] rounded bg-white/[0.06]" />
                </div>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-1.5">
                {["Timeline", "Imaging", "Labs", "Meds"].map((label) => (
                  <div
                    key={label}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-1.5"
                  >
                    <p className="font-mono text-[6px] font-semibold uppercase tracking-wider text-amber-200/45 sm:text-[7px]">
                      {label}
                    </p>
                    <div className="mt-1.5 space-y-1">
                      <div className="h-0.5 w-full rounded bg-white/[0.06]" />
                      <div className="h-0.5 w-[72%] rounded bg-white/[0.05]" />
                      <div className="h-0.5 w-[55%] rounded bg-white/[0.04]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ShellChrome>
      );

    case "consultation-workflow":
      return (
        <ShellChrome>
          <TopBar title="ConsultationOS · Assessment" />
          <div className="flex h-[calc(100%-1.75rem)] gap-2 p-2 sm:p-2.5">
            <div className="flex w-[38%] max-w-[7.5rem] flex-col gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1.5">
              {["Intake", "Exam", "Plan", "Quote"].map((step, i) => (
                <div
                  key={step}
                  className={cn(
                    "flex items-center gap-1 rounded border px-1 py-1",
                    i <= 1
                      ? "border-amber-400/28 bg-amber-400/[0.08]"
                      : "border-white/[0.05] bg-transparent"
                  )}
                >
                  <span className="font-mono text-[6px] font-bold text-white/35">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-mono text-[6px] font-semibold uppercase tracking-wider text-white/55 sm:text-[7px]">
                    {step}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg border border-white/[0.06] bg-[rgb(7_10_16_/0.65)] p-2">
              <div className="h-1 w-[48%] rounded bg-white/[0.12]" />
              {[
                { done: true, w: 92 },
                { done: true, w: 78 },
                { done: false, w: 65 },
                { done: false, w: 55 },
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded border text-[5px] font-bold leading-none",
                      row.done
                        ? "border-amber-400/35 bg-amber-400/15 text-amber-100/90"
                        : "border-white/[0.08] bg-white/[0.03] text-white/25"
                    )}
                    aria-hidden
                  >
                    {row.done ? "✓" : ""}
                  </span>
                  <div className="h-0.5 rounded bg-white/[0.06]" style={{ width: `${row.w}%` }} />
                </div>
              ))}
              <div className="mt-auto flex gap-1">
                <span className="h-2 flex-1 rounded border border-white/[0.08] bg-white/[0.03]" />
                <span className="h-2 w-8 rounded bg-amber-400/22" />
              </div>
            </div>
          </div>
        </ShellChrome>
      );

    case "surgical-planning":
      return (
        <ShellChrome>
          <TopBar title="SurgeryOS · Planning & grafts" />
          <div className="flex h-[calc(100%-1.75rem)] flex-col gap-2 p-2 sm:p-2.5">
            <div className="grid flex-1 grid-cols-[1fr_1.15fr] gap-2">
              <div className="rounded-lg border border-dashed border-white/[0.1] bg-[radial-gradient(ellipse_at_50%_45%,rgb(212_175_55_/0.08),transparent_62%)] p-2">
                <div className="mx-auto mt-1 h-12 w-12 rounded-full border border-amber-400/20 bg-white/[0.03] shadow-[inset_0_0_0_1px_rgb(255_255_255_/0.04)]" />
                <div className="mt-2 flex justify-center gap-1">
                  <span className="h-1 w-6 rounded-full bg-white/[0.06]" />
                  <span className="h-1 w-6 rounded-full bg-amber-400/22" />
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-0.5">
                  {Array.from({ length: 12 }).map((_, gi) => (
                    <span
                      key={gi}
                      className={cn(
                        "h-1 w-1 rounded-[1px]",
                        gi % 4 === 0 ? "bg-amber-300/35" : "bg-white/[0.08]"
                      )}
                      aria-hidden
                    />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
                {["Grafts", "Density", "Donor", "OR day"].map((label) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded border border-white/[0.05] bg-[rgb(8_11_18_/0.85)] px-1.5 py-1"
                  >
                    <span className="font-mono text-[6px] font-semibold uppercase tracking-wider text-white/40 sm:text-[7px]">
                      {label}
                    </span>
                    <span className="h-1 w-8 rounded bg-white/[0.1]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ShellChrome>
      );

    case "audit-report":
      return (
        <ShellChrome>
          <TopBar title="AuditOS · Review packet" />
          <div className="flex h-[calc(100%-1.75rem)] flex-col gap-2 p-2 sm:p-2.5">
            <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
              <div className="space-y-1">
                <div className="h-1 w-20 rounded bg-white/[0.1]" />
                <div className="h-0.5 w-14 rounded bg-white/[0.06]" />
              </div>
              <div className="flex gap-1">
                <span className="rounded border border-emerald-400/25 bg-emerald-400/10 px-1 py-px font-mono text-[6px] font-semibold uppercase tracking-wider text-emerald-200/80">
                  Pass
                </span>
                <span className="rounded border border-amber-400/25 bg-amber-400/10 px-1 py-px font-mono text-[6px] font-semibold uppercase tracking-wider text-amber-100/85">
                  92
                </span>
              </div>
            </div>
            <div className="grid flex-1 grid-cols-3 gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded border border-white/[0.05] bg-white/[0.02] p-1">
                  <div className="aspect-[4/3] rounded bg-gradient-to-br from-white/[0.06] to-transparent" />
                  <div className="mt-1 h-0.5 w-[70%] rounded bg-white/[0.06]" />
                </div>
              ))}
            </div>
          </div>
        </ShellChrome>
      );

    case "metrics-dashboard":
      return (
        <ShellChrome>
          <TopBar title="AnalyticsOS · Revenue & outcomes" />
          <div className="flex h-[calc(100%-1.75rem)] flex-col gap-2 p-2 sm:p-2.5">
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {[
                { k: "Rev", accent: true },
                { k: "Conv", accent: false },
                { k: "Prod", accent: false },
                { k: "Outcomes", accent: true },
              ].map(({ k, accent }) => (
                <div
                  key={k}
                  className={cn(
                    "rounded-lg border p-1.5",
                    accent
                      ? "border-amber-400/18 bg-amber-400/[0.06]"
                      : "border-white/[0.06] bg-white/[0.03]"
                  )}
                >
                  <p className="font-mono text-[6px] font-semibold uppercase tracking-wider text-white/40 sm:text-[7px]">
                    {k}
                  </p>
                  <div className="mt-1 h-2 w-[55%] rounded bg-amber-400/25" />
                  <div className="mt-1 h-0.5 w-[40%] rounded bg-emerald-400/15" />
                </div>
              ))}
            </div>
            <div className="flex flex-1 items-end gap-0.5 rounded-lg border border-white/[0.06] bg-[rgb(7_10_16_/0.55)] p-2 pt-3">
              {[40, 65, 48, 78, 55, 88, 62, 92, 70, 84, 58, 95].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-t from-amber-400/15 to-amber-200/35"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </ShellChrome>
      );

    case "academy-learning":
      return (
        <ShellChrome>
          <TopBar title="AcademyOS · Certification" />
          <div className="flex h-[calc(100%-1.75rem)] flex-col gap-1.5 p-2 sm:p-2.5">
            {[
              { title: "Doctor track", pct: 72 },
              { title: "Technician CPD", pct: 45 },
              { title: "Competency review", pct: 88 },
            ].map((row) => (
              <div
                key={row.title}
                className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-1.5 sm:p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-mono text-[6px] font-semibold uppercase tracking-wider text-white/55 sm:text-[7px]">
                    {row.title}
                  </p>
                  <span className="shrink-0 font-mono text-[7px] font-bold tabular-nums text-amber-200/75 sm:text-[8px]">
                    {row.pct}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500/35 to-amber-200/55 shadow-[0_0_12px_rgb(212_175_55_/0.25)]"
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="mt-auto grid grid-cols-3 gap-1">
              {["Gate", "Badge", "Log"].map((label) => (
                <div
                  key={label}
                  className="rounded border border-white/[0.05] bg-[rgb(8_11_18_/0.85)] px-1 py-1.5 text-center"
                >
                  <span className="font-mono text-[5px] font-semibold uppercase tracking-wider text-white/35 sm:text-[6px]">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ShellChrome>
      );

    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}
