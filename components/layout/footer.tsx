"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

import { IiohrSeal } from "@/components/brand/iiohr-logo";
import { ECOSYSTEM_BAND, FOOTER_NAV } from "@/lib/site-navigation";

export function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="border-t border-border/60 bg-background/75"
    >
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <div className="fi-panel rounded-[1.5rem] p-7 md:p-8">
            <Link href="/" className="inline-block">
              <Image
                src="/brand/follicle-intelligence-logo-white.svg"
                alt="Follicle Intelligence"
                width={240}
                height={48}
                className="h-auto w-44 md:w-52"
              />
            </Link>
            <p className="mt-4 text-[11px] uppercase tracking-[0.32em] text-primary/85">
              Central intelligence layer
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
              Follicle Intelligence is the shared layer for benchmarked quality, governance, and
              standards-aligned reporting—learning across HairAudit (surgical evidence), Hair Longevity
              Institute (biology and longitudinal intelligence), and IIOHR (methodology and standards).
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background/45 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Ecosystem
                </p>
                <p className="mt-2 text-sm text-foreground">
                  HairAudit: surgical evidence and audit surface. HLI: biology and longitudinal treatment
                  intelligence. IIOHR: methodology, training, and governance alignment. FI connects all three.
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/45 p-4">
                <div className="flex items-center gap-3 text-xs text-amber-200/80">
                  <IiohrSeal tone="dark" className="h-10 w-10 shrink-0" aria-hidden />
                  <span>Methodology and governance aligned with IIOHR review frameworks.</span>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-1">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Navigation
              </p>
              <nav className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
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
            <div className="rounded-2xl border border-border/70 bg-card/40 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Contact
              </p>
              <p className="mt-3 text-sm text-foreground">Platform demos, white-label partnerships, and benchmarking systems.</p>
              <Link
                href="/contact?intent=demo"
                className="mt-4 inline-flex text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                Request a conversation
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-10 border-t border-border/50 pt-8">
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-6 sm:gap-y-1">
            <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {ECOSYSTEM_BAND.tagline}
            </span>
            <nav aria-label="Surgical Intelligence Ecosystem" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
              {ECOSYSTEM_BAND.links.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  {...(item.href.startsWith("http") && { target: "_blank", rel: "noopener noreferrer" })}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                  <span className="ml-1 text-[10px] text-muted-foreground/70">({item.role})</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
        <div className="mt-6 border-t border-border/40 pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Follicle Intelligence. All rights reserved.
        </div>
      </div>
    </motion.footer>
  );
}
