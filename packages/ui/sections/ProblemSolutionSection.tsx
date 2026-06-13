import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { NetworkCard } from "../Card";
import { NetworkFeatureGrid } from "../FeatureGrid";
import { NetworkSection } from "../Section";

export type ProblemSolutionColumn = {
  title: ReactNode;
  body?: ReactNode;
  items?: readonly ReactNode[];
};

export type NetworkProblemSolutionSectionProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  problems: ProblemSolutionColumn;
  solutions: ProblemSolutionColumn;
  className?: string;
};

function ColumnCard({ column, tone }: { column: ProblemSolutionColumn; tone: "problem" | "solution" }) {
  return (
    <NetworkCard
      variant="glass"
      className={cn(
        tone === "problem" && "border-amber-400/[0.09] bg-gradient-to-br from-white/[0.06] to-amber-950/[0.08]",
        tone === "solution" && "border-violet-400/10 bg-gradient-to-br from-white/[0.05] to-violet-950/10"
      )}
    >
      <h3 className="font-display text-xl font-semibold text-foreground">{column.title}</h3>
      {column.body ? <div className="mt-3 text-sm leading-relaxed text-muted-foreground">{column.body}</div> : null}
      {column.items?.length ? (
        <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
          {column.items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground/30" aria-hidden />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </NetworkCard>
  );
}

export function NetworkProblemSolutionSection({
  eyebrow,
  title,
  description,
  problems,
  solutions,
  className,
}: NetworkProblemSolutionSectionProps) {
  return (
    <NetworkSection className={cn(className)}>
      <div className="space-y-8">
        {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</div> : null}
        <div className="max-w-3xl space-y-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h2>
          {description ? <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p> : null}
        </div>
        <NetworkFeatureGrid columnsClassName="lg:grid-cols-2">
          <ColumnCard column={problems} tone="problem" />
          <ColumnCard column={solutions} tone="solution" />
        </NetworkFeatureGrid>
      </div>
    </NetworkSection>
  );
}
