"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { useAppointmentSlideOverOptional } from "@/src/components/fi/appointments/AppointmentSlideOver";
import { crmLeadCardClass } from "@/src/components/fi/crm/shared/crmSharedStyles";
import { isBookingCancelled } from "@/src/lib/bookings/bookingPolicy";
import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import {
  CASE_DETAIL_SECTION_IDS,
  caseDetailSectionHeadingId,
} from "@/src/lib/cases/caseDetailNavConstants";

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function isCompletedLike(b: FiBookingRow): boolean {
  const s = b.booking_status.trim();
  return s === "completed" || s === "no_show";
}

function isUpcoming(b: FiBookingRow, nowMs: number): boolean {
  if (isBookingCancelled(b)) return false;
  if (isCompletedLike(b)) return false;
  const t = Date.parse(b.start_at);
  return Number.isFinite(t) && t >= nowMs;
}

function isPrpFamily(bt: string): boolean {
  const t = bt.trim().toLowerCase();
  return t === "prp" || t === "prf" || t === "mesotherapy" || t === "exosomes";
}

function isFollowUpFamily(bt: string): boolean {
  const t = bt.trim().toLowerCase();
  return t === "follow_up" || t === "review";
}

function BookingLine({
  tenantId,
  b,
  slide,
}: {
  tenantId: string;
  b: FiBookingRow;
  slide: ReturnType<typeof useAppointmentSlideOverOptional>;
}) {
  const title = b.title?.trim() || bookingTypeLabel(b.booking_type);
  const href = `/fi-admin/${tenantId}/appointments/${b.id}`;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        {slide ? (
          <button
            type="button"
            className="font-medium text-blue-300 hover:underline"
            onClick={() => slide.openAppointment(b.id)}
          >
            {title}
          </button>
        ) : (
          <Link href={href} className="font-medium text-blue-300 hover:underline">
            {title}
          </Link>
        )}
        <span className="ml-2 text-xs text-gray-500">
          {bookingTypeLabel(b.booking_type)} · {b.booking_status}
        </span>
      </div>
      <div className="whitespace-nowrap text-xs text-slate-400">{fmt(b.start_at)}</div>
    </li>
  );
}

function Section({
  title,
  rows,
  tenantId,
  slide,
  empty,
}: {
  title: string;
  rows: FiBookingRow[];
  tenantId: string;
  slide: ReturnType<typeof useAppointmentSlideOverOptional>;
  empty: string;
}) {
  if (rows.length === 0) return <p className="mt-2 text-sm text-gray-500">{empty}</p>;
  return (
    <div className="mt-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      <ul className="mt-1 divide-y divide-white/[0.06] text-sm">
        {rows.map((b) => (
          <BookingLine key={b.id} tenantId={tenantId} b={b} slide={slide} />
        ))}
      </ul>
    </div>
  );
}

