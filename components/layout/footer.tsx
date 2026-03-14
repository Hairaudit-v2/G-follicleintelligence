"use client";

import Link from "next/link";
import { motion } from "framer-motion";
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
            <span className="font-semibold tracking-tight text-foreground">Follicle Intelligence</span>
            <p className="text-xs uppercase tracking-[0.2em] text-primary/85">
              Clinical Intelligence Infrastructure
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              HairAudit is the first application. Follicle Intelligence is the engine.
            </p>
            <span className="text-xs text-amber-200/70">
              Aligned with IIHR standards and advisory frameworks.
            </span>
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
