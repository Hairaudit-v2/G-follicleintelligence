"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";
import { FI_ADMIN_NEUTRAL_ACCENT, safeBrandingColourHex, safeLogoUrlForImg } from "@/src/lib/fi/foundation/brandingCss";
import {
  resolveClinicOsShellNavItems,
  resolveClinicOsShellQuickActions,
} from "@/src/lib/fiAdmin/clinicOsShellConfig";

function normalizePath(p: string): string {
  const t = p.replace(/\/+$/, "");
  return t.length === 0 ? "/" : t;
}

function navItemActive(pathname: string, href: string, home?: boolean): boolean {
  if (href === "#") return false;
  const p = normalizePath(pathname);
  const h = normalizePath(href);
  if (home) return p === h;
  return p === h || p.startsWith(`${h}/`);
}

function TenantLogo({ url, alt }: { url: string; alt: string }) {
  const [hide, setHide] = useState(false);
  if (hide) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external tenant URLs; match FiTenantBrandFrame
    <img
      src={url}
      alt={alt}
      width={112}
      height={36}
      className="h-9 w-auto max-w-[120px] object-contain"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setHide(true)}
    />
  );
}

export function ClinicOsShell({
  base,
  showCrmNav,
  effective,
  children,
}: {
  base: string;
  showCrmNav: boolean;
  effective: EffectiveBranding;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const navItems = resolveClinicOsShellNavItems(base, showCrmNav);
  const quickActions = resolveClinicOsShellQuickActions(base, showCrmNav);
  const accent = safeBrandingColourHex(effective.accent_colour, FI_ADMIN_NEUTRAL_ACCENT);
  const brandName = effective.brand_name?.trim() || "Follicle Intelligence";
  const logoSrc = safeLogoUrlForImg(effective.logo_url);

  return (
    <div className="min-h-[min(100dvh,100vh)] bg-slate-50/95">
      <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/95 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-3 py-2.5 sm:px-4 sm:py-3 lg:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <Link
              href={base}
              className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-lg pr-2 outline-none ring-sky-500/30 transition hover:bg-slate-100/80 focus-visible:ring-2"
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-bold tracking-tight text-slate-800 shadow-sm"
                aria-hidden
              >
                FI
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-xs font-semibold uppercase tracking-[0.2em] text-sky-700/90">Clinic OS</p>
                <p className="truncate text-sm font-semibold text-slate-900">{brandName}</p>
              </div>
            </Link>

            {logoSrc ? (
              <div className="hidden shrink-0 border-l border-slate-200 pl-3 sm:block">
                <TenantLogo url={logoSrc} alt={brandName} />
              </div>
            ) : null}

            <div className="order-last flex w-full min-w-0 flex-1 basis-full items-center gap-2 pt-1 sm:order-none sm:basis-auto sm:pt-0 lg:max-w-md lg:pl-2">
              <label className="sr-only" htmlFor="clinic-os-global-search">
                Patient search
              </label>
              <input
                id="clinic-os-global-search"
                type="search"
                name="clinic-os-global-search"
                readOnly
                placeholder="Search patients…"
                className="h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-inner shadow-slate-900/5 outline-none ring-sky-400/25 placeholder:text-slate-400 focus:border-sky-300 focus:ring-2"
              />
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-400/40"
                    style={{ boxShadow: `inset 0 -1px 0 0 ${accent}22` }}
                  >
                    <Plus className="h-4 w-4 text-sky-600" aria-hidden />
                    New
                    <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[11rem] rounded-lg border-slate-200 bg-white p-1 shadow-lg">
                  {quickActions.map((action) =>
                    action.disabled ? (
                      <DropdownMenuItem key={action.id} disabled className="rounded-md text-slate-400">
                        {action.label}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem key={action.id} asChild className="rounded-md cursor-pointer">
                        <Link href={action.href}>{action.label}</Link>
                      </DropdownMenuItem>
                    )
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <nav className="-mx-1 flex min-w-0 items-stretch gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Clinic workspace">
            {navItems.map((item) => {
              const active = navItemActive(pathname, item.href, item.home);
              const common =
                "shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40";

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
                      ? "bg-sky-50 text-sky-800 ring-1 ring-sky-200/80 shadow-sm"
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

      <div className="mx-auto max-w-[1600px] px-3 pb-8 pt-4 sm:px-4 lg:px-6">{children}</div>
    </div>
  );
}