export function CaseAppointmentsCard({
  tenantId,
  caseId,
  bookings,
  prefillPersonId,
  prefillPatientId,
  prefillLeadId,
  prefillClinicId,
}: {
  tenantId: string;
  caseId: string;
  bookings: FiBookingRow[];
  prefillPersonId: string | null;
  prefillPatientId: string | null;
  prefillLeadId: string | null;
  prefillClinicId: string | null;
}) {
  const slide = useAppointmentSlideOverOptional();
  const [cancelledOpen, setCancelledOpen] = useState(false);

  const { next, surgery, prp, followUp, completed, cancelled } = useMemo(() => {
    const nowMs = Date.now();
    const cancelledRows = bookings.filter(isBookingCancelled);
    const nonCancelled = bookings.filter((b) => !isBookingCancelled(b));
    const upcoming = nonCancelled
      .filter((b) => isUpcoming(b, nowMs))
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
    const nextAppt = upcoming[0] ?? null;
    const activeForCategories = nonCancelled.filter((b) => !isCompletedLike(b));
    const surgeryRows = activeForCategories.filter(
      (b) => b.booking_type.trim().toLowerCase() === "surgery"
    );
    const prpRows = activeForCategories.filter((b) => isPrpFamily(b.booking_type));
    const followRows = activeForCategories.filter((b) => isFollowUpFamily(b.booking_type));
    const completedRows = nonCancelled
      .filter((b) => isCompletedLike(b))
      .sort((a, b) => b.start_at.localeCompare(a.start_at));
    return {
      next: nextAppt,
      surgery: surgeryRows,
      prp: prpRows,
      followUp: followRows,
      completed: completedRows,
      cancelled: cancelledRows.sort((a, b) => b.start_at.localeCompare(a.start_at)),
    };
  }, [bookings]);

  return (
    <div className={crmLeadCardClass}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2
          id={caseDetailSectionHeadingId(CASE_DETAIL_SECTION_IDS.bookings)}
          className="text-sm font-semibold text-slate-100"
        >
          Case appointments
        </h2>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <Link
            href={`/fi-admin/${tenantId}/appointments`}
            className="text-blue-300 hover:underline"
          >
            Appointments
          </Link>
          <span className="text-gray-300">·</span>
          <Link href={`/fi-admin/${tenantId}/calendar`} className="text-blue-300 hover:underline">
            Calendar
          </Link>
        </div>
      </div>

      <p className="mt-1 text-xs text-gray-500">
        Anchored on{" "}
        <code className="rounded bg-white/[0.06] px-1 font-mono text-[10px]">
          fi_bookings.case_id
        </code>{" "}
        for this case
        {prefillPatientId ? "; patient bookings are merged for scheduling overlap checks." : "."}
      </p>

      {slide ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() =>
              slide.openCreateAppointment({
                caseId,
                patientId: prefillPatientId,
                personId: prefillPersonId,
                leadId: prefillLeadId,
                clinicId: prefillClinicId,
                bookingType: "consultation",
              })
            }
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            New appointment for this case
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-amber-300">
          Sign in with booking permissions to create or edit appointments from this page.
        </p>
      )}

      {next ? (
        <div className="mt-4 rounded-md border border-cyan-500/20 bg-cyan-500/10 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
            Next appointment
          </h3>
          <ul className="mt-1 text-sm">
            <BookingLine tenantId={tenantId} b={next} slide={slide} />
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400">
          No upcoming appointments for this case. Use &quot;New appointment for this case&quot; when
          you have booking access, or open{" "}
          <Link href={`/fi-admin/${tenantId}/calendar`} className="text-blue-300 hover:underline">
            Calendar
          </Link>
          .
        </p>
      )}

      <Section
        title="Surgery"
        rows={surgery}
        tenantId={tenantId}
        slide={slide}
        empty="No surgery bookings on this case."
      />
      <Section
        title="PRP & related"
        rows={prp}
        tenantId={tenantId}
        slide={slide}
        empty="No PRP / PRF / mesotherapy / exosomes bookings on this case."
      />
      <Section
        title="Follow-up & review"
        rows={followUp}
        tenantId={tenantId}
        slide={slide}
        empty="No follow-up or review bookings on this case."
      />
      <Section
        title="Completed"
        rows={completed}
        tenantId={tenantId}
        slide={slide}
        empty="No completed appointments on this case."
      />

      <div className="mt-4">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-white/[0.06]"
          aria-expanded={cancelledOpen}
          onClick={() => setCancelledOpen((o) => !o)}
        >
          <span>Cancelled ({cancelled.length})</span>
          <span className="text-gray-500">{cancelledOpen ? "▾" : "▸"}</span>
        </button>
        {cancelledOpen ? (
          cancelled.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No cancelled appointments.</p>
          ) : (
            <ul className="mt-2 divide-y divide-white/[0.06] text-sm">
              {cancelled.map((b) => (
                <BookingLine key={b.id} tenantId={tenantId} b={b} slide={slide} />
              ))}
            </ul>
          )
        ) : null}
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Open an appointment to reschedule, cancel, or mark complete using the slide-over (same
        actions as Appointments).
      </p>
    </div>
  );
}
