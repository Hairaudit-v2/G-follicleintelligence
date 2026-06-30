"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, LayoutGrid } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import {
  FINANCIAL_OS_MORE_MODULES,
  FINANCIAL_OS_PRIMARY_MODULES,
  financialOsModuleHref,
  financialOsModuleIsActive,
  resolveFinancialOsActiveModule,
  type FinancialOsModule,
} from "@/src/lib/financialOs/financialOsModuleNav";

function ModuleMenuItem(props: { base: string; module: FinancialOsModule; pathname: string }) {
  const { base, module, pathname } = props;
  const active = financialOsModuleIsActive(pathname, base, module);
  const href = financialOsModuleHref(base, module.segment);

  return (
    <DropdownMenuItem asChild className="cursor-pointer rounded-lg p-0 focus:bg-transparent">
      <Link
        href={href}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-sm outline-none transition",
          active
            ? "border-cyan-400/25 bg-cyan-500/[0.16] text-slate-50 shadow-[inset_3px_0_0_0_rgba(34,211,238,0.9)]"
            : "border-transparent text-slate-300 hover:border-white/[0.06] hover:bg-white/[0.06] hover:text-slate-100 focus-visible:bg-white/[0.06]"
        )}
        aria-current={active ? "page" : undefined}
      >
        <Check
          className={cn("h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-0")}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate">{module.label}</span>
      </Link>
    </DropdownMenuItem>
  );
}

export function FinancialOsModuleSwitcher({ base }: { base: string }) {
  const pathname = usePathname();
  const active = resolveFinancialOsActiveModule(pathname, base);
  const activeLabel = active?.label ?? "Financial dashboard";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            fiOsChromeClasses.toolbarControlSurface,
            "inline-flex h-11 w-full min-w-0 items-center justify-between gap-2 px-3 text-left text-sm font-semibold text-cyan-100/95 sm:h-10 sm:w-auto sm:min-w-[15rem]"
          )}
          aria-label={`FinancialOS section: ${activeLabel}. Open section switcher.`}
          aria-haspopup="menu"
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <LayoutGrid className="h-4 w-4 shrink-0 text-cyan-400/90" aria-hidden />
            <span className="truncate">{activeLabel}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="z-50 max-h-[min(70vh,28rem)] w-[min(calc(100vw-1.5rem),18rem)] overflow-y-auto rounded-xl border border-white/[0.1] bg-[#0c1629]/95 p-1 text-slate-100 shadow-xl backdrop-blur-xl sm:w-[18rem]"
      >
        <DropdownMenuLabel className="px-2 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
          FinancialOS modules
        </DropdownMenuLabel>
        {FINANCIAL_OS_PRIMARY_MODULES.map((module) => (
          <ModuleMenuItem key={module.id} base={base} module={module} pathname={pathname} />
        ))}
        <DropdownMenuSeparator className="my-1 bg-white/[0.08]" />
        <DropdownMenuLabel className="px-2 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
          More
        </DropdownMenuLabel>
        {FINANCIAL_OS_MORE_MODULES.map((module) => (
          <ModuleMenuItem key={module.id} base={base} module={module} pathname={pathname} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
