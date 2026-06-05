"use client";

import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { CLINIC_OS_OPEN_GLOBAL_SEARCH_EVENT } from "@/src/lib/fiAdmin/clinicOsShellSearchEvent";

type ClinicOsOpenGlobalSearchButtonProps = {
  className?: string;
};

const defaultClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 sm:w-auto";

/**
 * Opens the shell workspace search dialog (same as header search / ⌘K / Ctrl+K).
 */
export function ClinicOsOpenGlobalSearchButton({ className }: ClinicOsOpenGlobalSearchButtonProps) {
  return (
    <button
      type="button"
      className={cn(defaultClass, className)}
      onClick={() => {
        window.dispatchEvent(new Event(CLINIC_OS_OPEN_GLOBAL_SEARCH_EVENT));
      }}
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden />
      Open search
    </button>
  );
}
