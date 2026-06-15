"use client";

import Image from "next/image";
import Link from "next/link";

import { PUBLIC_IMAGES } from "@/src/lib/brand/publicImages";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronDown, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HEADER_PRIMARY_LINKS, HEADER_PRODUCTS_LINKS } from "@/lib/site-navigation";
import { cn } from "@/lib/utils";

function navItemIsActive(pathname: string, href: string) {
  if (href.startsWith("/#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function productsNavActive(pathname: string) {
  return pathname === "/platform" || pathname.startsWith("/platform/");
}

const navLinkClass =
  "text-[11px] font-medium transition-colors hover:text-foreground xl:text-[13px]";

export function Header() {
  const pathname = usePathname();
  const productsActive = productsNavActive(pathname);

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-50 border-b border-border/60 bg-background/88 backdrop-blur-xl"
    >
      <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-4 px-4 py-6 sm:gap-5 sm:px-6">
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-4 font-semibold tracking-tight">
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

        <div className="flex min-w-0 flex-1 items-center justify-end gap-6 lg:gap-8">
          <nav
            aria-label="Primary"
            className="hidden min-w-0 flex-1 justify-end lg:flex [&::-webkit-scrollbar]:hidden"
          >
            <ul className="flex items-center gap-8 whitespace-nowrap md:gap-10 lg:gap-12">
              <li className="shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md outline-none ring-offset-background focus-visible:ring-1 focus-visible:ring-ring",
                        navLinkClass,
                        productsActive ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      Products
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[16rem]">
                    {HEADER_PRODUCTS_LINKS.map((item) =>
                      item.external ? (
                        <DropdownMenuItem key={item.href} asChild>
                          <a href={item.href} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
                            {item.label}
                          </a>
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem key={item.href} asChild>
                          <Link href={item.href} className="cursor-pointer">
                            {item.label}
                          </Link>
                        </DropdownMenuItem>
                      )
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
              {HEADER_PRIMARY_LINKS.map((item) => (
                <li key={`${item.label}:${item.href}`} className="shrink-0">
                  <Link
                    href={item.href}
                    className={cn(
                      navLinkClass,
                      navItemIsActive(pathname, item.href) ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            <Button
              asChild
              size="sm"
              variant="outline"
              className="hidden rounded-lg border-border/80 bg-background/40 text-foreground shadow-none hover:bg-accent sm:inline-flex"
            >
              <Link href="/fi-login">Partner Access</Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" className="shrink-0 rounded-xl border border-border/70" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[min(100vw-2rem,20rem)] max-h-[min(70vh,28rem)] overflow-y-auto">
                <DropdownMenuLabel className="text-[10px] tracking-[0.2em]">Products</DropdownMenuLabel>
                {HEADER_PRODUCTS_LINKS.map((item) =>
                  item.external ? (
                    <DropdownMenuItem key={`m:${item.href}`} asChild>
                      <a href={item.href} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
                        {item.label}
                      </a>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem key={`m:${item.href}`} asChild>
                      <Link href={item.href} className="cursor-pointer">
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  )
                )}
                <DropdownMenuSeparator />
                {HEADER_PRIMARY_LINKS.map((item) => (
                  <DropdownMenuItem key={`m:${item.label}:${item.href}`} asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="sm:hidden" />
                <DropdownMenuItem asChild className="sm:hidden">
                  <Link href="/fi-login">Partner Access</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
