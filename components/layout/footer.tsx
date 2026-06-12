"use client";

import Image from "next/image";
import Link from "next/link";

import { PUBLIC_IMAGES } from "@/src/lib/brand/publicImages";
import { motion } from "framer-motion";

import {
  FOOTER_COMPANY,
  FOOTER_INTELLIGENCE_LAYERS,
  FOOTER_MODULES,
  FOOTER_PLATFORM,
} from "@/lib/site-navigation";

function FooterLinkList({
  items,
  tone = "default",
}: {
  items: readonly { label: string; href: string }[];
  tone?: "default" | "supporting";
}) {
  const linkClass =
    tone === "supporting"
      ? "text-xs text-muted-foreground/85 transition-colors hover:text-foreground"
      : "text-sm text-muted-foreground transition-colors hover:text-foreground";
  return (
    <ul className={tone === "supporting" ? "mt-3 space-y-2.5" : "mt-4 space-y-3"}>
      {items.map((item) => (
        <li key={`${item.href}-${item.label}`}>
          <Link
            href={item.href}
            {...(item.href.startsWith("http") && {
              target: "_blank",
              rel: "noopener noreferrer",
            })}
            className={linkClass}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

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
        <div className="fi-panel rounded-[1.5rem] p-7 md:p-8">
          <Link href="/" className="inline-block">
            <Image
              src={PUBLIC_IMAGES.follicleLogoWhite}
              alt="Follicle Intelligence"
              width={240}
              height={48}
              className="h-auto w-44 md:w-52"
            />
          </Link>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
            Follicle Intelligence is the world&apos;s first operating system built specifically for
            modern hair restoration clinics.
          </p>
        </div>

        <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Platform</p>
            <FooterLinkList items={FOOTER_PLATFORM} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Modules</p>
            <FooterLinkList items={FOOTER_MODULES} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground/80">
              Intelligence Layers
            </p>
            <FooterLinkList items={FOOTER_INTELLIGENCE_LAYERS} tone="supporting" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Company</p>
            <FooterLinkList items={FOOTER_COMPANY} />
          </div>
        </div>

        <div className="mt-10 border-t border-border/40 pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Follicle Intelligence. All rights reserved.
        </div>
      </div>
    </motion.footer>
  );
}
