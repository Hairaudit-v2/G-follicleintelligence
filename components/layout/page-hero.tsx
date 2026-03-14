"use client";

import { motion } from "framer-motion";

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}

export function PageHero({ eyebrow, title, subtitle }: PageHeroProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fi-grid relative overflow-hidden border-b border-border/50 bg-gradient-to-b from-background via-background to-transparent"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,hsl(var(--primary)/0.14),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_90%_10%,rgb(166_184_198_/_10%),transparent_40%)]" />
      <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-20">
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary/90">{eyebrow}</p>
        )}
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </motion.section>
  );
}
