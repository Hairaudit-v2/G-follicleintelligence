"use client";

import { motion } from "framer-motion";

const LAYERS = [
  {
    title: "Input Layer",
    bullets: [
      "PDF lab reports (digital + scanned)",
      "Scalp and hair imagery (JPEG, PNG)",
      "Structured intake metadata (JSON)",
      "Reference ranges and units config",
    ],
  },
  {
    title: "Extraction Layer",
    bullets: [
      "Native PDF text extraction",
      "OCR pipeline for image-based PDFs",
      "Vision provider integration",
      "Canonical marker normalisation",
      "Signal vector computation (0–1)",
    ],
  },
  {
    title: "Output Layer",
    bullets: [
      "Structured JSON (markers + signals)",
      "Domain scores and risk tiers",
      "Explainability vectors",
      "PDF reports with audit trail",
      "REST API response payloads",
    ],
  },
];

function ConnectorLine({ id }: { id: string }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <svg
        className="absolute h-full w-full"
        viewBox="0 0 60 40"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="hsl(var(--primary) / 0.2)" />
            <stop offset="50%" stopColor="hsl(var(--primary) / 0.6)" />
            <stop offset="100%" stopColor="hsl(var(--primary) / 0.2)" />
          </linearGradient>
        </defs>
        <motion.path
          d="M 0 20 L 60 20"
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth="1"
          strokeDasharray="60"
          strokeDashoffset="60"
          initial={{ strokeDashoffset: 60 }}
          whileInView={{ strokeDashoffset: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />
      </svg>
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3, delay: 0.6 }}
        className="relative z-10 size-2 rounded-full bg-primary/70"
      />
    </div>
  );
}

function LayerBlock({
  title,
  bullets,
  index,
}: {
  title: string;
  bullets: string[];
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="flex min-w-0 flex-1 flex-col rounded-lg border border-border/60 bg-card/80 p-6 shadow-lg shadow-black/10"
    >
      <div className="mb-4 font-mono text-xs font-medium uppercase tracking-wider text-primary/90">
        {title}
      </div>
      <ul className="space-y-2">
        {bullets.map((b, i) => (
          <motion.li
            key={b}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: 0.2 + i * 0.05 }}
            className="flex items-start gap-2 text-xs text-muted-foreground"
          >
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/50" />
            <span>{b}</span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}

export function ArchitectureDiagram() {
  return (
    <div className="w-full overflow-x-auto py-8">
      <div className="mx-auto flex max-w-5xl items-stretch gap-2 md:gap-4">
        <div className="min-w-0 flex-1">
          <LayerBlock title={LAYERS[0].title} bullets={LAYERS[0].bullets} index={0} />
        </div>
        <div className="flex w-12 shrink-0 items-center md:w-16">
          <ConnectorLine id="connectorGrad1" />
        </div>
        <div className="min-w-0 flex-1">
          <LayerBlock title={LAYERS[1].title} bullets={LAYERS[1].bullets} index={1} />
        </div>
        <div className="flex w-12 shrink-0 items-center md:w-16">
          <ConnectorLine id="connectorGrad2" />
        </div>
        <div className="min-w-0 flex-1">
          <LayerBlock title={LAYERS[2].title} bullets={LAYERS[2].bullets} index={2} />
        </div>
      </div>
    </div>
  );
}
