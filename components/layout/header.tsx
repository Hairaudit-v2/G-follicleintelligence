"use client";

import Image from "next/image";
import Link from "next/link";
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
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const headerNav: { href: string; label: string }[] = [];

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-50 border-b border-border/60 bg-background/88 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-6 px-6">
        <Link href="/" className="flex min-w-0 items-center gap-4 font-semibold tracking-tight">
          <div className="fi-panel-muted flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70">
            <Image
              src="/icons/favicon-32x32.png"
              alt="Follicle"
              width={30}
              height={30}
              className="size-[30px] rounded-[8px]"
              priority
            />
          </div>
          <div className="min-w-0 leading-none">
            <span className="block text-sm text-foreground md:text-base">Follicle</span>
            <span className="mt-1 block text-[10px] uppercase tracking-[0.32em] text-muted-foreground md:text-[11px]">
              Clinical Audit
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex">
          {headerNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-foreground",
                pathname === item.href || pathname.startsWith(`${item.href}/`)
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Button asChild size="sm" className="hidden md:inline-flex">
            <Link href="/contact?intent=demo">Request Demo</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" className="rounded-xl border border-border/70">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {headerNav.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem asChild>
                <Link href="/contact?intent=demo">Request Demo</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.header>
  );
}
