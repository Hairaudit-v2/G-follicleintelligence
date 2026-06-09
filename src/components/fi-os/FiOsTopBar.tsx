"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, Menu, Plus, Search } from "lucide-react";

import { fiOsSignOutAction } from "@/lib/actions/fi-os-auth-actions";
import { staffPinLogoutAction } from "@/lib/actions/fi-staff-pin-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/utils";
import { FiOsTenantSwitcher } from "@/src/components/fi-admin/shell/FiOsTenantSwitcher";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";

export function FiOsTopBar({
  tenantId,
  clinicLabel,
  accentHex,
  userEmail,
  searchOpen,
  onSearchOpenChange,
  kbdHint,
  quickCreateKbdHint,
  onOpenMobileNav,
  onOpenQuickCreate,
  impersonationDisplayName,
  showFiPlatformSystemLink = false,
  staffPinSessionLabel = null,
  staffPinLogoutTenantId = null,
}: {
  tenantId: string;
  clinicLabel: string;
  accentHex: string;
  userEmail: string | null;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  kbdHint: string;
  /** Shown on the Quick create button (e.g. ⇧⌘K). */
  quickCreateKbdHint: string;
  onOpenMobileNav: () => void;
  onOpenQuickCreate: () => void;
  /** When set, shows impersonation banner (platform admin). */
  impersonationDisplayName?: string | null;
  showFiPlatformSystemLink?: boolean;
  staffPinSessionLabel?: string | null;
  staffPinLogoutTenantId?: string | null;
}) {
  const router = useRouter();
  return (
    <div className="flex w-full min-w-0 flex-col">
      {staffPinSessionLabel ? (
        <div
          className="flex w-full flex-wrap items-center justify-between gap-2 border-b border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-50 sm:px-4"
          role="status"
        >
          <span>
            Signed in as <strong className="font-semibold text-cyan-100">{staffPinSessionLabel}</strong>
          </span>
          {staffPinLogoutTenantId ? (
            <button
              type="button"
              className="shrink-0 rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-500/30"
              onClick={() => {
                void staffPinLogoutAction(staffPinLogoutTenantId).then((r) => {
                  if (r.ok) router.push(r.redirectTo);
                  router.refresh();
                });
              }}
            >
              End PIN session
            </button>
          ) : null}
        </div>
      ) : null}
      {impersonationDisplayName ? (
        <div
          className="flex w-full flex-wrap items-center justify-between gap-2 border-b border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-50 sm:px-4"
          role="status"
        >
          <span>
            You are currently impersonating <strong className="font-semibold text-amber-100">{impersonationDisplayName}</strong>
          </span>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-amber-400/40 bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-50 transition hover:bg-amber-500/30"
            onClick={() => {
              void fetch("/api/fi-os/impersonation/stop", { method: "POST" }).then(() => router.refresh());
            }}
          >
            Exit impersonation
          </button>
        </div>
      ) : null}
      <div className={fiOsChromeClasses.topBar}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
        <button
          type="button"
          className={cn(
            fiOsChromeClasses.toolbarControlSurface,
            "inline-flex h-10 w-10 shrink-0 items-center justify-center lg:hidden"
          )}
          aria-label="Open navigation"
          onClick={onOpenMobileNav}
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 shrink-0">
          <FiOsTenantSwitcher tenantId={tenantId} currentLabel={clinicLabel} accentHex={accentHex} />
        </div>

        <div className="flex w-full min-w-0 flex-1 basis-full sm:basis-auto">
          <button
            type="button"
            onClick={() => onSearchOpenChange(true)}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "flex h-10 w-full min-w-0 items-center gap-2 px-3 text-left text-sm"
            )}
            aria-haspopup="dialog"
            aria-expanded={searchOpen}
            aria-label="Open workspace search"
          >
            <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-slate-500">Search patients, leads, cases…</span>
            <kbd className="hidden shrink-0 select-none rounded-lg border border-white/[0.1] bg-black/20 px-2 py-0.5 font-sans text-[10px] font-medium text-slate-500 sm:inline-block">
              {kbdHint}
            </kbd>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onOpenQuickCreate()}
          className={cn(
            fiOsChromeClasses.toolbarControlSurface,
            fiOsChromeClasses.toolbarPrimaryAccent,
            "inline-flex h-10 shrink-0 items-center gap-2 px-3 text-sm font-semibold"
          )}
          style={{ boxShadow: `inset 0 -1px 0 0 ${accentHex}28` }}
          aria-label="Open quick create"
          title="Quick create — consultations, patients, leads, and more"
        >
          <Plus className="h-4 w-4 text-cyan-400" aria-hidden />
          <span className="hidden sm:inline">Quick create</span>
          <kbd className="hidden select-none rounded-md border border-white/[0.1] bg-black/25 px-1.5 py-0.5 font-sans text-[10px] font-medium text-slate-500 md:inline-block">
            {quickCreateKbdHint}
          </kbd>
        </button>

        <button
          type="button"
          className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex h-10 w-10 shrink-0 items-center justify-center opacity-70")}
          title="Notifications (coming soon)"
          aria-label="Notifications (coming soon)"
          disabled
        >
          <Bell className="h-[1.125rem] w-[1.125rem]" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                fiOsChromeClasses.toolbarControlSurface,
                "inline-flex h-10 max-w-[10rem] shrink-0 items-center gap-2 px-2.5 text-sm font-medium sm:max-w-[14rem]"
              )}
              aria-label="Profile menu"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400/25 to-violet-600/20 text-xs font-bold text-sky-100">
                {(userEmail ?? "U").slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden min-w-0 flex-1 truncate text-left sm:inline">{userEmail ?? "Account"}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[12rem] rounded-xl border border-white/[0.1] bg-[#0c1629]/95 p-1 text-slate-100 shadow-xl backdrop-blur-xl"
          >
            {userEmail ? (
              <>
                <DropdownMenuLabel className="font-normal text-slate-500">{userEmail}</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/[0.08]" />
              </>
            ) : null}
            {showFiPlatformSystemLink ? (
              <>
                <DropdownMenuItem asChild className="cursor-pointer rounded-lg focus:bg-white/[0.06]">
                  <Link href="/fi-admin/system">System administration</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/[0.08]" />
              </>
            ) : null}
            <DropdownMenuItem asChild className="cursor-pointer rounded-lg focus:bg-white/[0.06]">
              <Link href="/fi-admin">Switch workspace</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/[0.08]" />
            <DropdownMenuItem asChild className="cursor-pointer rounded-lg p-0 focus:bg-white/[0.06]">
              <form action={fiOsSignOutAction} className="w-full">
                <button type="submit" className="w-full px-2 py-1.5 text-left text-sm">
                  Sign out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    </div>
  );
}
