import type { ReactNode } from "react";

export function CaseSummaryDocumentSection({
  title,
  id,
  children,
}: {
  title: string;
  /** Optional anchor for in-page navigation. */
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="break-inside-avoid border-b border-white/[0.08] pb-6 print:border-gray-800 print:pb-4">
      <h2 className="mb-3 text-base font-semibold text-slate-100 print:text-black">{title}</h2>
      <div className="space-y-3 text-sm text-slate-200 print:text-black">{children}</div>
    </section>
  );
}
