"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { StaffPinLoginPageData } from "@/src/lib/staffPin/staffPinLoginLoader.server";

export function StaffPinLoginClient({ data }: { data: StaffPinLoginPageData }) {
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

  const submit = () => {
    setError(null);
    if (!staffId) {
      setError("Select a staff member.");
      return;
    }
    if (pin.length !== 4) {
      setError("Enter your 4-digit PIN.");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/fi-staff-pin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: data.tenantId, staffId, pin }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        redirectTo?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Invalid credentials. Please try again.");
        setPin("");
        return;
      }
      router.push(json.redirectTo ?? `/fi-admin/${data.tenantId}/calendar`);
      router.refresh();
    });
  };

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center px-4 py-10">
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/80 p-6 shadow-xl backdrop-blur sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/90">Clinic floor access</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Staff PIN sign-in</h1>
        <p className="mt-2 text-sm text-slate-300">
          {data.clinicName ? `${data.clinicName} — ` : ""}
          Select your name and enter your 4-digit PIN for calendar and clinic-floor workflows.
        </p>

        {data.staff.length === 0 ? (
          <p className="mt-6 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            No staff with active PIN access. Ask an admin to set PINs in Staff settings.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            <label className="block text-xs font-medium text-slate-200">
              Search staff
              <input
                className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name or role"
              />
            </label>

            <label className="block text-xs font-medium text-slate-200">
              Staff member
              <select
                className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
              >
                <option value="">— Select —</option>
                {filteredStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.staffRole})
                  </option>
                ))}
              </select>
            </label>

            {selected ? (
              <label className="block text-xs font-medium text-slate-200">
                4-digit PIN
                <input
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  autoComplete="off"
                  className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-center text-lg tracking-[0.5em] text-white"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                />
              </label>
            ) : null}

            {error ? (
              <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100" role="alert">
                {error}
              </div>
            ) : null}

            <Button
              type="button"
              className="w-full"
              disabled={pending || !staffId || pin.length !== 4}
              onClick={submit}
            >
              {pending ? "Signing in…" : "Enter ClinicOS"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
