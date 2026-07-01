"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { staffPinLogoutAction } from "@/lib/actions/fi-staff-pin-actions";
import {
  staffPinEndBreakAction,
  staffPinStartBreakAction,
} from "@/src/lib/actions/staff-time-clock-actions";
import type { StaffPinLoginPageData } from "@/src/lib/staffPin/staffPinLoginLoader.server";

type KioskSession = {
  staffName: string;
  hasOpenPunch: boolean;
  onBreak: boolean;
  clockInAt: string | null;
};

export function StaffTimeClockKioskClient({
  data,
  session,
  breaksEnabled,
}: {
  data: StaffPinLoginPageData;
  session: KioskSession | null;
  breaksEnabled: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [staffId, setStaffId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredStaff = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.staff;
    return data.staff.filter(
      (s) => s.fullName.toLowerCase().includes(q) || s.staffRole.toLowerCase().includes(q)
    );
  }, [data.staff, query]);

  const selected = data.staff.find((s) => s.id === staffId) ?? null;

  const clockIn = () => {
    setError(null);
    if (!staffId || pin.length !== 4) {
      setError("Select staff and enter 4-digit PIN.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/fi-staff-pin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: data.tenantId,
          staffId,
          pin,
          mode: "kiosk",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        redirectTo?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Invalid credentials.");
        setPin("");
        return;
      }
      router.push(json.redirectTo ?? `/fi-admin/${data.tenantId}/staff-time-clock`);
      router.refresh();
    });
  };

  const clockOut = () => {
    startTransition(async () => {
      const res = await staffPinLogoutAction(data.tenantId);
      if (res.ok) router.refresh();
    });
  };

  if (session) {
    return (
      <div className="mx-auto flex min-h-[80vh] w-full max-w-lg flex-col justify-center px-4 py-10">
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/80 p-8 text-center shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/90">
            Time clock
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">{session.staffName}</h1>
          <p className="mt-3 text-sm text-slate-300">
            {session.hasOpenPunch
              ? session.onBreak
                ? "You are on break."
                : `Clocked in${session.clockInAt ? ` at ${new Date(session.clockInAt).toLocaleTimeString()}` : ""}.`
              : "No open punch for today."}
          </p>
          <div className="mt-8 flex flex-col gap-3">
            {breaksEnabled ? (
              session.onBreak ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={pending}
                  onClick={() => {
                    void staffPinEndBreakAction(data.tenantId).then(() => router.refresh());
                  }}
                >
                  End break
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={pending}
                  onClick={() => {
                    void staffPinStartBreakAction(data.tenantId).then(() => router.refresh());
                  }}
                >
                  Start break
                </Button>
              )
            ) : null}
            <Button type="button" className="w-full" disabled={pending} onClick={clockOut}>
              Clock out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-lg flex-col justify-center px-4 py-10">
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/80 p-6 shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/90">
          Clinic time clock
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Clock in</h1>
        <p className="mt-2 text-sm text-slate-300">
          {data.clinicName ? `${data.clinicName} — ` : ""}
          Select your name and PIN to start your shift.
        </p>
        {data.staff.length === 0 ? (
          <p className="mt-6 text-sm text-amber-100">No staff with PIN access configured.</p>
        ) : (
          <div className="mt-6 space-y-4">
            <input
              className="block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or role"
            />
            <select
              className="block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
            >
              <option value="">— Select staff —</option>
              {filteredStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.staffRole})
                </option>
              ))}
            </select>
            {selected ? (
              <input
                inputMode="numeric"
                maxLength={4}
                autoComplete="off"
                className="block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-center text-lg tracking-[0.5em] text-white"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
              />
            ) : null}
            {error ? <p className="text-sm text-red-200">{error}</p> : null}
            <Button
              type="button"
              className="w-full"
              disabled={pending || !staffId || pin.length !== 4}
              onClick={clockIn}
            >
              {pending ? "Clocking in…" : "Clock in"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}