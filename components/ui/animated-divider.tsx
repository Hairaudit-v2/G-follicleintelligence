"use client";

import { motion } from "framer-motion";

export function AnimatedDivider() {
  return (
    <motion.div
      initial={{ scaleX: 0, opacity: 0.5 }}
      whileInView={{ scaleX: 1, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="my-12 h-px w-full origin-left bg-gradient-to-r from-primary/30 via-primary/10 to-transparent"
    />
  );
}
