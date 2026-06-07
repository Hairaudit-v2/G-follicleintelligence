"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Tenant = { id: string; name: string; slug: string };

type TenantsJson = { ok: true; tenants?: Tenant[] } | { ok: false; error?: string };

export function FiOsTenantSwitcher({
  tenantId,
  currentLabel,
  accentHex,
}: {
  tenantId: string;
  currentLabel: string;
  accentHex: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<Tenant[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/tenants", { credentials: "same-origin" });
      const d = (await r.json()) as TenantsJson;
      if (r.ok && d.ok) {
        setTenants(d.tenants ?? []);
      } else {
        setTenants([]);
      }
    } catch {
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && tenants === null) void load();
  }, [open, tenants, load]);

  const tid = tenantId.trim();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 max-w-[min(100%,20rem)] min-w-0 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 text-left text-sm font-medium text-[#E2E8F0] shadow-sm outline-none backdrop-blur-md transition",
            "hover:border-white/[0.14] hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-cyan-400/35",
          )}
          style={{ boxShadow: `inset 0 -1px 0 0 ${accentHex}22` }}
          aria-label="Switch clinic or tenant"
        >
          <Building2 className="h-4 w-4 shrink-0 text-[#22C1FF]" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{currentLabel}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-[#64748B]" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[min(100vw-2rem,22rem)] rounded-xl border border-white/[0.1] bg-[#0c1629]/95 p-1 text-[#E2E8F0] shadow-2xl shadow-black/50 backdrop-blur-xl"
      >
        <DropdownMenuLabel className="px-2 py-1.5 text-xs font-normal text-[#64748B]">Clinic / tenant</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/[0.08]" />
        {loading && tenants === null ? (
          <div className="flex items-center gap-2 px-2 py-3 text-sm text-[#94A3B8]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : null}
        {tenants && tenants.length === 0 && !loading ? (
          <div className="px-2 py-2 text-xs text-[#94A3B8]">No other tenants available.</div>
        ) : null}
        {tenants?.map((t) => {
          const active = t.id === tid;
          return (
            <DropdownMenuItem key={t.id} asChild className="cursor-pointer rounded-lg px-2 py-2 focus:bg-white/[0.06]">
              <Link href={`/fi-admin/${t.id}`} className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
                <span className="shrink-0 font-mono text-[10px] text-[#64748B]">{t.slug}</span>
                {active ? <Check className="h-4 w-4 shrink-0 text-[#22C1FF]" aria-label="Current" /> : null}
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator className="bg-white/[0.08]" />
        <DropdownMenuItem asChild className="cursor-pointer rounded-lg px-2 py-2 focus:bg-white/[0.06]">
          <Link href="/fi-admin" className="text-[#94A3B8]">
            All workspaces…
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
