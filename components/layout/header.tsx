"use client";

import Image from "next/image";
import Link from "next/link";

import { PUBLIC_IMAGES } from "@/src/lib/brand/publicImages";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PRIMARY_NAV } from "@/lib/site-navigation";
import { cn } from "@/lib/utils";

function navItemIsActive(pathname: string, href: string) {
  if (href.startsWith("/#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Header() {
  const pathname = usePathname();
  const headerNav = PRIMARY_NAV;

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-50 border-b border-border/60 bg-background/88 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-auto min-h-[4.5rem] max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:gap-5 sm:px-6 md:min-h-[5rem]">
        <Link href="/" className="flex min-w-0 items-center gap-4 font-semibold tracking-tight">
          <div className="fi-panel-muted flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70">
            <Image
              src={PUBLIC_IMAGES.favicon32}
              alt="Follicle Intelligence"
              width={30}
              height={30}
              className="size-[30px] rounded-[8px]"
              priority
            />
          </div>
          <div className="min-w-0 leading-none">
            <span className="block text-sm text-foreground md:text-base">Follicle Intelligence</span>
            <span className="mt-1 block text-[10px] uppercase tracking-[0.32em] text-muted-foreground md:text-[11px]">
              Hair restoration operating system
            </span>
          </div>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden min-w-0 flex-1 justify-end overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] lg:flex lg:[&::-webkit-scrollbar]:hidden"
        >
          <ul className="flex items-center gap-2 whitespace-nowrap pr-1 pt-1 xl:gap-3">
            {headerNav.map((item) => (
              <li key={`${item.label}:${item.href}`} className="shrink-0">
                <Link
                  href={item.href}
                  className={cn(
                    "text-[11px] font-medium transition-colors hover:text-foreground xl:text-[13px]",
                    navItemIsActive(pathname, item.href) ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-4">
          <Button asChild size="sm" className="hidden border-amber-300/25 bg-amber-200/10 text-foreground hover:bg-amber-200/15 md:inline-flex">
            <Link href="/demo">Book demo</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" className="rounded-xl border border-border/70">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 max-h-[min(70vh,28rem)] overflow-y-auto">
              {headerNav.map((item) => (
                <DropdownMenuItem key={`${item.label}:${item.href}`} asChild>
                  <Link href={item.href}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem asChild>
                <Link href="/demo">Book demo</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.header>
  );
}
