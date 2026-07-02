"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type ArrivalState = "idle" | "submitting" | "success" | "error";

export default function BookingArrivalClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [state, setState] = useState<ArrivalState>("idle");
  const [message, setMessage] = useState("");

  const submit = useCallback(async () => {
    if (!token) {
      setState("error");
      setMessage("This arrival link is missing or invalid.");
      return;
    }
    setState("submitting");
    try {
      const res = await fetch("/api/public/booking-arrival", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setState("error");
        setMessage(json.error ?? "Unable to record your arrival.");
        return;
      }
      setState("success");
      setMessage("Thanks — we've let the clinic know you're here. Please wait to be called.");
    } catch {
      setState("error");
      setMessage("Something went wrong. Please speak with reception.");
    }
  }, [token]);

  useEffect(() => {
    if (token && state === "idle") void submit();
  }, [token, state, submit]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Clinic arrival</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">I&apos;m here</h1>
        {state === "submitting" ? (
          <p className="mt-4 text-sm text-slate-600">Letting the clinic know…</p>
        ) : null}
        {state === "success" ? (
          <p className="mt-4 text-sm text-emerald-800">{message}</p>
        ) : null}
        {state === "error" ? (
          <>
            <p className="mt-4 text-sm text-red-700">{message}</p>
            {token ? (
              <button
                type="button"
                onClick={() => {
                  setState("idle");
                  void submit();
                }}
                className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                Try again
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
