import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { networkSpacing } from "./tokens";

export type NetworkContainerProps = {
  children: ReactNode;
  className?: string;
  maxWidthClassName?: string;
};

/** Horizontal page gutter without default vertical rhythm */
export function NetworkContainer({
  children,
  className,
  maxWidthClassName = "max-w-6xl",
}: NetworkContainerProps) {
  return <div className={cn("mx-auto w-full", maxWidthClassName, networkSpacing.sectionX, className)}>{children}</div>;
}
