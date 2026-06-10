"use client";

import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { procedureDayLinkForClipboard } from "@/src/lib/cases/caseDetailNavConstants";

const COPIED_MS = 2000;

export function CopyProcedureDayLinkButton({
  relativeHref,
  className,
  variant = "dark",
}: {
  /** App-relative path including `#case-procedure-day` when applicable. */
  relativeHref: string | null;
  className?: string;
  variant?: "dark" | "light";
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(t);
  }, [copied]);

  const onClick = useCallback(async () => {
    const href = relativeHref?.trim();
    if (!href) return;
    const origin = typeof window !== "undefined" ? window.location?.origin : undefined;
    const text = procedureDayLinkForClipboard(href, origin);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
      } catch {
        /* ignore */
      }
    }
  }, [relativeHref]);

  if (!relativeHref?.trim()) return null;

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className={cn(
        "shrink-0 rounded border px-2 py-0.5 text-[0.65rem] font-medium transition-colors",
        variant === "light"
          ? copied
            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          : copied
            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
            : "border-white/[0.12] bg-black/25 text-cyan-200/90 hover:border-cyan-500/30 hover:bg-black/40",
        className
      )}
    >
      {copied ? "Copied" : "Copy procedure-day link"}
    </button>
  );
}
