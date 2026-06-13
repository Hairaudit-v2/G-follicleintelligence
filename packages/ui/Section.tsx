import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { networkSpacing } from "./tokens";

export type NetworkSectionProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  "aria-labelledby"?: string;
  /** Inner width cap */
  maxWidthClassName?: string;
};

export function NetworkSection({
  children,
  className,
  id,
  "aria-labelledby": ariaLabelledBy,
  maxWidthClassName = "max-w-6xl",
}: NetworkSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={ariaLabelledBy}
      className={cn("mx-auto", maxWidthClassName, networkSpacing.sectionX, networkSpacing.sectionY, className)}
    >
      {children}
    </section>
  );
}
