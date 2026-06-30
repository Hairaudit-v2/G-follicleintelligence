"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import {
  applyClinicSetupWizardAction,
  loadClinicSetupWizardBootstrapAction,
  previewClinicSetupWizardAction,
} from "@/lib/actions/fi-clinic-setup-wizard-actions";
import { ClinicBookingSetupTestPanel } from "@/src/components/fi-admin/settings/ClinicBookingSetupTestPanel";
import {
  buildDefaultEvolvedPerthCounts,
  type ClinicSetupRoomCounts,
  type ClinicSetupWizardPreviewPayload,
  type WizardServiceCategory,
} from "@/src/lib/clinicSetup/clinicSetupWizardCore";
import {
  isCalendarVisibleClinicalStaff,
  isNonCalendarSupportRole,
} from "@/src/lib/staff/calendarVisibleStaff";

const inputClass =
  "w-full rounded-lg border border-white/[0.1] bg-[#081020]/85 px-2 py-1.5 text-sm text-[#F8FAFC] shadow-inner outline-none transition placeholder:text-[#475569] focus:border-[#22C1FF]/45 focus:ring-2 focus:ring-[#22C1FF]/20";

const sectionClass =
  "rounded-2xl border border-white/[0.08] bg-[#0F1629]/75 p-4 shadow-lg shadow-black/25 backdrop-blur-md sm:p-5";

type ClinicOption = { id: string; displayName: string };

type StaffRowState = {
  staffId: string;
  fullName: string;
  staffRole: string | null;
  performsConsultations: boolean;
  performsPrp: boolean;
  performsSurgery: boolean;
  assistsSurgery: boolean;
  showOnCalendar: boolean;
};

function defaultStaffRowState(s: {
  id: string;
  full_name: string;
  staff_role: string | null;
  calendar_visible: boolean | null;
}): StaffRowState {
  const role = String(s.staff_role ?? "")
    .trim()
    .toLowerCase();
  const performsConsultations =
    /\b(doctor|physician|consult|trich|surgeon|gp|dermatologist)\b/.test(role) ||
    role.includes("consultant") ||
    role.includes("trichologist");
  const performsPrp =
    /\b(nurse|technician|doctor|physician)\b/.test(role) ||
    role.includes("technician") ||
    role.includes("nurse");
  const performsSurgery = role.includes("surgeon") || role.includes("doctor");
  const assistsSurgery =
    /\b(nurse|technician|assistant)\b/.test(role) ||
    role.includes("clinical_assistant") ||
    role.includes("assistant");
  const showOnCalendar =
    s.calendar_visible === true
      ? true
      : s.calendar_visible === false
        ? false
        : isCalendarVisibleClinicalStaff({
            is_active: true,
            staff_role: s.staff_role,
            calendar_visible: null,
          });

  return {
    staffId: s.id,
    fullName: s.full_name,
    staffRole: s.staff_role,
    performsConsultations,
    performsPrp,
    performsSurgery,
    assistsSurgery,
    showOnCalendar,
  };
}

function categoryLabel(c: WizardServiceCategory): string {
  switch (c) {
    case "consult_strict":
      return "Consultation / trichology";
    case "consult_loose":
      return "Follow-up / review";
    case "regenerative":
      return "PRP / exosomes / mesotherapy";
    case "surgery":
      return "Surgery / transplant";
    case "block":
      return "Block time / holds";
    default:
      return c;
  }
}

