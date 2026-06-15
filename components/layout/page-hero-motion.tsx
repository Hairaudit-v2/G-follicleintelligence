"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function PageHeroMotion({ children }: { children: ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fi-grid relative overflow-hidden border-b border-border/50 bg-gradient-to-b from-background via-background to-transparent"
    >
      {children}
    </motion.section>
  );
}
