import Link from "next/link";

import { cn } from "@/lib/utils";
import { primaryRecordHref } from "@/src/lib/receptionOs/receptionOsBoardModel";

export function ReceptionOsRecordLinks(props: {
  hrefs: {
    patient?: string | null;
    case?: string | null;
    lead?: string | null;
    consultation?: string | null;
    appointment?: string | null;
    calendar?: string | null;
  };
  className?: string;
}) {
  const links = [
    props.hrefs.patient ? { href: props.hrefs.patient, label: "Patient" } : null,
    props.hrefs.case ? { href: props.hrefs.case, label: "Case" } : null,
    props.hrefs.lead ? { href: props.hrefs.lead, label: "Lead" } : null,
    props.hrefs.consultation ? { href: props.hrefs.consultation, label: "Consult" } : null,
    props.hrefs.appointment ? { href: props.hrefs.appointment, label: "Appt" } : null,
    props.hrefs.calendar ? { href: props.hrefs.calendar, label: "Calendar" } : null,
  ].filter(Boolean) as { href: string; label: string }[];

  if (!links.length) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap gap-x-2 gap-y-0.5 text-[0.65rem] font-semibold",
        props.className
      )}
    >
      {links.map((l) => (
        <Link
          key={`${l.label}-${l.href}`}
          href={l.href}
          className="text-cyan-400/95 hover:text-cyan-300"
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}

export function receptionOsPrimaryHref(
  hrefs: Parameters<typeof primaryRecordHref>[0]
): string | null {
  return primaryRecordHref(hrefs);
}
