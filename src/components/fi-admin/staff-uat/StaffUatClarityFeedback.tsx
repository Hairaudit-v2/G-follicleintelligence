"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import type { StaffUatScreenKey } from "@/src/lib/fiOs/staffUatScreenGuide";
import { useStaffUat } from "./StaffUatContext";

const RATINGS: { value: 1 | 2 | 3 | 4 | 5; label: string }[] = [
  { value: 1, label: "Confusing" },
  { value: 2, label: "Unclear" },
  { value: 3, label: "OK" },
  { value: 4, label: "Clear" },
  { value: 5, label: "Very clear" },
];

export function StaffUatClarityFeedback({ screenKey }: { screenKey: StaffUatScreenKey }) {
  const { enabled, tenantId, role } = useStaffUat();
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!enabled) return null;

  async function submit(selected: 1 | 2 | 3 | 4 | 5) {
    setRating(selected);
    setBusy(true);
    try {
      const route = typeof window !== "undefined" ? window.location.pathname : "";
      await fetch(`/api/tenants/${tenantId}/staff-uat/telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          kind: "feedback",
          route,
          role,
          screenKey,
          rating: selected,
          comment: comment.trim() || null,
        }),
      });
      setSubmitted(true);
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <p className="mt-8 text-center text-sm text-emerald-300/90">
        Thanks — your UAT feedback was recorded.
      </p>
    );
  }

  return (
    <section
      className="mt-8 rounded-xl border border-white/[0.08] bg-[#0c1426]/60 p-4 sm:p-5"
      aria-label="UAT clarity feedback"
    >
      <p className="text-sm font-semibold text-slate-200">Was this screen clear?</p>
      <p className="mt-1 text-xs text-slate-500">UAT only — helps us fix friction before go-live.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {RATINGS.map((r) => (
          <button
            key={r.value}
            type="button"
            disabled={busy}
            onClick={() => void submit(r.value)}
            className={cn(
              "rounded-lg border px-3 py-2 text-xs font-semibold transition",
              rating === r.value
                ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
                : "border-white/[0.1] text-slate-300 hover:border-cyan-500/30"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-xs text-slate-500">
        Optional comment
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-white/[0.1] bg-black/30 px-3 py-2 text-sm text-slate-200"
          placeholder="What was confusing or missing?"
        />
      </label>
    </section>
  );
}