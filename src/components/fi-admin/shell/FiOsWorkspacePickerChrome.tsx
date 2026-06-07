"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { fiOsSignOutAction } from "@/lib/actions/fi-os-auth-actions";
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

/**
 * Minimal FI OS chrome for `/fi-admin` (tenant picker) — no marketing “← Home” header.
 */
export function FiOsWorkspacePickerChrome({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail: string | null;
}) {
  const pathname = usePathname() ?? "";
  const isPicker = pathname === "/fi-admin" || pathname === "/fi-admin/";

  if (!isPicker) {
    return <>{children}</>;
  }

  return (
    <div className="relative z-10 flex min-h-screen min-h-dvh w-full flex-col">
      <header
        className={cn(
          "sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-[#0a1424]/85 px-4 py-3 backdrop-blur-xl sm:px-6",
        )}
      >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.05] text-xs font-bold tracking-tight text-[#22C1FF]">
              FI
            </div>
            <div className="min-w-0">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#22C1FF]/90">Follicle Intelligence</p>
              <p className="truncate text-sm font-semibold text-[#F8FAFC]">Workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 text-sm font-medium text-[#E2E8F0] outline-none transition hover:border-white/[0.14] hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-cyan-400/35"
                  aria-label="Account menu"
                >
                  <User className="h-4 w-4 text-[#94A3B8]" aria-hidden />
                  <span className="hidden max-w-[12rem] truncate sm:inline">{userEmail ?? "Account"}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-[12rem] rounded-xl border border-white/[0.1] bg-[#0c1629]/95 p-1 text-[#E2E8F0] shadow-xl backdrop-blur-xl"
              >
                {userEmail ? (
                  <>
                    <DropdownMenuLabel className="font-normal text-[#94A3B8]">{userEmail}</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/[0.08]" />
                  </>
                ) : null}
                <DropdownMenuItem asChild className="cursor-pointer rounded-lg focus:bg-white/[0.06]">
                  <Link href="/follicle-intelligence/login">Sign in (alternate)</Link>
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
        </header>
      <div className="flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</div>
    </div>
  );
}
