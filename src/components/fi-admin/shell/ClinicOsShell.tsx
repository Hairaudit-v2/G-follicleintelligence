"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Plus, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";
import { BrandLogoImage } from "@/src/components/brand/BrandLogoImage";
import { resolveTenantLogoSource } from "@/src/lib/brand/resolveTenantLogo";
import { FI_ADMIN_NEUTRAL_ACCENT, safeBrandingColourHex } from "@/src/lib/fi/foundation/brandingCss";
import {
  getClinicOsShellActiveNavId,
  isClinicOsShellCalendarContextRoute,
  resolveClinicOsShellNavItems,
  resolveClinicOsShellQuickActions,
} from "@/src/lib/fiAdmin/clinicOsShellConfig";
import { CLINIC_OS_OPEN_GLOBAL_SEARCH_EVENT } from "@/src/lib/fiAdmin/clinicOsShellSearchEvent";

import { ClinicOsGlobalSearch } from "@/src/components/fi-admin/search/ClinicOsGlobalSearch";

import { ClinicOsShellCalendarBar } from "./ClinicOsShellCalendarBar";

function ComingSoonMenuRow({ label }: { label: string }) {
  return (
    <DropdownMenuItem
      disabled
      className="pointer-events-none flex cursor-not-allowed items-center justify-between gap-3 rounded-md opacity-100 data-[disabled]:opacity-100"
    >
      <span className="text-slate-500">{label}</span>
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-400">Coming soon</span>
    </DropdownMenuItem>
  );
}

export function ClinicOsShell({
  tenantId,
  base,
  showCrmNav,
  effective,
  children,
}: {
  tenantId: string;
  base: string;
  showCrmNav: boolean;
  effective: EffectiveBranding;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const [searchOpen, setSearchOpen] = useState(false);
  const [kbdHint, setKbdHint] = useState("Ctrl+K");

  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const pf = typeof navigator !== "undefined" ? navigator.platform : "";
    const apple = /Mac|iPhone|iPad|iPod/i.test(pf) || /Mac OS/.test(ua);
    setKbdHint(apple ? "⌘K" : "Ctrl+K");
  }, []);

  useEffect(() => {
    function onGlobalKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, []);

  useEffect(() => {
    function onOpenSearchEvent() {
      setSearchOpen(true);
    }
    window.addEventListener(CLINIC_OS_OPEN_GLOBAL_SEARCH_EVENT, onOpenSearchEvent);
    return () => window.removeEventListener(CLINIC_OS_OPEN_GLOBAL_SEARCH_EVENT, onOpenSearchEvent);
  }, []);
  const navItems = resolveClinicOsShellNavItems(base, showCrmNav);
  const quickActions = resolveClinicOsShellQuickActions(base, showCrmNav);
  const activeNavId = getClinicOsShellActiveNavId(pathname, base);
  const showCalendarBar = isClinicOsShellCalendarContextRoute(pathname, base);

  const accent = safeBrandingColourHex(effective.accent_colour, FI_ADMIN_NEUTRAL_ACCENT);
  const brandName = effective.brand_name?.trim() || "Follicle Intelligence";
  const logoSrc = resolveTenantLogoSource(effective.logo_url);
  const clinicContextLabel =
    effective.clinic_display_name?.trim() || effective.brand_name?.trim() || "This clinic";

  return (
    <div className="min-h-[min(100dvh,100vh)] bg-slate-50">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 lg:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <Link
              href={base}
              className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-lg pr-2 outline-none ring-sky-500/30 transition hover:bg-slate-50 focus-visible:ring-2"
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold tracking-tight text-slate-800"
                aria-hidden
              >
                FI
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Clinic OS</p>
                <p className="truncate text-sm font-semibold text-slate-900">{brandName}</p>
              </div>
            </Link>

            {logoSrc ? (
              <div className="hidden shrink-0 border-l border-slate-200 pl-3 sm:block">
                <BrandLogoImage
                  logoUrl={effective.logo_url}
                  alt={brandName}
                  width={112}
                  height={36}
                  className="h-9 w-auto max-w-[120px] object-contain"
                />
              </div>
            ) : null}

            <div className="order-last flex w-full min-w-0 flex-1 basis-full items-center gap-2 pt-1 sm:order-none sm:basis-auto sm:pt-0 lg:max-w-md lg:pl-2">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-left text-sm text-slate-800 outline-none ring-sky-400/20 transition hover:border-slate-300 hover:bg-slate-50/80 focus-visible:border-sky-400/50 focus-visible:ring-2"
                aria-haspopup="dialog"
                aria-expanded={searchOpen}
                aria-label="Open workspace search"
              >
                <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-slate-400">Search patients, leads, bookings and cases</span>
                <kbd className="hidden shrink-0 select-none rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-slate-500 sm:inline-block">
                  {kbdHint}
                </kbd>
              </button>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-400/30"
                    style={{ boxShadow: `inset 0 -1px 0 0 ${accent}18` }}
                  >
                    <Plus className="h-4 w-4 text-sky-600" aria-hidden />
                    New
                    <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[12.5rem] rounded-lg border-slate-200 bg-white p-1 shadow-md">
                  <DropdownMenuLabel className="text-slate-500">New</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-200" />
                  {quickActions.map((action, index) => {
                    const showSepBeforeTask = action.id === "task" && index > 0;
                    return (
                      <div key={action.id}>
                        {showSepBeforeTask ? <DropdownMenuSeparator className="bg-slate-200" /> : null}
                        {action.disabled ? (
                          <ComingSoonMenuRow label={action.label} />
                        ) : (
                          <DropdownMenuItem asChild className="cursor-pointer rounded-md">
                            <Link href={action.href}>{action.label}</Link>
                          </DropdownMenuItem>
                        )}
                      </div>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <nav
            className="-mx-1 flex min-w-0 items-stretch gap-0.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Clinic workspace"
          >
            {navItems.map((item) => {
              const active = !item.disabled && activeNavId === item.id;
              const common =
                "shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30 sm:px-3";

              if (item.disabled) {
                return (
                  <span
                    key={item.id}
                    className={cn(common, "cursor-not-allowed text-slate-400")}
                    aria-disabled="true"
                    title="Coming soon"
                  >
                    {item.label}
                  </span>
                );
              }

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    common,
                    active
                      ? "bg-sky-50 text-sky-900 ring-1 ring-sky-200/90"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {showCalendarBar ? <ClinicOsShellCalendarBar clinicLabel={clinicContextLabel} /> : null}

      <div className="mx-auto max-w-[1600px] px-3 pb-8 pt-4 sm:px-4 lg:px-6">{children}</div>

      <ClinicOsGlobalSearch
        tenantId={tenantId}
        base={base}
        showCrmNav={showCrmNav}
        open={searchOpen}
        onOpenChange={setSearchOpen}
      />
    </div>
  );
}
