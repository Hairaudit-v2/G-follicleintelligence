import Link from "next/link";

/**
 * One-line ecosystem mention for use on marketing pages.
 * Keeps brand roles and external links consistent (HairAudit = audit, HLI = biology, IIOHR = training).
 */
export function EcosystemMention({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm text-muted-foreground ${className}`}>
      Part of the Surgical Intelligence Ecosystem™ with{" "}
      <Link
        href="https://hairaudit.com"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 transition-colors hover:text-primary"
      >
        HairAudit
      </Link>{" "}
      (surgical audit),{" "}
      <Link
        href="https://hairlongevityinstitute.com"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 transition-colors hover:text-primary"
      >
        Hair Longevity Institute
      </Link>{" "}
      (biology & treatment), and{" "}
      <Link
        href="https://iiohr.com"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 transition-colors hover:text-primary"
      >
        IIOHR
      </Link>{" "}
      (training & certification).
    </p>
  );
}
