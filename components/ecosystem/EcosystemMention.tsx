import Link from "next/link";

/**
 * One-line mention for use on marketing pages.
 * Aligns roles: HairAudit = surgical evidence/audit surface, HLI = biology/longitudinal, IIOHR = standards/training.
 */
export function EcosystemMention({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm text-muted-foreground ${className}`}>
      Follicle Intelligence™ connects{" "}
      <Link
        href="https://hairaudit.com"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 transition-colors hover:text-primary"
      >
        HairAudit
      </Link>{" "}
      (surgical evidence and audit surface),{" "}
      <Link
        href="https://hairlongevityinstitute.com"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 transition-colors hover:text-primary"
      >
        Hair Longevity Institute
      </Link>{" "}
      (biology and longitudinal treatment intelligence), and{" "}
      <Link
        href="https://iiohr.com"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 transition-colors hover:text-primary"
      >
        IIOHR
      </Link>{" "}
      (structured training programs, standards, and governance alignment).
    </p>
  );
}
