"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  ClipboardList,
  FileText,
  ListTodo,
  Scissors,
  Search,
  Stethoscope,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { resolveFiOsQuickCreateItems, type ResolvedFiOsQuickCreateItem } from "@/src/lib/fiAdmin/fiOsQuickCreateItems";

const ICONS: Record<string, typeof Stethoscope> = {
  consultation: Stethoscope,
  patient: Users,
  lead: UserPlus,
  case: Scissors,
  task: ListTodo,
  patient_photos: Camera,
  clinical_note: FileText,
};

function defaultIcon(): typeof Stethoscope {
  return ClipboardList;
}

export function FiOsQuickCreatePalette({
  tenantId,
  open,
  onOpenChange,
  showCrmNav,
  showBookingsBoard,
  onOpenCreateLead,
}: {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showCrmNav: boolean;
  showBookingsBoard: boolean;
  onOpenCreateLead?: () => void;
}) {
  const router = useRouter();
  const base = `/fi-admin/${tenantId.trim()}`;
  const items = useMemo(
    () => resolveFiOsQuickCreateItems(base, showCrmNav, showBookingsBoard),
    [base, showCrmNav, showBookingsBoard]
  );

  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((it) => {
      const hay = [it.label, it.description, it.id, ...it.keywords].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q]);

  useEffect(() => {
    setActive(0);
  }, [q, open]);

  useEffect(() => {
    if (!open) {
      setQ("");
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(t);
  }, [open]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const go = useCallback(
    (it: ResolvedFiOsQuickCreateItem) => {
      if (!it.enabled || it.href === "#") return;
      if (it.id === "lead" && onOpenCreateLead) {
        onOpenCreateLead();
        close();
        return;
      }
      router.push(it.href);
      close();
    },
    [router, close, onOpenCreateLead]
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (filtered.length === 0) return;
        setActive((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (filtered.length === 0) return;
        setActive((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        const row = filtered[active];
        if (row) {
          e.preventDefault();
          go(row);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, active, go, close]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-3 pt-[min(12vh,6rem)] sm:px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Close quick create"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fi-os-quick-create-title"
        className="relative z-[1] w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0a1424]/98 text-slate-100 shadow-2xl shadow-black/60 backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-white/[0.08] px-3 py-2.5 sm:px-4">
          <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search quick create…"
            className="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            aria-label="Filter quick create actions"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={close}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p id="fi-os-quick-create-title" className="sr-only">
          Quick create
        </p>

        <ul className="max-h-[min(60vh,22rem)] overflow-y-auto py-1" role="listbox" aria-label="Quick create actions">
          {filtered.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-slate-500">No matches.</li>
          ) : (
            filtered.map((it, idx) => {
              const Icon = ICONS[it.id] ?? defaultIcon();
              const selected = idx === active;
              return (
                <li key={it.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={!it.enabled}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => go(it)}
                    className={cn(
                      "flex w-full items-start gap-3 px-3 py-2.5 text-left transition sm:px-4",
                      selected && it.enabled ? "bg-cyan-500/12" : "hover:bg-white/[0.04]",
                      it.enabled ? "text-slate-100" : "cursor-not-allowed opacity-50"
                    )}
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-cyan-300">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{it.label}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-slate-400">{it.description}</span>
                      {!it.enabled && it.disabledReason ? (
                        <span className="mt-1 block text-[11px] font-medium text-amber-200/90">{it.disabledReason}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="border-t border-white/[0.06] px-3 py-2 text-[10px] text-slate-500 sm:px-4">
          <kbd className="rounded border border-white/[0.1] bg-black/25 px-1 font-mono">↑</kbd>{" "}
          <kbd className="rounded border border-white/[0.1] bg-black/25 px-1 font-mono">↓</kbd> move ·{" "}
          <kbd className="rounded border border-white/[0.1] bg-black/25 px-1 font-mono">Enter</kbd> open ·{" "}
          <kbd className="rounded border border-white/[0.1] bg-black/25 px-1 font-mono">Esc</kbd> close
        </div>
      </div>
    </div>
  );
}