export function ClinicSetupWizard({
  tenantId,
  clinics,
}: {
  tenantId: string;
  clinics: ClinicOption[];
}) {
  const tid = tenantId.trim();
  const [clinicId, setClinicId] = useState(clinics[0]?.id ?? "");
  const [step, setStep] = useState(1);
  const [counts, setCounts] = useState<ClinicSetupRoomCounts>({
    consult: 1,
    surgery: 1,
    prp: 1,
    patient: 1,
  });
  const [useStandardSecondRoomAliases, setUseStandardSecondRoomAliases] = useState(false);
  const [staffRows, setStaffRows] = useState<StaffRowState[]>([]);
  const [preview, setPreview] = useState<
    { ok: true; preview: ClinicSetupWizardPreviewPayload } | { ok: false; error: string } | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loadBootstrap = useCallback(async () => {
    const cid = clinicId.trim();
    if (!cid) return;
    setError(null);
    const r = await loadClinicSetupWizardBootstrapAction(tid, cid);
    if (!r.ok) {
      setError(r.error);
      setStaffRows([]);
      return;
    }
    setStaffRows(r.data.staff.map((s) => defaultStaffRowState(s)));
  }, [clinicId, tid]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  const base = `/fi-admin/${tid}`;

  const applyEvolvedPerthDefaults = () => {
    setCounts(buildDefaultEvolvedPerthCounts());
    setUseStandardSecondRoomAliases(true);
  };

  const runPreview = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const r = await previewClinicSetupWizardAction(tid, {
        clinicId: clinicId.trim(),
        counts,
        useStandardSecondRoomAliases,
      });
      if (!r.ok) {
        setError(r.error);
        setPreview(null);
        return;
      }
      setPreview(r);
    });
  };

  const runApply = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const r = await applyClinicSetupWizardAction(tid, {
        clinicId: clinicId.trim(),
        counts,
        useStandardSecondRoomAliases,
        staff: staffRows.map((s) => ({
          staffId: s.staffId,
          performsConsultations: s.performsConsultations,
          performsPrp: s.performsPrp,
          performsSurgery: s.performsSurgery,
          assistsSurgery: s.assistsSurgery,
          showOnCalendar: s.showOnCalendar,
        })),
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const w = r.result.warnings.length ? ` ${r.result.warnings.join(" ")}` : "";
      setSuccess(
        `Clinic scheduling is ready. You can now book by staff, room, or clinic. Rooms created: ${r.result.roomsCreated}, updated: ${r.result.roomsUpdated}.${w}`
      );
      void loadBootstrap();
      const pr = await previewClinicSetupWizardAction(tid, {
        clinicId: clinicId.trim(),
        counts,
        useStandardSecondRoomAliases,
      });
      setPreview(pr.ok ? pr : null);
    });
  };

  const previewBody = preview?.ok ? preview.preview : null;

  const aliasNote = useMemo(() => {
    if (!useStandardSecondRoomAliases) return null;
    const c = counts;
    if (c.consult >= 2 && c.patient >= 2 && c.prp >= 2 && c.surgery >= 2) {
      return "Consult Room 2 and Patient Room 2 share one physical space; PRP Room 2 and Surgery Room 2 share one physical space (no overlap bookings across those pairs).";
    }
    return "Turn on standard pairing only when you have at least two of each room type — otherwise each room keeps its own physical space.";
  }, [counts, useStandardSecondRoomAliases]);

  const completedAt = previewBody?.completedAt ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-50">Clinic setup</h1>
        <p className="mt-1 text-sm text-slate-400">
          Answer a few operational questions to configure rooms, who appears on the calendar, and
          which rooms each service may use. Technical eligibility is applied automatically.
        </p>
      </div>

      {success ? (
        <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {success}
        </div>
      ) : null}

      {completedAt && !success ? (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          Clinic scheduling is ready. You can now book by staff, room, or clinic. Last guided setup:{" "}
          {new Date(completedAt).toLocaleString()}
        </div>
      ) : null}

      <div className={sectionClass}>
        <label className="grid gap-1 text-xs font-medium text-[#CBD5E1]">
          Clinic site
          <select
            className={inputClass}
            value={clinicId}
            onChange={(e) => {
              setClinicId(e.target.value);
              setPreview(null);
            }}
          >
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-slate-400">
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={
              step === n
                ? "rounded-full bg-cyan-500/20 px-3 py-1 font-semibold text-cyan-100 ring-1 ring-cyan-400/40"
                : "rounded-full px-3 py-1"
            }
          >
            Step {n}
            {n === 1 ? " — Rooms" : n === 2 ? " — Staff" : n === 3 ? " — Services" : " — Review"}
          </span>
        ))}
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <div className={`${sectionClass} space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-50">Rooms</h2>
            <button
              type="button"
              className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-600"
              onClick={applyEvolvedPerthDefaults}
            >
              Use Evolved Perth layout (2+2+2+2)
            </button>
          </div>
          <p className="text-xs text-slate-400">
            We create labelled rooms such as “Consult Room 1”. Physical overlap between two labels
            is handled automatically when you use the standard pairing option below.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["consult", "Consultation rooms"],
                ["surgery", "Surgery rooms"],
                ["prp", "PRP / treatment rooms"],
                ["patient", "Patient / recovery rooms"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="grid gap-1 text-xs font-medium text-[#CBD5E1]">
                {label}
                <input
                  type="number"
                  min={0}
                  max={20}
                  className={inputClass}
                  value={counts[key]}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(20, Number(e.target.value) || 0));
                    setCounts((prev) => ({ ...prev, [key]: v }));
                  }}
                />
              </label>
            ))}
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              className="mt-1"
              checked={useStandardSecondRoomAliases}
              onChange={(e) => setUseStandardSecondRoomAliases(e.target.checked)}
            />
            <span>
              <span className="font-medium">Standard second-room pairing</span>
              <span className="mt-0.5 block text-xs font-normal text-slate-400">
                Recommended for two-storey consult/patient pairs and a shared PRP/surgery theatre on
                room “2”.
              </span>
            </span>
          </label>
          {aliasNote ? <p className="text-xs text-amber-100/90">{aliasNote}</p> : null}
          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
              onClick={() => setStep(2)}
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className={`${sectionClass} space-y-4`}>
          <h2 className="text-base font-semibold text-slate-50">Staff roles & calendar</h2>
          <p className="text-xs text-slate-400">
            Tick what each person does day-to-day. Reception and admin staff stay off the calendar
            unless you explicitly show them.
          </p>
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {staffRows.map((row, idx) => (
              <div
                key={row.staffId}
                className="rounded-lg border border-white/[0.06] bg-[#0a1222]/80 p-3"
              >
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-slate-100">{row.fullName}</div>
                    <div className="text-[11px] text-slate-500">
                      {row.staffRole || "Role not set"}
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 text-xs text-slate-200 sm:grid-cols-2">
                  {(
                    [
                      ["performsConsultations", "Performs consultations"],
                      ["performsPrp", "Performs PRP / exosomes"],
                      ["performsSurgery", "Performs surgery"],
                      ["assistsSurgery", "Assists surgery"],
                      ["showOnCalendar", "Show on calendar"],
                    ] as const
                  ).map(([field, label]) => (
                    <label key={field} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={row[field]}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setStaffRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, [field]: checked } : r))
                          );
                        }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            <button
              type="button"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5"
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
              onClick={() => setStep(3)}
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className={`${sectionClass} space-y-3`}>
          <h2 className="text-base font-semibold text-slate-50">Services</h2>
          <p className="text-xs text-slate-400">
            Services are matched from your catalogue (names and booking types). Consultation and
            trichology map to consultation rooms only; follow-up and review also allow patient
            recovery rooms; PRP family uses PRP rooms; surgery uses surgery rooms.
          </p>
          <ul className="list-inside list-disc space-y-1 text-xs text-slate-300">
            <li>Consultation → consultation rooms</li>
            <li>Trichology → consultation rooms</li>
            <li>Follow-up / review → consultation or patient rooms</li>
            <li>PRP, exosomes, mesotherapy → PRP rooms</li>
            <li>Surgery / FUE / DFI / hair transplant → surgery rooms</li>
          </ul>
          <div className="flex justify-between pt-2">
            <button
              type="button"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5"
              onClick={() => setStep(2)}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
              onClick={() => setStep(4)}
            >
              Continue to review
            </button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className={`${sectionClass} space-y-4`}>
          <h2 className="text-base font-semibold text-slate-50">Review &amp; apply</h2>
          <p className="text-xs text-slate-400">
            Preview refreshes the summary from your current database and the numbers above. Applying
            is idempotent: existing rooms are updated only when safe; wizard-tagged eligibility rows
            are replaced.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
              onClick={runPreview}
            >
              Preview setup
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
              onClick={runApply}
            >
              Apply setup
            </button>
            <Link
              href={`${base}/rooms`}
              className="inline-flex items-center rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
            >
              Advanced: Rooms
            </Link>
            <Link
              href={`${base}/services`}
              className="inline-flex items-center rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
            >
              Advanced: Services
            </Link>
          </div>

          {previewBody ? (
            <div className="space-y-4 text-sm text-slate-200">
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Rooms
                </h3>
                <ul className="list-inside list-disc text-xs text-slate-300">
                  {previewBody.plannedRooms.map((r) => (
                    <li key={r.room_code}>
                      {r.display_name} ({r.room_code}) — {r.room_type}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Service → rooms
                </h3>
                <ul className="space-y-1 text-xs text-slate-300">
                  {previewBody.servicePlans.map((p) => (
                    <li key={p.serviceId}>
                      <span className="font-medium text-slate-200">{p.serviceName}</span> —{" "}
                      {categoryLabel(p.category)}: {p.roomCodes.join(", ") || "—"}
                      {p.alreadyConfigured ? (
                        <span className="ml-1 text-amber-200/90">
                          (already has {p.existingActiveRoomLinks} room link(s))
                        </span>
                      ) : null}
                      {p.hasNonWizardRoomLinks ? (
                        <span className="ml-1 text-cyan-200/90">
                          (includes non-wizard / advanced mappings)
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Staff calendar
                </h3>
                <ul className="text-xs text-slate-300">
                  {staffRows.map((s) => (
                    <li key={s.staffId}>
                      {s.fullName}: calendar {s.showOnCalendar ? "visible" : "hidden"}
                      {isNonCalendarSupportRole(s.staffRole) && !s.showOnCalendar
                        ? " (reception/admin default)"
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>
              {previewBody.warnings.length ? (
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-400">
                    Warnings
                  </h3>
                  <ul className="list-inside list-disc text-xs text-amber-100">
                    {previewBody.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Run “Preview setup” to load a summary before applying.
            </p>
          )}

          {clinicId.trim() ? (
            <ClinicBookingSetupTestPanel
              tenantId={tid}
              clinicId={clinicId.trim()}
              variant="dark"
              className="mt-2"
            />
          ) : null}

          <div className="flex justify-between">
            <button
              type="button"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5"
              onClick={() => setStep(3)}
            >
              Back
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
