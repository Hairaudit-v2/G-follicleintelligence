"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { fiOsSignOutAction } from "@/lib/actions/fi-os-auth-actions";
import { fiAdminAmbientBackgroundStyle } from "@/src/components/fi-admin/dashboard-ui";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User } from "lucide-react";

function showsWorkspaceChrome(pathname: string) {
  const p = pathname.replace(/\/+$/, "") || "/";
  return p === "/fi-admin" || p.startsWith("/fi-admin/system");
}

/**
 * Pre-tenant FI admin gateway: same deep/glass language as {@link FiOsAppShell}, without marketing chrome.
 * Renders a compact command bar on `/fi-admin` and `/fi-admin/system/*`; tenant routes receive children unchanged.
 */
export function FiOsWorkspaceEntryShell({
  children,
  userEmail,
  showSystemAdminEntry = false,
}: {
  children: React.ReactNode;
  userEmail: string | null;
  /** When true, show link to `/fi-admin/system` (fi_platform_admin). */
  showSystemAdminEntry?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const showChrome = showsWorkspaceChrome(pathname);
  const isWorkspacePickerOnly = (pathname.replace(/\/+$/, "") || "/") === "/fi-admin";

  return (
    <div className="relative min-h-screen min-h-dvh overflow-x-hidden bg-[#081020] font-sans text-[#F8FAFC] antialiased">
      <div
        className="pointer-events-none absolute inset-0"
        style={fiAdminAmbientBackgroundStyle}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a1528]/35 via-transparent to-[#02060d]/80"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-screen min-h-dvh w-full flex-col">
        {showChrome ? (
          <header
            className={cn(
              fiOsChromeClasses.topBar,
              "flex flex-wrap items-center justify-between gap-3"
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.05] text-xs font-bold tracking-tight text-cyan-300">
                FI
              </div>
              <div className="min-w-0">
                <p className={fiOsChromeClasses.sectionEyebrow}>FI OS</p>
                <p className="truncate text-sm font-semibold text-slate-100">
                  {pathname.startsWith("/fi-admin/system")
                    ? "System administration"
                    : "Workspace launcher"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {showSystemAdminEntry ? (
                <Link
                  href="/fi-admin/system"
                  className="hidden rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm font-medium text-cyan-300 transition hover:border-cyan-500/35 hover:bg-white/[0.07] sm:inline-block"
                >
                  System administration
                </Link>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 text-sm font-medium text-slate-200 outline-none transition",
                      "hover:border-white/[0.14] hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-cyan-400/35"
                    )}
                    aria-label="Account menu"
                  >
                    <User className="h-4 w-4 text-slate-500" aria-hidden />
                    <span className="hidden max-w-[12rem] truncate sm:inline">
                      {userEmail ?? "Session"}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="min-w-[12rem] rounded-xl border border-white/[0.1] bg-[#0c1629]/95 p-1 text-slate-200 shadow-xl backdrop-blur-xl"
                >
                  {userEmail ? (
                    <>
                      <DropdownMenuLabel className="font-normal text-slate-500">
                        {userEmail}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-white/[0.08]" />
                    </>
                  ) : null}
                  {showSystemAdminEntry ? (
                    <>
                      <DropdownMenuItem
                        asChild
                        className="cursor-pointer rounded-lg focus:bg-white/[0.06]"
                      >
                        <Link href="/fi-admin/system">System administration</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/[0.08]" />
                    </>
                  ) : null}
                  <DropdownMenuItem
                    asChild
                    className="cursor-pointer rounded-lg focus:bg-white/[0.06]"
                  >
                    <Link href="/fi-login">Sign in</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/[0.08]" />
                  <DropdownMenuItem
                    asChild
                    className="cursor-pointer rounded-lg p-0 focus:bg-white/[0.06]"
                  >
                    <form action={fiOsSignOutAction} className="w-full">
                      <button type="submit" className="w-full px-2 py-1.5 text-left text-sm">
                        Sign out
                      </button>
                    </form>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
        ) : null}

        <div
          className={cn(
            "flex min-h-0 w-full flex-1 flex-col",
            isWorkspacePickerOnly
              ? "mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-8 lg:max-w-4xl"
              : showChrome
                ? "w-full px-3 py-6 sm:px-4 sm:py-8"
                : ""
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
