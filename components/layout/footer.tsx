"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

import { IiohrSeal } from "@/components/brand/iiohr-logo";
import { FOOTER_NAV } from "@/lib/site-navigation";

export function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="border-t border-border/50 bg-background/70"
    >
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <Link href="/" className="w-fit">
              <Image
                src="/brand/follicle-intelligence-logo-white.svg"
                alt="Follicle Intelligence"
                width={180}
                height={161}
                className="h-auto w-40"
              />
            </Link>
            <p className="text-xs uppercase tracking-[0.2em] text-primary/85">
              Clinical Intelligence Infrastructure
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              HairAudit is the first application. Follicle Intelligence is the engine.
            </p>
            <div className="flex items-center gap-3 text-xs text-amber-200/75">
              <IiohrSeal tone="dark" className="h-9 w-9 shrink-0" aria-hidden />
              <span>Aligned with IIOHR standards and advisory frameworks.</span>
            </div>
          </div>
          <nav className="flex flex-wrap gap-5">
            {FOOTER_NAV.map((item) => (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-8 border-t border-border/50 pt-8 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Follicle Intelligence. All rights reserved.
        </div>
      </div>
    </motion.footer>
  );
}
